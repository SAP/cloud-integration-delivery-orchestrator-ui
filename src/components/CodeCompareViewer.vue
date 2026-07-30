<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { GetGitSnapshots, GetSnapshotFiles, TriggerGitSync, type GitSnapshot, type SnapshotFileEntry, type SnapshotFilesResponse } from '@/service/api'
import { createPatch } from 'diff'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'

import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/SegmentedButton.js"
import "@ui5/webcomponents/dist/SegmentedButtonItem.js"

const PENDING_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes — a pending snapshot older than this is "stuck"
const POLL_INTERVAL_MS = 5000 // 5 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes — give up polling after this

const props = defineProps<{
  artifactId: string
  artifactVersion: string
  packageId: string
  artifactType: string
  sourceTenantId: number
  targetTenantId: number
}>()

const loading = ref(true)
const error = ref('')
const hasDiff = ref(false)
const fileStats = ref({ added: 0, deleted: 0, modified: 0, unchanged: 0 })
const compareInfo = ref({ sourceTenant: '', sourceVersion: '', targetTenant: '', targetVersion: '' })

// Toolbar controls
const outputFormat = ref<'side-by-side' | 'line-by-line'>('side-by-side')
const diffMatchStyle = ref<'word' | 'char'>('word')
const patchesCache = ref<string[]>([])

// Sync status
type SnapshotDisplayStatus = 'loading' | 'syncing' | 'completed' | 'failed'
// Outcome of resolving one side (source/target) independently.
type SideOutcome =
  | { kind: 'completed'; snap: GitSnapshot }
  | { kind: 'failed' }
  | { kind: 'pending' } // still syncing within timeout → caller should poll
const sourceStatus = ref<SnapshotDisplayStatus>('loading')
const targetStatus = ref<SnapshotDisplayStatus>('loading')
const sourceError = ref('')
const targetError = ref('')
const sourceVersionMismatch = ref('')

const diffContainerRef = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let generation = 0 // incremented each loadCompare; stale resolveSide results are discarded

// A pending snapshot older than the timeout is considered "stuck" and should be re-triggered.
function isStuck(snap: GitSnapshot | undefined): boolean {
  if (!snap || snap.status !== 'pending') return false
  return Date.now() - new Date(snap.triggeredAt).getTime() >= PENDING_TIMEOUT_MS
}

function compareCPIVersion(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < 3; i++) {
    const na = parseInt(pa[i] || '0', 10)
    const nb = parseInt(pb[i] || '0', 10)
    if (isNaN(na) || isNaN(nb)) return 0
    if (na !== nb) return na > nb ? 1 : -1
  }
  const qa = pa[3] || ''
  const qb = pb[3] || ''
  if (qa === qb) return 0
  const nqa = parseInt(qa, 10)
  const nqb = parseInt(qb, 10)
  if (!isNaN(nqa) && !isNaN(nqb)) return nqa > nqb ? 1 : -1
  return 0
}

// --- Diff rendering (Diff2HtmlUI handles collapse, sticky headers, sync scroll) ---

function renderDiff() {
  if (!patchesCache.value.length || !diffContainerRef.value) return

  const diffInput = patchesCache.value.join('\n')
  const ui = new Diff2HtmlUI(diffContainerRef.value, diffInput, {
    outputFormat: outputFormat.value,
    drawFileList: true,
    matching: diffMatchStyle.value === 'word' ? 'words' : 'none',
    diffStyle: diffMatchStyle.value,
    synchronisedScroll: true,
    fileContentToggle: true,
    stickyFileHeaders: true,
    highlight: false,
  })
  ui.draw()
  hasDiff.value = true
}

// --- Data loading ---

function resolveSourceSnapshot(snapshots: GitSnapshot[]): GitSnapshot | undefined {
  if (!snapshots.length) return undefined
  const exact = snapshots.find(s => s.version === props.artifactVersion && s.status === 'completed')
  if (exact) return exact
  const latestCompleted = snapshots.find(s => s.status === 'completed')
  if (latestCompleted && compareCPIVersion(latestCompleted.version, props.artifactVersion) > 0) {
    sourceVersionMismatch.value = `Source is v${latestCompleted.version}, DR references v${props.artifactVersion}`
    return latestCompleted
  }
  return snapshots.find(s => s.version === props.artifactVersion) || undefined
}

function resolveTargetSnapshot(snapshots: GitSnapshot[]): GitSnapshot | undefined {
  if (!snapshots.length) return undefined
  return snapshots.find(s => s.status === 'completed') || snapshots[0] || undefined
}

