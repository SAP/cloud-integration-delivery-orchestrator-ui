<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { GetGitSnapshots, GetSnapshotFiles, TriggerGitSync, type GitSnapshot } from '@/service/api'
import { buildCompareFiles, type CompareFileItem } from '@/service/codeCompareFiles'
import { Diff2HtmlUI } from 'diff2html/lib-esm/ui/js/diff2html-ui-base'
import 'diff2html/bundles/css/diff2html.min.css'

import BpmnCompareDialog from '@/components/BpmnCompareDialog.vue'
import IflowCompareCard from '@/components/IflowCompareCard.vue'

import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Icon.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/Link.js"
import "@ui5/webcomponents/dist/SegmentedButton.js"
import "@ui5/webcomponents/dist/SegmentedButtonItem.js"
import "@ui5/webcomponents-icons/dist/full-screen.js"
import "@ui5/webcomponents-icons/dist/exit-full-screen.js"
import "@ui5/webcomponents-icons/dist/chain-link.js"
import "@ui5/webcomponents-icons/dist/arrow-right.js"

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
const compareInfo = ref({ sourceTenant: '', sourceVersion: '', targetTenant: '', targetVersion: '', sourceCommitUrl: '', targetCommitUrl: '' })

// Toolbar controls
const outputFormat = ref<'side-by-side' | 'line-by-line'>('side-by-side')
const diffMatchStyle = ref<'word' | 'char'>('word')
const patchesCache = ref<string[]>([])
const iflowFiles = ref<CompareFileItem[]>([])
const selectedIflow = ref<CompareFileItem | null>(null)
const bpmnDialogOpen = ref(false)

// Sync status
type SnapshotDisplayStatus = 'loading' | 'syncing' | 'completed' | 'failed'
// Outcome of resolving one side (source/target) independently.
type SideOutcome =
  | { kind: 'completed'; snap: GitSnapshot }
  | { kind: 'failed' }
  | { kind: 'pending' } // still syncing within timeout → caller should poll
  | { kind: 'not_found' } // artifact does not exist on this tenant (first delivery)
const sourceStatus = ref<SnapshotDisplayStatus>('loading')
const targetStatus = ref<SnapshotDisplayStatus>('loading')
const sourceError = ref('')
const targetError = ref('')
const sourceVersionMismatch = ref('')
const targetNotFound = ref(false)

const diffContainerRef = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let generation = 0 // incremented each loadCompare; stale resolveSide results are discarded

function isCurrent(gen: number): boolean {
  return gen === generation
}

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

function renderDiff(gen: number) {
  if (
    !isCurrent(gen)
    || !patchesCache.value.length
    || !diffContainerRef.value
  ) return

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
  if (!isCurrent(gen)) return
  hasDiff.value = true
}

// --- Data loading ---

function resolveSourceSnapshot(
  snapshots: GitSnapshot[],
  gen: number,
): GitSnapshot | undefined {
  if (!snapshots.length) return undefined
  const exact = snapshots.find(s => s.version === props.artifactVersion && s.status === 'completed')
  if (exact) return exact
  const latestCompleted = snapshots.find(s => s.status === 'completed')
  if (latestCompleted && compareCPIVersion(latestCompleted.version, props.artifactVersion) > 0) {
    if (isCurrent(gen)) {
      sourceVersionMismatch.value = `Source is v${latestCompleted.version}, DR references v${props.artifactVersion}`
    }
    return latestCompleted
  }
  return snapshots.find(s => s.version === props.artifactVersion)
    || snapshots.find(s => s.status === 'not_found')
    || undefined
}

function resolveTargetSnapshot(snapshots: GitSnapshot[]): GitSnapshot | undefined {
  if (!snapshots.length) return undefined
  return snapshots.find(s => s.status === 'completed') || snapshots[0] || undefined
}

