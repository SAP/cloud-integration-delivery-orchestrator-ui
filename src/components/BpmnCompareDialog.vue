<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue'
import '@ui5/webcomponents/dist/BusyIndicator.js'
import '@ui5/webcomponents/dist/Card.js'
import '@ui5/webcomponents/dist/CardHeader.js'
import '@ui5/webcomponents/dist/CheckBox.js'
import '@ui5/webcomponents/dist/Dialog.js'
import '@ui5/webcomponents/dist/Tag.js'
import '@ui5/webcomponents/dist/Toolbar.js'
import '@ui5/webcomponents/dist/ToolbarButton.js'
import '@ui5/webcomponents/dist/ToolbarSeparator.js'
import '@ui5/webcomponents/dist/ToolbarSpacer.js'

import type {
  BpmnDiffSide,
  BpmnElementChange,
} from '@/bpmn/diff'
import type { BpmnViewerHandle } from '@/bpmn/viewer'
import type { CompareFileItem } from '@/service/codeCompareFiles'

const props = defineProps<{
  open: boolean
  file: CompareFileItem | null
  leftLabel: string
  rightLabel: string
}>()

const emit = defineEmits<{
  close: []
}>()

type FailureSide = BpmnDiffSide | 'general'
type ViewPhase = 'idle' | 'loading' | 'ready'

interface Failure {
  key: string
  side: FailureSide
  text: string
}

interface ViewerWarning {
  key: string
  side: BpmnDiffSide
  message: string
}

const FALLBACK_MESSAGE =
  'Close this dialog and use Text Diff.'

const leftCanvas = ref<HTMLElement | null>(null)
const rightCanvas = ref<HTMLElement | null>(null)
const leftViewer = shallowRef<BpmnViewerHandle | null>(null)
const rightViewer = shallowRef<BpmnViewerHandle | null>(null)
const changes = shallowRef<BpmnElementChange[]>([])
const failures = ref<Failure[]>([])
const warnings = ref<ViewerWarning[]>([])
const phase = ref<ViewPhase>('idle')
const hideLayoutOnly = ref(true)
const leftReady = ref(false)
const rightReady = ref(false)
// Single source of truth for the list↔canvas bidirectional binding. A non-null
// id means that change card is expanded AND its canvas element is emphasized on
// both sides. Clicking a card or a canvas element funnels through selectChange.
const selectedElementId = ref<string | null>(null)
// Per-selection toggle: unchanged config rows stay hidden until the user opts in.
const showFullConfig = ref(false)

let generation = 0
let closeEmitted = !props.open
let dialogActuallyOpen = false
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null
let fitScheduled = false
let viewboxSyncCleanup: (() => void) | null = null
let elementClickCleanup: (() => void) | null = null

const hasLeftSide = computed(
  () => props.file !== null && props.file.status !== 'added',
)
const hasRightSide = computed(
  () => props.file !== null && props.file.status !== 'deleted',
)
const visibleChanges = computed(() =>
  changes.value.filter(
    change => !hideLayoutOnly.value || change.status !== 'layout-only',
  ),
)
// Per-status totals over the *full* change set (independent of the
// hide-layout-only filter) so the summary shows a complete breakdown.
const statusCounts = computed(() => {
  const counts = { added: 0, removed: 0, changed: 0, 'layout-only': 0 }
  for (const change of changes.value) counts[change.status] += 1
  return counts
})
const leftFailure = computed(() =>
  failures.value.find(failure => failure.side === 'left'),
)
const rightFailure = computed(() =>
  failures.value.find(failure => failure.side === 'right'),
)
const generalFailure = computed(() =>
  failures.value.find(failure => failure.side === 'general'),
)
const leftCanvasFailure = computed(
  () => leftFailure.value ?? generalFailure.value,
)
const rightCanvasFailure = computed(
  () => rightFailure.value ?? generalFailure.value,
)

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (
    error !== null
    && typeof error === 'object'
    && 'message' in error
  ) {
    return String(error.message)
  }
  return String(error)
}