async function loadCompare() {
  if (!props.artifactId || !props.sourceTenantId || !props.targetTenantId) return

  stopPoll()
  const gen = ++generation // stale-request guard
  loading.value = true
  error.value = ''
  hasDiff.value = false
  patchesCache.value = []
  fileStats.value = { added: 0, deleted: 0, modified: 0, unchanged: 0 }
  sourceStatus.value = 'loading'
  targetStatus.value = 'loading'
  sourceError.value = ''
  targetError.value = ''
  sourceVersionMismatch.value = ''

  // === Phase 1: initial snapshot query (both sides) ===
  let sourceSnapshots: GitSnapshot[]
  let targetSnapshots: GitSnapshot[]
  try {
    ;[sourceSnapshots, targetSnapshots] = await Promise.all([
      GetGitSnapshots(props.artifactId, props.sourceTenantId),
      GetGitSnapshots(props.artifactId, props.targetTenantId),
    ])
  } catch (e: any) {
    if (gen !== generation) return // superseded
    loading.value = false
    error.value = e?.message || 'Failed to query snapshots'
    return
  }
  if (gen !== generation) return // superseded

  // Flip loading off so per-side status (syncing/failed) is visible during Phase 2.
  loading.value = false

  // === Phase 2: resolve each side independently (may auto-trigger) ===
  const [source, target] = await Promise.all([
    resolveSide('source', sourceSnapshots),
    resolveSide('target', targetSnapshots),
  ])
  if (gen !== generation) return // superseded

  // === Phase 3: decide next step ===
  if (source.kind === 'completed' && target.kind === 'completed') {
    return loadDiff(source.snap, target.snap)
  }
  if (source.kind === 'failed' || target.kind === 'failed') {
    return // UI shows the failed side + Retry; compare can't proceed
  }
  // Remaining case: at least one side is genuinely pending, none failed → poll.
  startPoll(gen)
}

// resolveSide resolves ONE tenant's snapshot to a terminal outcome, independent of
// the other side. It auto-triggers a sync when the snapshot is stuck or absent, then
// re-queries. This per-side independence is what prevents the two sides from deadlocking.
async function resolveSide(side: 'source' | 'target', snapshots: GitSnapshot[]): Promise<SideOutcome> {
  const isSource = side === 'source'
  const tenantId = isSource ? props.sourceTenantId : props.targetTenantId
  const setStatus = (s: SnapshotDisplayStatus) => { (isSource ? sourceStatus : targetStatus).value = s }
  const setError = (msg: string) => { (isSource ? sourceError : targetError).value = msg }
  const resolve = (list: GitSnapshot[]) =>
    isSource ? resolveSourceSnapshot(list) : resolveTargetSnapshot(list)

  const snap = resolve(snapshots)

  if (snap?.status === 'completed') { setStatus('completed'); return { kind: 'completed', snap } }
  if (snap?.status === 'failed') { setStatus('failed'); setError(snap.error || 'Unknown error'); return { kind: 'failed' } }
  // pending but within timeout → genuinely syncing, let the poller wait for it
  if (snap && !isStuck(snap)) { setStatus('syncing'); return { kind: 'pending' } }

  // stuck snapshot OR no snapshot at all → auto-trigger once (backend trigger is synchronous)
  setStatus('syncing')
  try {
    await TriggerGitSync({ artifactId: props.artifactId, cpiTenantId: tenantId, artifactType: props.artifactType, packageId: props.packageId })
  } catch (e: any) {
    setStatus('failed'); setError(e?.message || 'Sync failed'); return { kind: 'failed' }
  }

  // Re-query after the trigger resolves.
  let after: GitSnapshot[]
  try {
    after = await GetGitSnapshots(props.artifactId, tenantId)
  } catch (e: any) {
    setStatus('failed'); setError(e?.message || 'Failed to query snapshots after sync'); return { kind: 'failed' }
  }

  const snap2 = resolve(after)
  if (snap2?.status === 'completed') { setStatus('completed'); return { kind: 'completed', snap: snap2 } }
  if (snap2?.status === 'failed') { setStatus('failed'); setError(snap2.error || 'Unknown error'); return { kind: 'failed' } }
  setStatus('syncing'); return { kind: 'pending' }
}

async function loadDiff(sourceSnap: GitSnapshot, targetSnap: GitSnapshot) {
  loading.value = true
  try {
    const [sourceFiles, targetFiles] = await Promise.all([
      GetSnapshotFiles(sourceSnap.ID),
      GetSnapshotFiles(targetSnap.ID),
    ])

    const patches = computePatches(sourceFiles, targetFiles)
    if (!patches.length) {
      error.value = 'No differences found between the two versions.'
      return
    }

    patchesCache.value = patches
  } catch (e: any) {
    error.value = e?.message || 'Failed to load diff'
    return
  } finally {
    loading.value = false
  }

  // loading is now false → the v-else branch (and diff container) is rendered.
  // Wait for the DOM flush so diffContainerRef is attached before drawing.
  await nextTick()
  renderDiff()
}

