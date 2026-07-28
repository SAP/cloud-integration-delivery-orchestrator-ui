<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { GetGitSnapshots, GetSnapshotFiles, TriggerGitSync, type GitSnapshot, type SnapshotFileEntry, type SnapshotFilesResponse } from '@/service/api'
import { createPatch } from 'diff'
import { html as diff2htmlRender } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Button.js"

const PENDING_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes
const POLL_INTERVAL_MS = 5000 // 5 seconds

const props = defineProps<{
  artifactId: string
  artifactVersion: string
  sourceTenantId: number
  targetTenantId: number
}>()

const loading = ref(true)
const error = ref('')
const diffHtml = ref('')
const fileStats = ref<{ added: number; deleted: number; modified: number; unchanged: number }>({ added: 0, deleted: 0, modified: 0, unchanged: 0 })

type SnapshotDisplayStatus = 'loading' | 'syncing' | 'completed' | 'stuck' | 'failed' | 'none'
const sourceStatus = ref<SnapshotDisplayStatus>('loading')
const targetStatus = ref<SnapshotDisplayStatus>('loading')
const sourceError = ref('')
const targetError = ref('')
const retrying = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

function classifySnapshot(snap: GitSnapshot | undefined): SnapshotDisplayStatus {
  if (!snap) return 'none'
  if (snap.status === 'completed') return 'completed'
  if (snap.status === 'failed') return 'failed'
  const elapsed = Date.now() - new Date(snap.triggeredAt).getTime()
  return elapsed >= PENDING_TIMEOUT_MS ? 'stuck' : 'syncing'
}

async function ensureSnapshot(artifactId: string, version: string, tenantId: number): Promise<GitSnapshot | undefined> {
  const snapshots = await GetGitSnapshots(artifactId, tenantId)
  const snap = snapshots?.find(s => s.version === version)

  const status = classifySnapshot(snap)

  if (status === 'completed') return snap
  if (status === 'syncing') return snap // still processing, will poll

  // none / failed / stuck → trigger sync
  if (status === 'none' || status === 'failed' || status === 'stuck') {
    try {
      const result = await TriggerGitSync({ artifactId, version, cpiTenantId: tenantId })
      return result
    } catch {
      // trigger failed — return the original snap (may be undefined) for status display
      return snap
    }
  }

  return snap
}

async function loadCompare() {
  if (!props.artifactId || !props.sourceTenantId || !props.targetTenantId) return

  stopPoll()
  loading.value = true
  error.value = ''
  diffHtml.value = ''
  fileStats.value = { added: 0, deleted: 0, modified: 0, unchanged: 0 }
  sourceStatus.value = 'loading'
  targetStatus.value = 'loading'
  sourceError.value = ''
  targetError.value = ''

  try {
    // Ensure snapshots exist (auto-trigger if needed)
    const [sourceSnap, targetSnap] = await Promise.all([
      ensureSnapshot(props.artifactId, props.artifactVersion, props.sourceTenantId),
      ensureSnapshot(props.artifactId, props.artifactVersion, props.targetTenantId),
    ])

    sourceStatus.value = classifySnapshot(sourceSnap)
    targetStatus.value = classifySnapshot(targetSnap)
    if (sourceSnap?.status === 'failed') sourceError.value = sourceSnap.error || 'Unknown error'
    if (targetSnap?.status === 'failed') targetError.value = targetSnap.error || 'Unknown error'

    // If either side is still syncing, start polling
    if (sourceStatus.value === 'syncing' || targetStatus.value === 'syncing') {
      startPoll()
      return
    }

    // If either side is not completed, stop here (show status)
    if (sourceStatus.value !== 'completed' || targetStatus.value !== 'completed') {
      return
    }

    // Both completed — fetch files and compute diff
    const [sourceFiles, targetFiles] = await Promise.all([
      GetSnapshotFiles(sourceSnap!.ID),
      GetSnapshotFiles(targetSnap!.ID),
    ])

    const patches = computePatches(sourceFiles, targetFiles)
    if (!patches.length) {
      error.value = 'No differences found between the two versions.'
      return
    }

    diffHtml.value = diff2htmlRender(patches.join('\n'), {
      drawFileList: true,
      matching: 'lines',
      outputFormat: 'side-by-side',
    })
  } catch (e: any) {
    error.value = e?.message || 'Failed to load code compare'
  } finally {
    loading.value = false
  }
}