function addFailure(
  side: FailureSide,
  error: unknown,
  path = props.file?.path ?? 'Unknown BPMN file',
) {
  const sideLabel = side === 'left'
    ? 'left (Target)'
    : side === 'right'
      ? 'right (Source)'
      : 'general'
  const detail = messageFrom(error)
  const key = `${path}:${side}:${detail}`

  if (failures.value.some(failure => failure.key === key)) return

  failures.value.push({
    key,
    side,
    text: `${path} — ${sideLabel}: ${detail}. ${FALLBACK_MESSAGE}`,
  })
}

function addWarnings(side: BpmnDiffSide, items: readonly unknown[]) {
  items.forEach((warning) => {
    const message = messageFrom(warning)
    const key = `${side}:${message}`
    if (warnings.value.some(item => item.key === key)) return
    warnings.value.push({ key, side, message })
  })
}

function resetViewState() {
  changes.value = []
  failures.value = []
  warnings.value = []
  phase.value = 'idle'
  hideLayoutOnly.value = true
  leftReady.value = false
  rightReady.value = false
  selectedElementId.value = null
}

function destroyViewers() {
  const viewers = [leftViewer.value, rightViewer.value]
  leftViewer.value = null
  rightViewer.value = null
  leftReady.value = false
  rightReady.value = false

  viewers.forEach((viewer) => {
    try {
      viewer?.destroy()
    } catch {
      // Closing must remain safe even if a third-party viewer fails teardown.
    }
  })
}

function stopResizeMonitoring() {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame)
  }
  resizeFrame = null
  fitScheduled = false
}

function stopViewboxSync() {
  viewboxSyncCleanup?.()
  viewboxSyncCleanup = null
}

function startViewboxSync() {
  stopViewboxSync()
  const left = leftViewer.value
  const right = rightViewer.value
  if (!left || !right) return

  let syncing = false
  const unsubLeft = left.onViewboxChanged((viewbox) => {
    if (syncing) return
    syncing = true
    right.setViewbox(viewbox)
    syncing = false
  })
  const unsubRight = right.onViewboxChanged((viewbox) => {
    if (syncing) return
    syncing = true
    left.setViewbox(viewbox)
    syncing = false
  })
  viewboxSyncCleanup = () => { unsubLeft(); unsubRight() }
}

function stopElementClickSync() {
  elementClickCleanup?.()
  elementClickCleanup = null
}

// Canvas → list half of the bidirectional binding: subscribe to element clicks
// on both viewers so clicking any BPMN element selects its change card (and, via
// selectChange, re-emphasizes the element on both sides). Clicks on elements
// without a visible change clear the selection.
function startElementClickSync() {
  stopElementClickSync()
  const left = leftViewer.value
  const right = rightViewer.value
  const unsubs: Array<() => void> = []
  if (left) unsubs.push(left.onElementClick(handleCanvasClick))
  if (right) unsubs.push(right.onElementClick(handleCanvasClick))
  if (unsubs.length === 0) return
  elementClickCleanup = () => unsubs.forEach(unsub => unsub())
}

function invalidate() {
  generation += 1
  stopResizeMonitoring()
  stopViewboxSync()
  stopElementClickSync()
  destroyViewers()
  resetViewState()
}

function isCurrent(token: number, file: CompareFileItem) {
  return (
    generation === token
    && props.open
    && props.file === file
  )
}

function runViewerAction(
  side: BpmnDiffSide,
  action: (viewer: BpmnViewerHandle) => void,
) {
  const viewer = side === 'left' ? leftViewer.value : rightViewer.value
  const ready = side === 'left' ? leftReady.value : rightReady.value
  if (!viewer || !ready) return

  try {
    action(viewer)
  } catch (error) {
    addFailure(side, error)
  }
}