async function loadCompare() {
  stopPoll()
  const gen = ++generation // stale-request guard
  if (!props.artifactId || !props.sourceTenantId || !props.targetTenantId) return

  loading.value = true
  error.value = ''
  hasDiff.value = false
  patchesCache.value = []
  iflowFiles.value = []
  selectedIflow.value = null
  bpmnDialogOpen.value = false
  fileStats.value = { added: 0, deleted: 0, modified: 0, unchanged: 0 }
  sourceStatus.value = 'loading'
  targetStatus.value = 'loading'
  sourceError.value = ''
  targetError.value = ''
  sourceVersionMismatch.value = ''
  targetNotFound.value = false

  // === Phase 1: initial snapshot query (both sides) ===
  let sourceSnapshots: GitSnapshot[]
  let targetSnapshots: GitSnapshot[]
  try {
    ;[sourceSnapshots, targetSnapshots] = await Promise.all([
      GetGitSnapshots(props.artifactId, props.sourceTenantId),
      GetGitSnapshots(props.artifactId, props.targetTenantId),
    ])
  } catch (e: any) {
    if (!isCurrent(gen)) return // superseded
    loading.value = false
    error.value = e?.message || 'Failed to query snapshots'
    return
  }
  if (!isCurrent(gen)) return // superseded

  // Flip loading off so per-side status (syncing/failed) is visible during Phase 2.
  loading.value = false

  // === Phase 2: resolve each side independently (may auto-trigger) ===
  const [source, target] = await Promise.all([
    resolveSide('source', sourceSnapshots, gen),
    resolveSide('target', targetSnapshots, gen),
  ])
  if (!isCurrent(gen)) return // superseded

  // === Phase 3: decide next step ===
  if (source.kind === 'not_found' && target.kind === 'not_found') {
    error.value = 'Artifact not found on either tenant.'
    return
  }
  if (source.kind === 'not_found') {
    error.value = 'Source artifact not found on source tenant.'
    return
  }
  if (target.kind === 'not_found') {
    // First delivery — target has no baseline. Show source files as all-added.
    if (isCurrent(gen)) targetNotFound.value = true
    if (source.kind === 'completed') return loadDiff(source.snap, null, gen)
  }
  if (source.kind === 'completed' && target.kind === 'completed') {
    return loadDiff(source.snap, target.snap, gen)
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
async function resolveSide(
  side: 'source' | 'target',
  snapshots: GitSnapshot[],
  gen: number,
): Promise<SideOutcome> {
  const isSource = side === 'source'
  const tenantId = isSource ? props.sourceTenantId : props.targetTenantId
  const staleOutcome = (): SideOutcome => ({ kind: 'pending' })
  const setStatus = (s: SnapshotDisplayStatus) => {
    if (isCurrent(gen)) (isSource ? sourceStatus : targetStatus).value = s
  }
  const setError = (msg: string) => {
    if (isCurrent(gen)) (isSource ? sourceError : targetError).value = msg
  }
  const resolve = (list: GitSnapshot[]) =>
    isSource ? resolveSourceSnapshot(list, gen) : resolveTargetSnapshot(list)

  if (!isCurrent(gen)) return staleOutcome()
  const snap = resolve(snapshots)

  if (snap?.status === 'completed') { setStatus('completed'); return { kind: 'completed', snap } }
  if (snap?.status === 'not_found') { setStatus('completed'); return { kind: 'not_found' } }
  if (snap?.status === 'failed') { setStatus('failed'); setError(snap.error || 'Unknown error'); return { kind: 'failed' } }
  // pending but within timeout → genuinely syncing, let the poller wait for it
  if (snap && !isStuck(snap)) { setStatus('syncing'); return { kind: 'pending' } }

  // stuck snapshot OR no snapshot at all → auto-trigger once (backend trigger is synchronous)
  setStatus('syncing')
  try {
    await TriggerGitSync({ artifactId: props.artifactId, cpiTenantId: tenantId, artifactType: props.artifactType, packageId: props.packageId })
  } catch (e: any) {
    if (!isCurrent(gen)) return staleOutcome()
    setStatus('failed'); setError(e?.message || 'Sync failed'); return { kind: 'failed' }
  }
  if (!isCurrent(gen)) return staleOutcome()

  // Re-query after the trigger resolves.
  let after: GitSnapshot[]
  try {
    after = await GetGitSnapshots(props.artifactId, tenantId)
  } catch (e: any) {
    if (!isCurrent(gen)) return staleOutcome()
    setStatus('failed'); setError(e?.message || 'Failed to query snapshots after sync'); return { kind: 'failed' }
  }
  if (!isCurrent(gen)) return staleOutcome()

  const snap2 = resolve(after)
  if (snap2?.status === 'completed') { setStatus('completed'); return { kind: 'completed', snap: snap2 } }
  if (snap2?.status === 'not_found') { setStatus('completed'); return { kind: 'not_found' } }
  if (snap2?.status === 'failed') { setStatus('failed'); setError(snap2.error || 'Unknown error'); return { kind: 'failed' } }
  setStatus('syncing'); return { kind: 'pending' }
}

async function loadDiff(
  sourceSnap: GitSnapshot,
  targetSnap: GitSnapshot | null,
  gen: number,
) {
  if (!isCurrent(gen)) return
  loading.value = true
  try {
    const emptyFiles = { snapshotId: 0, artifactId: '', version: '', tenant: '', files: [] }
    const [sourceFiles, targetFiles] = await Promise.all([
      GetSnapshotFiles(sourceSnap.ID),
      targetSnap ? GetSnapshotFiles(targetSnap.ID) : Promise.resolve(emptyFiles),
    ])
    if (!isCurrent(gen)) return

    const result = buildCompareFiles(sourceFiles, targetFiles)
    if (!isCurrent(gen)) return
    compareInfo.value = {
      sourceTenant: sourceFiles.tenant,
      sourceVersion: sourceFiles.version,
      targetTenant: targetFiles.tenant || '(new)',
      targetVersion: targetFiles.version || '—',
      sourceCommitUrl: sourceSnap.commitUrl || '',
      targetCommitUrl: targetSnap?.commitUrl || '',
    }
    fileStats.value = result.stats
    patchesCache.value = result.textPatches
    iflowFiles.value = result.iflowFiles

    if (!result.textPatches.length && !result.iflowFiles.length) {
      error.value = 'No differences found between the two versions.'
      return
    }

    hasDiff.value = true
  } catch (e: any) {
    if (!isCurrent(gen)) return
    error.value = e?.message || 'Failed to load diff'
    return
  } finally {
    if (isCurrent(gen)) loading.value = false
  }

  if (!isCurrent(gen) || !patchesCache.value.length) return

  // loading is now false → the v-else branch (and diff container) is rendered.
  // Wait for the DOM flush so diffContainerRef is attached before drawing.
  await nextTick()
  if (!isCurrent(gen)) return
  renderDiff(gen)
}

// Poll is tenant-agnostic: it just waits until BOTH sides report completed (or times
// out), then re-runs loadCompare to render the diff. Uses setTimeout chaining (not
// setInterval) to prevent overlapping iterations when network is slow.
function startPoll(gen: number) {
  const startedAt = Date.now()

  function scheduleNext() {
    pollTimer = setTimeout(async () => {
      if (!isCurrent(gen)) return // superseded by a new loadCompare
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
        if (!isCurrent(gen)) return // superseded
        if (resolveSourceSnapshot(sourceSnapshots, gen)?.status === 'completed') sourceStatus.value = 'completed'
        if (resolveTargetSnapshot(targetSnapshots)?.status === 'completed') targetStatus.value = 'completed'

        if (sourceStatus.value === 'completed' && targetStatus.value === 'completed') {
          loadCompare()
          return
        }
      } catch {
        // Transient query error — retry on next iteration.
      }
      if (isCurrent(gen)) scheduleNext()
    }, POLL_INTERVAL_MS)
  }

  scheduleNext()
}

function stopPoll() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
}

