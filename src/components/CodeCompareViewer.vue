<script setup lang="ts">
import { ref, watch } from 'vue'
import { GetGitSnapshots, GetSnapshotFiles, type SnapshotFileEntry, type SnapshotFilesResponse } from '@/service/api'
import { createPatch } from 'diff'
import { html as diff2htmlRender } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/MessageStrip.js"

const props = defineProps<{
  artifactId: string
  artifactVersion: string
  sourceTenantId: number
  targetTenantId: number
}>()

const loading = ref(false)
const error = ref('')
const diffHtml = ref('')
const fileStats = ref<{ added: number; deleted: number; modified: number; unchanged: number }>({ added: 0, deleted: 0, modified: 0, unchanged: 0 })

// File type to language mapping for syntax highlighting context
function getFileLanguage(path: string): string {
  if (path.endsWith('.groovy') || path.endsWith('.gsh')) return 'groovy'
  if (path.endsWith('.xml') || path.endsWith('.iflw') || path.endsWith('.wsdl') || path.endsWith('.xsd') || path.endsWith('.edmx')) return 'xml'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.prop') || path.endsWith('.propdef') || path.endsWith('.properties')) return 'properties'
  return 'text'
}

async function loadCompare() {
  if (!props.artifactId || !props.sourceTenantId || !props.targetTenantId) return

  loading.value = true
  error.value = ''
  diffHtml.value = ''
  fileStats.value = { added: 0, deleted: 0, modified: 0, unchanged: 0 }

  try {
    // Find snapshots for both sides
    const [sourceSnapshots, targetSnapshots] = await Promise.all([
      GetGitSnapshots(props.artifactId, props.sourceTenantId),
      GetGitSnapshots(props.artifactId, props.targetTenantId),
    ])

    // Use the latest snapshot matching the artifact version on each side
    const sourceSnap = sourceSnapshots?.find((s: any) => s.version === props.artifactVersion)
    const targetSnap = targetSnapshots?.[0] // latest on target

    if (!sourceSnap) {
      error.value = `No synced snapshot found for ${props.artifactId} v${props.artifactVersion} on source tenant.`
      return
    }
    if (!targetSnap) {
      error.value = `No synced snapshot found for ${props.artifactId} on target tenant.`
      return
    }

    // Fetch files from both sides in parallel
    const [sourceFiles, targetFiles] = await Promise.all([
      GetSnapshotFiles(sourceSnap.ID),
      GetSnapshotFiles(targetSnap.ID),
    ])

    // Compute diffs
    const patches = computePatches(sourceFiles, targetFiles)
    if (!patches.length) {
      error.value = 'No differences found between the two versions.'
      return
    }

    // Render with diff2html
    const combinedPatch = patches.join('\n')
    diffHtml.value = diff2htmlRender(combinedPatch, {
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

    // Skip binary files
    if (sf?.isBinary || tf?.isBinary) continue

    const sourceContent = sf?.content || ''
    const targetContent = tf?.content || ''

    if (sourceContent === targetContent) {
      unchanged++
      continue
    }

    if (!sf) {
      deleted++ // file exists in target but not source (target is "old", source is "new")
    } else if (!tf) {
      added++
    } else {
      modified++
    }

    // Generate unified diff patch
    const patch = createPatch(
      path,
      targetContent, // old (target = what's deployed)
      sourceContent, // new (source = what we want to deliver)
      `${target.tenant} v${target.version}`,
      `${source.tenant} v${source.version}`,
    )
    patches.push(patch)
  }

  fileStats.value = { added, deleted, modified, unchanged }
  return patches
}

watch(() => [props.artifactId, props.artifactVersion, props.sourceTenantId, props.targetTenantId], () => {
  loadCompare()
}, { immediate: true })
</script>

<template>
  <div class="code-compare-viewer">
    <ui5-busy-indicator v-if="loading" active :delay="0" style="display: flex; justify-content: center; padding: 2rem;" />

    <ui5-message-strip v-else-if="error" design="Warning" hide-close-button style="margin-bottom: 1rem;">
      {{ error }}
    </ui5-message-strip>

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

/* diff2html overrides for better integration */
.diff-container :deep(.d2h-wrapper) {
  font-family: var(--sapFontMonospaceFamily, monospace);
  font-size: 0.8rem;
}

.diff-container :deep(.d2h-file-header) {
  background: var(--sapList_HeaderBackground);
  border-bottom: 1px solid var(--sapList_BorderColor);
}
</style>