function applyCurrentChanges() {
  const showLayoutOnly = !hideLayoutOnly.value
  runViewerAction('left', viewer => {
    viewer.applyChanges(changes.value, 'left', showLayoutOnly)
  })
  runViewerAction('right', viewer => {
    viewer.applyChanges(changes.value, 'right', showLayoutOnly)
  })
}

function scheduleFit(token: number, file: CompareFileItem, enableSync = false) {
  if (fitScheduled) return

  fitScheduled = true
  const frame = requestAnimationFrame(() => {
    fitScheduled = false
    resizeFrame = null
    if (!isCurrent(token, file)) return
    // Fitting is an independent per-side operation. Pause viewbox sync while both
    // sides fit, otherwise an asymmetric diff (e.g. an added lane on one side) would
    // couple both canvases onto whichever side fitted last. Restore sync afterwards.
    const hadSync = viewboxSyncCleanup !== null
    stopViewboxSync()
    runViewerAction('left', viewer => viewer.fit())
    runViewerAction('right', viewer => viewer.fit())
    if (hadSync || enableSync) startViewboxSync()
  })
  if (fitScheduled) resizeFrame = frame
}

function startResizeMonitoring(token: number, file: CompareFileItem) {
  if (typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver(() => {
    if (resizeObserver !== observer || !isCurrent(token, file)) return
    scheduleFit(token, file)
  })
  resizeObserver = observer

  if (hasLeftSide.value && leftCanvas.value) {
    observer.observe(leftCanvas.value)
  }
  if (hasRightSide.value && rightCanvas.value) {
    observer.observe(rightCanvas.value)
  }
}

function handleLayoutToggle(event: Event) {
  hideLayoutOnly.value = (
    event.currentTarget as EventTarget & { checked: boolean }
  ).checked
  applyCurrentChanges()
}

// List → canvas + canvas → list funnel through here (single source of truth).
// Passing null clears the selection on both sides; passing an id emphasizes that
// element on both viewers and marks the matching card selected.
function selectChange(id: string | null) {
  selectedElementId.value = id
  showFullConfig.value = false
  if (id === null) {
    runViewerAction('left', viewer => viewer.clearSelection())
    runViewerAction('right', viewer => viewer.clearSelection())
    return
  }
  runViewerAction('left', viewer => viewer.select(id))
  runViewerAction('right', viewer => viewer.select(id))
}

// Card click: toggle — re-clicking the selected card collapses it.
function activateChange(change: BpmnElementChange) {
  selectChange(selectedElementId.value === change.id ? null : change.id)
}

// Canvas click: select the matching card if the element has a visible change,
// otherwise clear. Scrolls the card into view so the detail is not off-screen.
function handleCanvasClick(id: string) {
  const matched = visibleChanges.value.some(change => change.id === id)
  if (!matched) {
    selectChange(null)
    return
  }
  selectChange(id)
  void nextTick(() => scrollCardIntoView(id))
}

function scrollCardIntoView(id: string) {
  const card = document.querySelector(`[data-change-id="${CSS.escape(id)}"]`)
  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.length > 60 ? value.slice(0, 57) + '…' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return '[object]'
  return String(value)
}

interface DiffRow {
  key: string
  oldValue: string
  newValue: string
}

// Merge the two change channels (differ top-level attrs + CPI ifl:property) into
// one Configuration | Old | New table. attrs carry structured old/new; properties
// are already {key, oldValue, newValue}. Both normalized through formatAttrValue.
function changedRows(change: BpmnElementChange): DiffRow[] {
  const rows: DiffRow[] = []
  if (change.attrs) {
    for (const [key, detail] of Object.entries(change.attrs)) {
      rows.push({
        key,
        oldValue: formatAttrValue(detail.oldValue),
        newValue: formatAttrValue(detail.newValue),
      })
    }
  }
  if (change.properties) {
    for (const prop of change.properties) {
      rows.push({
        key: prop.key,
        oldValue: prop.oldValue ?? '—',
        newValue: prop.newValue ?? '—',
      })
    }
  }
  return rows
}

interface ConfigRow {
  key: string
  value: string
}

// Full-configuration drill-down, minus the rows already shown as changed. These
// are appended to the same table (spanning old/new) and stay hidden until the
// user expands full configuration, so the default view is just what moved.
function unchangedRows(change: BpmnElementChange): ConfigRow[] {
  if (!change.detail) return []
  const changedKeys = new Set(changedRows(change).map(row => row.key))
  const rows: ConfigRow[] = []
  for (const attr of change.detail.attributes) {
    if (!changedKeys.has(attr.key)) rows.push({ key: attr.key, value: attr.value })
  }
  for (const prop of change.detail.properties) {
    if (!changedKeys.has(prop.key)) rows.push({ key: prop.key, value: prop.value })
  }
  return rows
}

async function initialize() {
  const token = ++generation
  stopResizeMonitoring()
  destroyViewers()
  resetViewState()
  closeEmitted = false

  const file = props.file
  if (!props.open || !file) return

  phase.value = 'loading'

  try {
    const [diffRuntime, viewerRuntime] = await Promise.all([
      import('@/bpmn/diff'),
      import('@/bpmn/viewer'),
    ])
    if (!isCurrent(token, file)) return

    await nextTick()
    if (!isCurrent(token, file)) return

    if (hasLeftSide.value) {
      try {
        if (!leftCanvas.value) {
          throw new Error('Target canvas is unavailable')
        }
        leftViewer.value = viewerRuntime.createBpmnViewer(leftCanvas.value)
      } catch (error) {
        addFailure('left', error, file.path)
      }
    }

    if (hasRightSide.value) {
      try {
        if (!rightCanvas.value) {
          throw new Error('Source canvas is unavailable')
        }
        rightViewer.value = viewerRuntime.createBpmnViewer(rightCanvas.value)
      } catch (error) {
        addFailure('right', error, file.path)
      }
    }

    startResizeMonitoring(token, file)

    const leftXml = file.leftContent ?? ''
    const rightXml = file.rightContent ?? ''
    const importJobs: Promise<void>[] = []
    const importViewer = async (
      side: BpmnDiffSide,
      viewer: BpmnViewerHandle,
      xml: string,
    ) => {
      try {
        const result = await viewer.importXml(xml)
        if (!isCurrent(token, file)) return

        if (side === 'left') leftReady.value = true
        if (side === 'right') rightReady.value = true
        addWarnings(side, result.warnings)
      } catch (error) {
        if (!isCurrent(token, file)) return

        addFailure(side, error, file.path)
      }
    }

    if (leftViewer.value) {
      importJobs.push(importViewer('left', leftViewer.value, leftXml))
    }

    if (rightViewer.value) {
      importJobs.push(importViewer('right', rightViewer.value, rightXml))
    }

    await Promise.all(importJobs)
    if (!isCurrent(token, file)) return

    if (file.status === 'modified') {
      try {
        const result = await diffRuntime.computeBpmnDiff(leftXml, rightXml)
        if (!isCurrent(token, file)) return

        changes.value = result.changes
        addWarnings('left', result.warnings.left)
        addWarnings('right', result.warnings.right)
        applyCurrentChanges()
      } catch (error) {
        if (!isCurrent(token, file)) return

        if (error instanceof diffRuntime.BpmnParseError) {
          addFailure(error.side, error.originalError, file.path)
        } else {
          addFailure('general', error, file.path)
        }
      }
    }

    if (!isCurrent(token, file)) return
    phase.value = 'ready'
    startElementClickSync()
    scheduleFit(token, file, true)
  } catch (error) {
    if (!isCurrent(token, file)) return
    addFailure('general', error, file.path)
    phase.value = 'ready'
  }
}

function emitCloseOnce() {
  if (closeEmitted) return
  closeEmitted = true
  emit('close')
}

function requestClose() {
  invalidate()
  emitCloseOnce()
}

function handleDialogOpen() {
  if (!props.open || dialogActuallyOpen) return

  dialogActuallyOpen = true
  void initialize()
}

function handleDialogClose(event: Event) {
  const dialog = event.currentTarget as EventTarget & { open?: boolean }
  if (dialog.open === true) return

  dialogActuallyOpen = false
  invalidate()
  emitCloseOnce()
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen) {
      closeEmitted = false
      return
    }

    if (wasOpen) {
      closeEmitted = true
      invalidate()
    }
  },
)