async function handleRetry(side: 'source' | 'target') {
  const gen = generation
  const isSource = side === 'source'
  const setStatus = (s: SnapshotDisplayStatus) => {
    if (isCurrent(gen)) (isSource ? sourceStatus : targetStatus).value = s
  }
  const setError = (msg: string) => {
    if (isCurrent(gen)) (isSource ? sourceError : targetError).value = msg
  }

  setStatus('syncing')
  setError('')
  try {
    await TriggerGitSync({
      artifactId: props.artifactId,
      cpiTenantId: isSource ? props.sourceTenantId : props.targetTenantId,
      artifactType: props.artifactType,
      packageId: props.packageId,
    })
    if (!isCurrent(gen)) return
    // Re-evaluate both sides; the retried side is now completed.
    await loadCompare()
  } catch (e: any) {
    if (!isCurrent(gen)) return
    setStatus('failed')
    setError(e?.message || 'Sync failed')
  }
}

function openBpmnDiff(file: CompareFileItem) {
  selectedIflow.value = file
  bpmnDialogOpen.value = true
}

function closeBpmnDiff() {
  bpmnDialogOpen.value = false
  selectedIflow.value = null
}

// Re-render on toolbar changes (no re-fetch needed)
watch([outputFormat, diffMatchStyle], () => {
  if (patchesCache.value.length) {
    const gen = generation
    nextTick(() => {
      if (isCurrent(gen)) renderDiff(gen)
    })
  }
})

// Re-fetch on props change
watch(() => [props.artifactId, props.artifactVersion, props.sourceTenantId, props.targetTenantId], () => {
  loadCompare()
}, { immediate: true })