function startPoll() {
  loading.value = false
  pollTimer = setInterval(async () => {
    const [sourceSnapshots, targetSnapshots] = await Promise.all([
      GetGitSnapshots(props.artifactId, props.sourceTenantId),
      GetGitSnapshots(props.artifactId, props.targetTenantId),
    ])

    const sourceSnap = sourceSnapshots?.find(s => s.version === props.artifactVersion)
    const targetSnap = targetSnapshots?.find(s => s.version === props.artifactVersion)

    sourceStatus.value = classifySnapshot(sourceSnap)
    targetStatus.value = classifySnapshot(targetSnap)

    if (sourceSnap?.status === 'failed') sourceError.value = sourceSnap.error || 'Unknown error'
    if (targetSnap?.status === 'failed') targetError.value = targetSnap.error || 'Unknown error'

    // If no longer syncing, stop poll and try to load diff
    if (sourceStatus.value !== 'syncing' && targetStatus.value !== 'syncing') {
      stopPoll()
      if (sourceStatus.value === 'completed' && targetStatus.value === 'completed') {
        loadCompare()
      }
    }
  }, POLL_INTERVAL_MS)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function handleRetry(side: 'source' | 'target') {
  retrying.value = true
  try {
    await TriggerGitSync({
      artifactId: props.artifactId,
      version: props.artifactVersion,
      cpiTenantId: side === 'source' ? props.sourceTenantId : props.targetTenantId,
    })
    await loadCompare()
  } catch (e: any) {
    error.value = e?.message || 'Retry failed'
  } finally {
    retrying.value = false
  }
}

function computePatches(source: SnapshotFilesResponse, target: SnapshotFilesResponse): string[] {
  const sourceMap = new Map<string, SnapshotFileEntry>()
  const targetMap = new Map<string, SnapshotFileEntry>()
  source.files.forEach(f => sourceMap.set(f.path, f))
  target.files.forEach(f => targetMap.set(f.path, f))

  const allPaths = new Set([...sourceMap.keys(), ...targetMap.keys()])
  const patches: string[] = []
  let added = 0, deleted = 0, modified = 0, unchanged = 0

  for (const path of allPaths) {
    const sf = sourceMap.get(path)
    const tf = targetMap.get(path)
    if (sf?.isBinary || tf?.isBinary) continue

    const sourceContent = sf?.content || ''
    const targetContent = tf?.content || ''

    if (sourceContent === targetContent) {
      unchanged++
      continue
    }

    if (!sf) { deleted++ }
    else if (!tf) { added++ }
    else { modified++ }

    patches.push(createPatch(
      path,
      targetContent,
      sourceContent,
      `${target.tenant} v${target.version}`,
      `${source.tenant} v${source.version}`,
    ))
  }

  fileStats.value = { added, deleted, modified, unchanged }
  return patches
}

watch(() => [props.artifactId, props.artifactVersion, props.sourceTenantId, props.targetTenantId], () => {
  loadCompare()
}, { immediate: true })

onUnmounted(() => stopPoll())
</script>

<template>
  <div class="code-compare-viewer">
    <!-- Loading -->
    <ui5-busy-indicator v-if="loading" active :delay="0" style="display: flex; justify-content: center; padding: 2rem;" />

    <!-- Snapshot status (when not both completed) -->
    <template v-else-if="sourceStatus !== 'completed' || targetStatus !== 'completed'">
      <div v-if="sourceStatus !== 'completed'" class="snapshot-status">
        <ui5-message-strip v-if="sourceStatus === 'syncing'" design="Information" hide-close-button>
          Source artifact syncing to Git...
        </ui5-message-strip>
        <ui5-message-strip v-else-if="sourceStatus === 'stuck'" design="Critical" hide-close-button>
          Source sync appears stuck.
          <ui5-button slot="action" design="Transparent" :disabled="retrying" @click="handleRetry('source')">Retry</ui5-button>
        </ui5-message-strip>
        <ui5-message-strip v-else-if="sourceStatus === 'failed'" design="Negative" hide-close-button>
          Source sync failed: {{ sourceError }}
          <ui5-button slot="action" design="Transparent" :disabled="retrying" @click="handleRetry('source')">Retry</ui5-button>
        </ui5-message-strip>
        <ui5-message-strip v-else-if="sourceStatus === 'none'" design="Warning" hide-close-button>
          Source artifact has no operation record — cannot sync.
        </ui5-message-strip>
      </div>

      <div v-if="targetStatus !== 'completed'" class="snapshot-status">
        <ui5-message-strip v-if="targetStatus === 'syncing'" design="Information" hide-close-button>
          Target artifact syncing to Git...
        </ui5-message-strip>
        <ui5-message-strip v-else-if="targetStatus === 'stuck'" design="Critical" hide-close-button>
          Target sync appears stuck.
          <ui5-button slot="action" design="Transparent" :disabled="retrying" @click="handleRetry('target')">Retry</ui5-button>
        </ui5-message-strip>
        <ui5-message-strip v-else-if="targetStatus === 'failed'" design="Negative" hide-close-button>
          Target sync failed: {{ targetError }}
          <ui5-button slot="action" design="Transparent" :disabled="retrying" @click="handleRetry('target')">Retry</ui5-button>
        </ui5-message-strip>
        <ui5-message-strip v-else-if="targetStatus === 'none'" design="Warning" hide-close-button>
          Target artifact has no operation record — cannot sync.
        </ui5-message-strip>
      </div>
    </template>

    <!-- Error -->
    <ui5-message-strip v-else-if="error" design="Warning" hide-close-button style="margin-bottom: 1rem;">
      {{ error }}
    </ui5-message-strip>

    <!-- Diff content -->
    <template v-else-if="diffHtml">
      <div class="diff-stats">
        <span class="stat-item stat-added" v-if="fileStats.added">+{{ fileStats.added }} added</span>
        <span class="stat-item stat-modified" v-if="fileStats.modified">~{{ fileStats.modified }} modified</span>
        <span class="stat-item stat-deleted" v-if="fileStats.deleted">-{{ fileStats.deleted }} deleted</span>
        <span class="stat-item stat-unchanged">{{ fileStats.unchanged }} unchanged</span>
      </div>
      <div class="diff-container" v-html="diffHtml" />
    </template>
  </div>
</template>

<style scoped>
.code-compare-viewer {
  width: 100%;
}

.snapshot-status {
  margin-bottom: 0.75rem;
}

.diff-stats {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.stat-item {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.stat-added { background: #d4edda; color: #155724; }
.stat-modified { background: #fff3cd; color: #856404; }
.stat-deleted { background: #f8d7da; color: #721c24; }
.stat-unchanged { color: var(--sapContent_LabelColor); }

.diff-container {
  border: 1px solid var(--sapList_BorderColor);
  border-radius: 4px;
  overflow: auto;
  max-height: 600px;
}

.diff-container :deep(.d2h-wrapper) {
  font-family: var(--sapFontMonospaceFamily, monospace);
  font-size: 0.8rem;
}

.diff-container :deep(.d2h-file-header) {
  background: var(--sapList_HeaderBackground);
  border-bottom: 1px solid var(--sapList_BorderColor);
}
</style>