watch(
  [
    () => props.file,
    () => props.file?.path,
    () => props.file?.status,
    () => props.file?.leftContent,
    () => props.file?.rightContent,
  ],
  () => {
    if (props.open && dialogActuallyOpen) {
      void initialize()
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  dialogActuallyOpen = false
  invalidate()
})
</script>

<template>
  <ui5-dialog
    class="bpmn-dialog"
    header-text="BPMN Visual Diff"
    :open="open"
    @open="handleDialogOpen"
    @close="handleDialogClose"
  >
    <div class="bpmn-dialog__surface">
      <ui5-toolbar>
        <ui5-tag
          v-if="file"
          :design="file.status === 'added' ? 'Positive' : file.status === 'deleted' ? 'Negative' : 'Critical'"
        >
          {{ file.status }}
        </ui5-tag>
        <ui5-toolbar-separator />
        <span class="toolbar-legend toolbar-legend--added">
          <svg viewBox="0 0 20 4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" /></svg>
          Added
        </span>
        <span class="toolbar-legend toolbar-legend--removed">
          <svg viewBox="0 0 20 4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke-dasharray="8 4" /></svg>
          Removed
        </span>
        <span class="toolbar-legend toolbar-legend--changed">
          <svg viewBox="0 0 20 4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke-dasharray="4 3" /></svg>
          Changed
        </span>
        <span class="toolbar-legend toolbar-legend--layout">
          <svg viewBox="0 0 20 4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke-dasharray="1 4" stroke-linecap="round" /></svg>
          Layout only
        </span>
        <ui5-toolbar-spacer />
        <ui5-checkbox
          text="Hide layout-only"
          :checked="hideLayoutOnly"
          @change="handleLayoutToggle"
        />
      </ui5-toolbar>

      <div
        v-if="warnings.length > 0"
        class="warning-summary"
        role="status"
      >
        <strong>
          {{ warnings.length }} {{ warnings.length === 1 ? 'warning' : 'warnings' }}
        </strong>
        <span>
          {{ warnings.map(item => `${item.side}: ${item.message}`).join(' · ') }}
        </span>
      </div>

      <main v-if="file" class="bpmn-dialog__layout">
        <div class="canvas-grid">
          <section class="canvas-panel" aria-labelledby="target-canvas-title">
            <header class="canvas-panel__header">
              <span class="canvas-panel__eyebrow">OLD</span>
              <h3 id="target-canvas-title">{{ leftLabel }}</h3>
            </header>

            <div class="canvas-panel__viewport">
              <div
                v-if="hasLeftSide"
                ref="leftCanvas"
                class="bpmn-dialog__canvas"
              />
              <div v-else class="canvas-placeholder">
                <strong>Not present in target</strong>
              </div>

              <div
                v-if="leftCanvasFailure"
                class="canvas-state canvas-state--error"
                role="alert"
              >
                <strong>Target rendering incomplete</strong>
                <span>{{ leftCanvasFailure.text }}</span>
              </div>
              <div
                v-else-if="phase === 'loading' && hasLeftSide"
                class="canvas-state"
                role="status"
              >
                <ui5-busy-indicator active size="M" />
                <span>Loading target BPMN…</span>
              </div>
            </div>
          </section>

          <section class="canvas-panel" aria-labelledby="source-canvas-title">
            <header class="canvas-panel__header">
              <span class="canvas-panel__eyebrow">NEW</span>
              <h3 id="source-canvas-title">{{ rightLabel }}</h3>
            </header>

            <div class="canvas-panel__viewport">
              <div
                v-if="hasRightSide"
                ref="rightCanvas"
                class="bpmn-dialog__canvas"
              />
              <div v-else class="canvas-placeholder">
                <strong>Not present in source</strong>
              </div>

              <div
                v-if="rightCanvasFailure"
                class="canvas-state canvas-state--error"
                role="alert"
              >
                <strong>Source rendering incomplete</strong>
                <span>{{ rightCanvasFailure.text }}</span>
              </div>
              <div
                v-else-if="phase === 'loading' && hasRightSide"
                class="canvas-state"
                role="status"
              >
                <ui5-busy-indicator active size="M" />
                <span>Loading source BPMN…</span>
              </div>
            </div>
          </section>
        </div>

        <section class="change-panel">
          <ui5-card class="change-panel__summary">
            <ui5-card-header
              :title-text="`Changes (${file.status === 'modified' ? changes.length : 1})`"
              :subtitle-text="file.path">
              <div
                v-if="file.status === 'modified'"
                slot="action"
                class="change-counts">
                <ui5-tag design="Positive">+{{ statusCounts.added }}</ui5-tag>
                <ui5-tag design="Negative">&minus;{{ statusCounts.removed }}</ui5-tag>
                <ui5-tag design="Critical">~{{ statusCounts.changed }}</ui5-tag>
                <ui5-tag design="Information">{{ statusCounts['layout-only'] }} layout</ui5-tag>
              </div>
            </ui5-card-header>
          </ui5-card>

          <ul
            v-if="failures.length > 0"
            class="failure-list"
            aria-label="Visual comparison errors">
            <li v-for="failure in failures" :key="failure.key">
              <strong>{{ failure.side }}</strong>
              <span>{{ failure.text }}</span>
            </li>
          </ul>

          <div v-if="phase === 'loading'" class="change-panel__status" role="status">
            Computing changes…
          </div>

          <div v-else class="change-panel__list">
            <div
              v-if="file.status !== 'modified'"
              class="change-card"
              :class="`change-card--${file.status === 'added' ? 'added' : 'removed'}`"
            >
              <ui5-card-header
                :title-text="'Entire iFlow'"
                :subtitle-text="file.status === 'added' ? 'File added' : 'File removed'"
              >
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
                <ui5-tag
                  slot="action"
                  :design="file.status === 'added' ? 'Positive' : 'Negative'"
                >
                  {{ file.status === 'added' ? 'ADDED' : 'REMOVED' }}
                </ui5-tag>
              </ui5-card-header>
            </div>

            <template v-else>
              <div
                v-for="change in visibleChanges"
                :key="change.id"
                class="change-card"
                :class="[
                  `change-card--${change.status}`,
                  { 'change-card--selected': selectedElementId === change.id },
                ]"
                :data-change-id="change.id"
              >
                <ui5-card-header
                  interactive
                  :title-text="change.name || change.id"
                  :subtitle-text="change.type"
                  @click="activateChange(change)"
                >
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
                  <ui5-tag
                    slot="action"
                    :design="change.status === 'added'
                      ? 'Positive'
                      : change.status === 'removed'
                        ? 'Negative'
                        : change.status === 'changed'
                          ? 'Critical'
                          : 'Information'"
                  >
                    {{ change.status }}
                  </ui5-tag>
                </ui5-card-header>

                <div
                  v-if="selectedElementId === change.id"
                  class="change-card__detail"
                >
                  <div
                    v-if="changedRows(change).length > 0 || unchangedRows(change).length > 0"
                    class="detail-block"
                  >
                    <table class="diff-table">
                      <thead>
                        <tr>
                          <th>Configuration</th>
                          <th>Old</th>
                          <th>New</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in changedRows(change)" :key="row.key">
                          <td class="diff-key">{{ row.key }}</td>
                          <td class="attr-old">{{ row.oldValue }}</td>
                          <td class="attr-new">{{ row.newValue }}</td>
                        </tr>
                        <template v-if="showFullConfig">
                          <tr
                            v-for="row in unchangedRows(change)"
                            :key="row.key"
                            class="config-row--unchanged"
                          >
                            <td class="diff-key">{{ row.key }}</td>
                            <td class="config-value" colspan="2">{{ row.value }}</td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                    <button
                      v-if="unchangedRows(change).length > 0"
                      type="button"
                      class="config-toggle"
                      @click="showFullConfig = !showFullConfig"
                    >
                      {{ showFullConfig ? 'Hide' : 'Show' }} full configuration ({{ unchangedRows(change).length }})
                    </button>
                  </div>

                  <div
                    v-else
                    class="change-panel__status"
                  >
                    No property-level detail
                  </div>
                </div>
              </div>

              <div
                v-if="visibleChanges.length === 0 && failures.length === 0"
                class="change-panel__status"
              >
                No BPMN element changes
              </div>
            </template>
          </div>
        </section>
      </main>
    </div>

    <!-- UI5 web components require the native slot attribute for dialog footers. -->
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
    <ui5-toolbar slot="footer" align-content="End">
      <ui5-toolbar-button
        design="Emphasized"
        text="Close"
        @click="requestClose"
      />
    </ui5-toolbar>
  </ui5-dialog>