onUnmounted(() => {
  generation += 1
  stopPoll()
  closeBpmnDiff()
})
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

      <ui5-message-strip v-if="targetNotFound" design="Information" hide-close-button style="margin-bottom: 0.75rem;">
        Target artifact is new (no baseline on target tenant). All files shown as added.
      </ui5-message-strip>

      <ui5-message-strip v-if="error" design="Negative" hide-close-button style="margin-bottom: 1rem;">
        {{ error }}
      </ui5-message-strip>

      <template v-if="hasDiff || patchesCache.length">
        <!-- Compare info line -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.85rem;">
          <ui5-link v-if="compareInfo.sourceCommitUrl" :href="compareInfo.sourceCommitUrl" target="_blank" icon="chain-link" design="Emphasized" style="font-size: 1rem;">{{ compareInfo.sourceTenant }} v{{ compareInfo.sourceVersion }}</ui5-link>
          <span v-else style="font-weight: 500; font-size: 1rem;">{{ compareInfo.sourceTenant }} v{{ compareInfo.sourceVersion }}</span>
          <ui5-icon name="arrow-right" style="color: #656d76; font-size: 0.85rem;" />
          <ui5-link v-if="compareInfo.targetCommitUrl" :href="compareInfo.targetCommitUrl" target="_blank" icon="chain-link" design="Emphasized" style="font-size: 1rem;">{{ compareInfo.targetTenant }} v{{ compareInfo.targetVersion }}</ui5-link>
          <span v-else style="font-weight: 500; font-size: 1rem;">{{ compareInfo.targetTenant }} v{{ compareInfo.targetVersion }}</span>

          <span style="margin-left: auto; display: flex; gap: 5px; font-size: 0.78rem;">
            <span v-if="fileStats.added" style="padding: 1px 5px; border-radius: 3px; background: #dafbe1; color: #1a7f37;">+{{ fileStats.added }}</span>
            <span v-if="fileStats.modified" style="padding: 1px 5px; border-radius: 3px; background: #fff8c5; color: #9a6700;">~{{ fileStats.modified }}</span>
            <span v-if="fileStats.deleted" style="padding: 1px 5px; border-radius: 3px; background: #ffebe9; color: #cf222e;">-{{ fileStats.deleted }}</span>
            <span style="color: #656d76;">{{ fileStats.unchanged }} unchanged</span>
          </span>

          <ui5-segmented-button
            accessible-name="Diff layout"
            style="margin-left: 8px;"
          >
            <ui5-segmented-button-item :selected="outputFormat === 'side-by-side'"
              @click="outputFormat = 'side-by-side'" icon="full-screen" tooltip="Side by Side (展开)" />
            <ui5-segmented-button-item :selected="outputFormat === 'line-by-line'"
              @click="outputFormat = 'line-by-line'" icon="exit-full-screen" tooltip="Unified (折叠)" />
          </ui5-segmented-button>
          <ui5-segmented-button accessible-name="Diff granularity">
            <ui5-segmented-button-item :selected="diffMatchStyle === 'word'"
              @click="diffMatchStyle = 'word'" tooltip="Word-level diff">W</ui5-segmented-button-item>
            <ui5-segmented-button-item :selected="diffMatchStyle === 'char'"
              @click="diffMatchStyle = 'char'" tooltip="Character-level diff">C</ui5-segmented-button-item>
          </ui5-segmented-button>
        </div>

        <div v-if="iflowFiles.length" class="iflow-files">
          <IflowCompareCard
            v-for="file in iflowFiles"
            :key="file.path"
            :file="file"
            :output-format="outputFormat"
            :diff-match-style="diffMatchStyle"
            @open-visual="openBpmnDiff"
          />
        </div>

        <!-- Diff content (Diff2HtmlUI manages this element) -->
        <div
          v-if="patchesCache.length"
          ref="diffContainerRef"
          class="diff-container"
        />
      </template>
    </template>

    <BpmnCompareDialog
      :open="bpmnDialogOpen"
      :file="selectedIflow"
      :left-label="`${compareInfo.targetTenant} v${compareInfo.targetVersion}`"
      :right-label="`${compareInfo.sourceTenant} v${compareInfo.sourceVersion}`"
      @close="closeBpmnDiff"
    />
  </div>
</template>

<style scoped>
.code-compare-viewer { width: 100%; }
.snapshot-status { margin-bottom: 0.75rem; display: flex; align-items: center; gap: 4px; }
.iflow-files { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
</style>