// Poll is tenant-agnostic: it just waits until BOTH sides report completed (or times
// out), then re-runs loadCompare to render the diff. Uses setTimeout chaining (not
// setInterval) to prevent overlapping iterations when network is slow.
function startPoll(gen: number) {
  const startedAt = Date.now()

  function scheduleNext() {
    pollTimer = setTimeout(async () => {
      if (gen !== generation) return // superseded by a new loadCompare
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (sourceStatus.value === 'syncing') { sourceStatus.value = 'failed'; if (!sourceError.value) sourceError.value = 'Sync timed out' }
        if (targetStatus.value === 'syncing') { targetStatus.value = 'failed'; if (!targetError.value) targetError.value = 'Sync timed out' }
        return
      }
      try {
        const [sourceSnapshots, targetSnapshots] = await Promise.all([
          GetGitSnapshots(props.artifactId, props.sourceTenantId),
          GetGitSnapshots(props.artifactId, props.targetTenantId),
        ])
        if (gen !== generation) return // superseded
        if (resolveSourceSnapshot(sourceSnapshots)?.status === 'completed') sourceStatus.value = 'completed'
        if (resolveTargetSnapshot(targetSnapshots)?.status === 'completed') targetStatus.value = 'completed'

        if (sourceStatus.value === 'completed' && targetStatus.value === 'completed') {
          loadCompare()
          return
        }
      } catch {
        // Transient query error — retry on next iteration.
      }
      if (gen === generation) scheduleNext()
    }, POLL_INTERVAL_MS)
  }

  scheduleNext()
}

function stopPoll() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
}

async function handleRetry(side: 'source' | 'target') {
  const isSource = side === 'source'
  const setStatus = (s: SnapshotDisplayStatus) => { (isSource ? sourceStatus : targetStatus).value = s }
  const setError = (msg: string) => { (isSource ? sourceError : targetError).value = msg }

  setStatus('syncing')
  setError('')
  try {
    await TriggerGitSync({
      artifactId: props.artifactId,
      cpiTenantId: isSource ? props.sourceTenantId : props.targetTenantId,
      artifactType: props.artifactType,
      packageId: props.packageId,
    })
    // Re-evaluate both sides; the retried side is now completed.
    await loadCompare()
  } catch (e: any) {
    setStatus('failed')
    setError(e?.message || 'Sync failed')
  }
}

function computePatches(source: SnapshotFilesResponse, target: SnapshotFilesResponse): string[] {
  const sourceMap = new Map<string, SnapshotFileEntry>()
  const targetMap = new Map<string, SnapshotFileEntry>()
  source.files.forEach(f => sourceMap.set(f.path, f))
  target.files.forEach(f => targetMap.set(f.path, f))

  compareInfo.value = {
    sourceTenant: source.tenant,
    sourceVersion: source.version,
    targetTenant: target.tenant,
    targetVersion: target.version,
  }

  const allPaths = new Set([...sourceMap.keys(), ...targetMap.keys()])
  const patches: string[] = []
  let added = 0, deleted = 0, modified = 0, unchanged = 0

  for (const path of allPaths) {
    const sf = sourceMap.get(path)
    const tf = targetMap.get(path)
    if (sf?.isBinary || tf?.isBinary) continue
    const sourceContent = sf?.content || ''
    const targetContent = tf?.content || ''
    if (sourceContent === targetContent) { unchanged++; continue }
    // Patch direction is source→target: a path only in target is an addition,
    // a path only in source is a deletion.
    if (!sf) { added++ } else if (!tf) { deleted++ } else { modified++ }
    patches.push(createPatch(path, sourceContent, targetContent))
  }

  fileStats.value = { added, deleted, modified, unchanged }
  return patches
}

// Re-render on toolbar changes (no re-fetch needed)
watch([outputFormat, diffMatchStyle], () => {
  if (patchesCache.value.length) {
    nextTick(() => renderDiff())
  }
})

// Re-fetch on props change
watch(() => [props.artifactId, props.artifactVersion, props.sourceTenantId, props.targetTenantId], () => {
  loadCompare()
}, { immediate: true })

onUnmounted(() => stopPoll())
</script>