</template>

<style scoped>
.bpmn-dialog {
  width: calc(100vw - 2rem);
  height: calc(100vh - 2rem);
}

.bpmn-dialog__surface {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--sapTextColor);
  background: var(--sapGroup_ContentBackground);
}

.toolbar-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0.375rem;
  font-size: var(--sapFontSmallSize);
  font-weight: 600;
}

.toolbar-legend svg {
  width: 1.25rem;
  height: 0.25rem;
  overflow: visible;
}

.toolbar-legend svg line {
  stroke: currentColor;
  stroke-width: 2.5;
}

.toolbar-legend--added { color: var(--sapPositiveColor); }
.toolbar-legend--removed { color: var(--sapNegativeColor); }
.toolbar-legend--changed { color: var(--sapCriticalColor); }
.toolbar-legend--layout { color: var(--sapInformationColor); }

.warning-summary {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  padding: 0.375rem 1rem;
  color: var(--sapCriticalTextColor);
  font-size: var(--sapFontSmallSize);
  background: var(--sapCriticalBackground);
  border-bottom: 1px solid var(--sapCriticalBorderColor);
}

.warning-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bpmn-dialog__layout {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 0.75rem;
  min-height: 70vh;
  padding: 0.75rem;
  background: var(--sapBackgroundColor);
}

.canvas-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  flex: 1 1 auto;
  min-width: 0;
}

.canvas-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--sapGroup_ContentBackground);
  border: 1px solid var(--sapGroup_ContentBorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
}

.canvas-panel__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2rem;
  padding: 0.375rem 0.75rem;
  background: var(--sapList_HeaderBackground);
  border-bottom: 1px solid var(--sapList_BorderColor);
}

.canvas-panel__eyebrow {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.canvas-panel__header h3 {
  margin: 0;
  font-size: var(--sapFontSize);
  line-height: 1.25rem;
}

.canvas-panel__viewport {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.bpmn-dialog__canvas {
  min-width: 0;
  min-height: 60vh;
  flex: 1 1 auto;
  background: var(--sapGroup_ContentBackground);
  border: 1px solid var(--sapGroup_ContentBorderColor);
}

.canvas-placeholder,
.canvas-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 12rem;
  padding: 1rem;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSize);
  text-align: center;
  background: var(--sapList_AlternatingBackground);
}

.canvas-placeholder {
  flex: 1 1 auto;
  min-height: 60vh;
}

.canvas-placeholder span {
  max-width: 18rem;
  font-size: var(--sapFontSmallSize);
}

.canvas-state {
  position: absolute;
  inset: 0;
  min-height: 0;
  background: var(--sapGroup_ContentBackground);
}