<template>
  <div class="code-compare-viewer">
    <ui5-busy-indicator v-if="loading" active :delay="0" style="display: flex; justify-content: center; padding: 2rem;" />

    <template v-else-if="sourceStatus !== 'completed' || targetStatus !== 'completed'">
      <ui5-message-strip v-if="sourceVersionMismatch" design="Information" hide-close-button style="margin-bottom: 0.75rem;">
        {{ sourceVersionMismatch }}
      </ui5-message-strip>

      <div v-if="sourceStatus !== 'completed'" class="snapshot-status">
        <ui5-message-strip v-if="sourceStatus === 'syncing'" design="Information" hide-close-button>
          <ui5-busy-indicator active :delay="0" size="S" style="margin-right: 8px; vertical-align: middle;" />
          Syncing source tenant snapshot to Git...
        </ui5-message-strip>
        <template v-else-if="sourceStatus === 'failed'">
          <ui5-message-strip design="Negative" hide-close-button>
            Source tenant sync failed: {{ sourceError }}
          </ui5-message-strip>
          <ui5-button design="Transparent" @click="handleRetry('source')">Retry</ui5-button>
        </template>
      </div>

      <div v-if="targetStatus !== 'completed'" class="snapshot-status">
        <ui5-message-strip v-if="targetStatus === 'syncing'" design="Information" hide-close-button>
          <ui5-busy-indicator active :delay="0" size="S" style="margin-right: 8px; vertical-align: middle;" />
          Syncing target tenant snapshot to Git...
        </ui5-message-strip>
        <template v-else-if="targetStatus === 'failed'">
          <ui5-message-strip design="Negative" hide-close-button>
            Target tenant sync failed: {{ targetError }}
          </ui5-message-strip>
          <ui5-button design="Transparent" @click="handleRetry('target')">Retry</ui5-button>
        </template>
      </div>
    </template>

    <template v-else>
      <ui5-message-strip v-if="sourceVersionMismatch" design="Information" hide-close-button style="margin-bottom: 0.75rem;">
        {{ sourceVersionMismatch }}
      </ui5-message-strip>

      <ui5-message-strip v-if="error" design="Negative" hide-close-button style="margin-bottom: 1rem;">
        {{ error }}
      </ui5-message-strip>

      <template v-if="hasDiff || patchesCache.length">
        <!-- Compare info + toolbar -->
        <div class="diff-toolbar">
          <div class="diff-toolbar-start">
            <span class="compare-info">
              {{ compareInfo.sourceTenant }} v{{ compareInfo.sourceVersion }}
              <span class="compare-arrow">→</span>
              {{ compareInfo.targetTenant }} v{{ compareInfo.targetVersion }}
            </span>
            <div class="diff-stats">
              <span class="stat-item stat-added" v-if="fileStats.added">+{{ fileStats.added }}</span>
              <span class="stat-item stat-modified" v-if="fileStats.modified">~{{ fileStats.modified }}</span>
              <span class="stat-item stat-deleted" v-if="fileStats.deleted">-{{ fileStats.deleted }}</span>
              <span class="stat-item stat-unchanged">{{ fileStats.unchanged }} unchanged</span>
            </div>
          </div>

          <div class="diff-toolbar-end">
            <ui5-segmented-button>
              <ui5-segmented-button-item :selected="outputFormat === 'side-by-side'"
                @click="outputFormat = 'side-by-side'" tooltip="Side by Side">
                Split
              </ui5-segmented-button-item>
              <ui5-segmented-button-item :selected="outputFormat === 'line-by-line'"
                @click="outputFormat = 'line-by-line'" tooltip="Unified View">
                Unified
              </ui5-segmented-button-item>
            </ui5-segmented-button>

            <ui5-segmented-button style="margin-left: 8px;">
              <ui5-segmented-button-item :selected="diffMatchStyle === 'word'"
                @click="diffMatchStyle = 'word'" tooltip="Word-level diff">
                Word
              </ui5-segmented-button-item>
              <ui5-segmented-button-item :selected="diffMatchStyle === 'char'"
                @click="diffMatchStyle = 'char'" tooltip="Character-level diff">
                Char
              </ui5-segmented-button-item>
            </ui5-segmented-button>
          </div>
        </div>

        <!-- Diff content (Diff2HtmlUI manages this element) -->
        <div ref="diffContainerRef" class="diff-container" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.code-compare-viewer { width: 100%; }
.code-compare-viewer :deep(ui5-message-strip) { width: auto; }
.snapshot-status { margin-bottom: 0.75rem; display: flex; align-items: center; gap: 4px; }

/* Toolbar */
.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px 6px 0 0;
  margin-bottom: 0;
}
.diff-toolbar-start { display: flex; align-items: center; gap: 12px; }
.diff-toolbar-end { display: flex; align-items: center; }

.compare-info { font-size: 0.85rem; color: #24292f; }
.compare-arrow { color: #656d76; margin: 0 4px; }

.diff-stats { display: flex; gap: 6px; font-size: 0.8rem; }
.stat-item { padding: 2px 6px; border-radius: 3px; font-weight: 500; }
.stat-added { background: #dafbe1; color: #1a7f37; }
.stat-modified { background: #fff8c5; color: #9a6700; }
.stat-deleted { background: #ffebe9; color: #cf222e; }
.stat-unchanged { color: #656d76; }

/* Diff container — let Diff2HtmlUI manage layout */
.diff-container {
  border: 1px solid #d0d7de;
  border-top: none;
  border-radius: 0 0 6px 6px;
}
</style>