.canvas-state--error {
  align-items: flex-start;
  justify-content: flex-start;
  color: var(--sapNegativeTextColor);
  text-align: left;
  background: var(--sapNegativeBackground);
}

.canvas-state--error span {
  overflow-wrap: anywhere;
  font-size: var(--sapFontSmallSize);
}

.change-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 40vh;
  gap: 0.5rem;
}

.change-panel__summary {
  flex: 0 0 auto;
  width: 100%;
}

.change-counts {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Plain scrollable container (not wrapped in a ui5-card) so overflow bounds
   reliably — a card's shadow-DOM content region would not constrain slotted
   children. */
.change-panel__list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  gap: 0.5rem;
  padding: 0.25rem;
}

.change-panel__status {
  padding: 0.5rem 1rem;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSize);
  text-align: center;
}

.change-card {
  border: 1px solid var(--sapList_BorderColor);
  border-left-width: 0.25rem;
  border-radius: var(--sapElement_BorderCornerRadius);
  background: var(--sapList_Background);
}

.change-card--added { border-left-color: var(--sapPositiveColor); }
.change-card--removed { border-left-color: var(--sapNegativeColor); }
.change-card--changed { border-left-color: var(--sapCriticalColor); }
.change-card--layout-only {
  border-left-color: var(--sapInformationColor);
  border-left-style: dotted;
}

.change-card--selected {
  outline: 0.125rem solid var(--sapContent_FocusColor);
  outline-offset: -0.125rem;
}

.change-card__detail {
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid var(--sapGroup_ContentBorderColor);
}

.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--sapFontSmallSize);
}

.diff-table th {
  padding: 0.25rem 0.5rem;
  color: var(--sapContent_LabelColor);
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid var(--sapGroup_ContentBorderColor);
}

.diff-table td {
  padding: 0.25rem 0.5rem;
  vertical-align: top;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--sapList_BorderColor);
}

.diff-key {
  color: var(--sapContent_LabelColor);
  font-weight: 600;
  white-space: nowrap;
}

.attr-old {
  color: var(--sapNegativeTextColor, #bb0000);
  text-decoration: line-through;
}

.attr-new {
  color: var(--sapPositiveTextColor, #107e3e);
}

.config-row--unchanged .config-value,
.config-row--unchanged .diff-key {
  color: var(--sapContent_LabelColor);
  font-weight: 400;
}

.config-toggle {
  margin-top: 0.25rem;
  padding: 0;
  background: none;
  border: none;
  color: var(--sapLinkColor, #0064d9);
  font-size: var(--sapFontSmallSize);
  cursor: pointer;
}

.config-toggle:hover {
  text-decoration: underline;
}

.failure-list {
  display: grid;
  gap: 0.375rem;
  padding: 0.5rem;
  margin: 0;
  color: var(--sapNegativeTextColor);
  font-size: var(--sapFontSmallSize);
  list-style: none;
  background: var(--sapNegativeBackground);
  border-bottom: 1px solid var(--sapNegativeBorderColor);
}

.failure-list li {
  display: grid;
  gap: 0.125rem;
}

.failure-list strong {
  text-transform: uppercase;
}

.failure-list span {
  overflow-wrap: anywhere;
}

@media (max-width: 64rem) {
  .canvas-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .bpmn-dialog__canvas,
  .canvas-placeholder {
    min-height: 42vh;
  }
}

@media (max-width: 40rem) {
  .bpmn-dialog {
    width: calc(100vw - 1rem);
    height: calc(100vh - 1rem);
  }
}
</style>
