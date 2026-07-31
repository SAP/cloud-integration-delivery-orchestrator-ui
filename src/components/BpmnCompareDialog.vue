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
import '@ui5/webcomponents/dist/CheckBox.js'
import '@ui5/webcomponents/dist/Dialog.js'
import '@ui5/webcomponents/dist/Toolbar.js'
import '@ui5/webcomponents/dist/ToolbarButton.js'

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
  'Close this dialog and use Show text diff.'

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

let generation = 0
let closeEmitted = !props.open
let dialogActuallyOpen = false
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null
let fitScheduled = false

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

function invalidate() {
  generation += 1
  stopResizeMonitoring()
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

function scheduleFit(token: number, file: CompareFileItem) {
  if (fitScheduled) return

  fitScheduled = true
  const frame = requestAnimationFrame(() => {
    fitScheduled = false
    resizeFrame = null
    if (!isCurrent(token, file)) return
    runViewerAction('left', viewer => viewer.fit())
    runViewerAction('right', viewer => viewer.fit())
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

function focusChange(change: BpmnElementChange) {
  runViewerAction('left', viewer => viewer.focus(change.id))
  runViewerAction('right', viewer => viewer.focus(change.id))
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
          throw new Error('Source canvas is unavailable')
        }
        leftViewer.value = viewerRuntime.createBpmnViewer(leftCanvas.value)
      } catch (error) {
        addFailure('left', error, file.path)
      }
    }

    if (hasRightSide.value) {
      try {
        if (!rightCanvas.value) {
          throw new Error('Target canvas is unavailable')
        }
        rightViewer.value = viewerRuntime.createBpmnViewer(rightCanvas.value)
      } catch (error) {
        addFailure('right', error, file.path)
      }
    }

    startResizeMonitoring(token, file)

    const leftXml = file.leftContent ?? ''
    const rightXml = file.rightContent ?? ''
    const importJobs: Array<{
      side: BpmnDiffSide
      promise: Promise<{ warnings: readonly unknown[] }>
    }> = []

    if (leftViewer.value) {
      const viewer = leftViewer.value
      importJobs.push({
        side: 'left',
        promise: viewer.importXml(leftXml),
      })
    }

    if (rightViewer.value) {
      const viewer = rightViewer.value
      importJobs.push({
        side: 'right',
        promise: viewer.importXml(rightXml),
      })
    }

    const importResults = await Promise.allSettled(
      importJobs.map(job => job.promise),
    )
    if (!isCurrent(token, file)) return

    importResults.forEach((result, index) => {
      const side = importJobs[index].side
      if (result.status === 'fulfilled') {
        if (side === 'left') leftReady.value = true
        if (side === 'right') rightReady.value = true
        addWarnings(side, result.value.warnings)
        return
      }

      addFailure(side, result.reason, file.path)
    })

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
    scheduleFit(token, file)
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

function handleDialogClose() {
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
    data-testid="bpmn-dialog"
    header-text="BPMN Visual Diff"
    :open="open"
    @open="handleDialogOpen"
    @close="handleDialogClose"
  >
    <div class="bpmn-dialog__surface">
      <header class="compare-header">
        <div class="file-identity">
          <span class="file-identity__kind">BPMN / IFLW</span>
          <strong class="file-identity__path">
            {{ file?.path ?? 'No BPMN file selected' }}
          </strong>
          <span
            v-if="file"
            class="file-identity__status"
            :class="`file-identity__status--${file.status}`"
          >
            {{ file.status }}
          </span>
        </div>

        <div class="compare-direction" aria-label="Comparison direction">
          <span class="compare-direction__endpoint">
            Target · {{ leftLabel }}
          </span>
          <span class="compare-direction__arrow" aria-hidden="true">→</span>
          <span class="compare-direction__endpoint">
            Source · {{ rightLabel }}
          </span>
        </div>
      </header>

      <div class="compare-controls">
        <ul class="diff-legend" aria-label="BPMN difference legend">
          <li data-testid="legend-added" class="legend-item legend-item--added">
            <svg
              class="legend-line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line x1="0" y1="2" x2="24" y2="2" />
            </svg>
            <span>Added</span>
            <small>solid</small>
          </li>
          <li
            data-testid="legend-removed"
            class="legend-item legend-item--removed"
          >
            <svg
              class="legend-line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line
                x1="0"
                y1="2"
                x2="24"
                y2="2"
                stroke-dasharray="8 4"
              />
            </svg>
            <span>Removed</span>
            <small>dashed</small>
          </li>
          <li
            data-testid="legend-changed"
            class="legend-item legend-item--changed"
          >
            <svg
              class="legend-line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line
                x1="0"
                y1="2"
                x2="24"
                y2="2"
                stroke-dasharray="4 3"
              />
            </svg>
            <span>Changed</span>
            <small>short dashed</small>
          </li>
          <li
            data-testid="legend-layout-only"
            class="legend-item legend-item--layout"
          >
            <svg
              class="legend-line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line
                x1="0"
                y1="2"
                x2="24"
                y2="2"
                stroke-dasharray="1 4"
                stroke-linecap="round"
              />
            </svg>
            <span>Layout-only</span>
            <small>dotted</small>
          </li>
        </ul>

        <ui5-checkbox
          data-testid="hide-layout-only"
          text="Hide layout-only"
          :checked="hideLayoutOnly"
          @change="handleLayoutToggle"
        />
      </div>

      <div
        v-if="warnings.length > 0"
        class="warning-summary"
        data-testid="warning-summary"
        role="status"
      >
        <strong>
          {{ warnings.length }} {{ warnings.length === 1 ? 'warning' : 'warnings' }}
        </strong>
        <span>
          {{ warnings.map(item => `${item.side}: ${item.message}`).join(' · ') }}
        </span>
      </div>

      <div v-if="!file" class="dialog-state dialog-state--empty">
        Select a BPMN file to start a visual comparison.
      </div>

      <main v-else class="bpmn-dialog__layout">
        <section class="canvas-panel" aria-labelledby="target-canvas-title">
          <header class="canvas-panel__header">
            <div>
              <span class="canvas-panel__eyebrow">TARGET CANVAS</span>
              <h3 id="target-canvas-title">{{ leftLabel }}</h3>
            </div>
            <span class="canvas-panel__side">LEFT</span>
          </header>

          <div class="canvas-panel__viewport">
            <div
              v-if="hasLeftSide"
              ref="leftCanvas"
              class="bpmn-dialog__canvas"
              data-testid="left-canvas"
            />
            <div v-else class="canvas-placeholder">
              <strong>Not present in target</strong>
              <span>This iFlow exists only in the source snapshot.</span>
            </div>

            <div
              v-if="phase === 'loading' && hasLeftSide"
              class="canvas-state"
              role="status"
            >
              <ui5-busy-indicator active size="M" />
              <span>Loading target BPMN…</span>
            </div>
            <div
              v-else-if="leftCanvasFailure"
              class="canvas-state canvas-state--error"
              data-testid="canvas-error-left"
              role="alert"
            >
              <strong>Target rendering incomplete</strong>
              <span>{{ leftCanvasFailure.text }}</span>
            </div>
          </div>
        </section>

        <section class="canvas-panel" aria-labelledby="source-canvas-title">
          <header class="canvas-panel__header">
            <div>
              <span class="canvas-panel__eyebrow">SOURCE CANVAS</span>
              <h3 id="source-canvas-title">{{ rightLabel }}</h3>
            </div>
            <span class="canvas-panel__side">RIGHT</span>
          </header>

          <div class="canvas-panel__viewport">
            <div
              v-if="hasRightSide"
              ref="rightCanvas"
              class="bpmn-dialog__canvas"
              data-testid="right-canvas"
            />
            <div v-else class="canvas-placeholder">
              <strong>Not present in source</strong>
              <span>This iFlow exists only in the target snapshot.</span>
            </div>

            <div
              v-if="phase === 'loading' && hasRightSide"
              class="canvas-state"
              role="status"
            >
              <ui5-busy-indicator active size="M" />
              <span>Loading source BPMN…</span>
            </div>
            <div
              v-else-if="rightCanvasFailure"
              class="canvas-state canvas-state--error"
              data-testid="canvas-error-right"
              role="alert"
            >
              <strong>Source rendering incomplete</strong>
              <span>{{ rightCanvasFailure.text }}</span>
            </div>
          </div>
        </section>

        <aside class="change-panel" aria-labelledby="change-panel-title">
          <header class="change-panel__header">
            <div>
              <span class="change-panel__eyebrow">NAVIGATION INDEX</span>
              <h3 id="change-panel-title">Changed elements</h3>
            </div>
            <span class="change-panel__count">
              {{
                file.status === 'modified'
                  ? visibleChanges.length
                  : 1
              }}
            </span>
          </header>

          <ul
            v-if="failures.length > 0"
            class="failure-list"
            data-testid="error-list"
            aria-label="Visual comparison errors"
          >
            <li v-for="failure in failures" :key="failure.key">
              <strong>{{ failure.side }}</strong>
              <span>{{ failure.text }}</span>
            </li>
          </ul>

          <div v-if="phase === 'idle'" class="change-state">
            Waiting for the dialog to finish opening.
          </div>
          <div v-else-if="phase === 'loading'" class="change-state" role="status">
            Computing semantic BPMN changes…
          </div>

          <div v-else class="change-panel__body">
            <div
              v-if="file.status !== 'modified'"
              class="change-item change-item--file"
              :class="`change-item--${file.status === 'added' ? 'added' : 'removed'}`"
              data-testid="file-change"
              role="status"
            >
              <span class="change-item__status">
                {{ file.status === 'added' ? 'ADDED' : 'REMOVED' }}
              </span>
              <strong>
                {{
                  file.status === 'added'
                    ? 'Entire iFlow added'
                    : 'Entire iFlow removed'
                }}
              </strong>
              <small>File-level change · no BPMN element to focus</small>
            </div>

            <button
              v-for="change in visibleChanges"
              v-else
              :key="change.id"
              class="change-item"
              :class="`change-item--${change.status}`"
              :data-testid="`change-${change.id}`"
              type="button"
              @click="focusChange(change)"
            >
              <span class="change-item__status">
                {{ change.status }}
              </span>
              <strong>{{ change.name || change.id }}</strong>
              <small>{{ change.type }} · {{ change.id }}</small>
              <span
                v-if="change.status !== 'layout-only' && change.alsoLayoutChanged"
                class="change-item__layout-note"
              >
                Layout also changed
              </span>
            </button>

            <div
              v-if="
                file.status === 'modified'
                  && changes.length === 0
                  && visibleChanges.length === 0
                  && failures.length === 0
              "
              class="change-state change-state--empty"
              data-testid="no-changes"
            >
              No BPMN element changes
            </div>

            <div
              v-else-if="
                file.status === 'modified'
                  && changes.length > 0
                  && visibleChanges.length === 0
                  && failures.length === 0
              "
              class="change-state change-state--empty"
              data-testid="all-layout-hidden"
            >
              All layout-only changes are hidden
            </div>

            <div
              v-else-if="
                file.status === 'modified'
                  && visibleChanges.length === 0
                  && failures.length > 0
              "
              class="change-state change-state--error"
            >
              Visual comparison is incomplete. Use the text diff fallback.
            </div>
          </div>
        </aside>
      </main>
    </div>

    <!-- UI5 web components require the native slot attribute for dialog footers. -->
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
    <ui5-toolbar slot="footer" align-content="End">
      <ui5-toolbar-button
        data-testid="close-dialog"
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

.compare-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--sapPageHeader_Background);
  border-top: 0.1875rem solid var(--sapSelectedColor);
  border-bottom: 1px solid var(--sapGroup_ContentBorderColor);
}

.file-identity {
  display: flex;
  flex: 1 1 28rem;
  align-items: center;
  min-width: 0;
  gap: 0.625rem;
}

.file-identity__kind,
.canvas-panel__eyebrow,
.change-panel__eyebrow {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.file-identity__kind {
  flex: 0 0 auto;
  padding: 0.125rem 0.375rem;
  background: var(--sapList_AlternatingBackground);
  border: 1px solid var(--sapList_BorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
}

.file-identity__path {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--sapFontSemiboldDuplexFamily);
  font-size: var(--sapFontSize);
}

.file-identity__status {
  flex: 0 0 auto;
  padding: 0.125rem 0.4375rem;
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid currentColor;
  border-radius: var(--sapElement_BorderCornerRadius);
}

.file-identity__status--added {
  color: var(--sapPositiveColor);
  background: var(--sapPositiveBackground);
}

.file-identity__status--deleted {
  color: var(--sapNegativeColor);
  background: var(--sapNegativeBackground);
}

.file-identity__status--modified {
  color: var(--sapCriticalColor);
  background: var(--sapCriticalBackground);
}

.compare-direction {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 0.625rem;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 600;
}

.compare-direction__endpoint {
  padding: 0.25rem 0.5rem;
  background: var(--sapList_Background);
  border: 1px solid var(--sapList_BorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
}

.compare-direction__arrow {
  color: var(--sapSelectedColor);
  font-size: var(--sapFontHeader4Size);
}

.compare-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.5rem 1rem;
  background: var(--sapList_HeaderBackground);
  border-bottom: 1px solid var(--sapList_BorderColor);
}

.diff-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.legend-item {
  display: inline-grid;
  grid-template-columns: 1.5rem auto auto;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--sapFontSmallSize);
  font-weight: 600;
}

.legend-item small {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 400;
}

.legend-line {
  width: 1.5rem;
  height: 0.25rem;
  overflow: visible;
}

.legend-line line {
  stroke: currentColor;
  stroke-width: 2.5;
}

.legend-item--added {
  color: var(--sapPositiveColor);
}

.legend-item--removed {
  color: var(--sapNegativeColor);
}

.legend-item--changed {
  color: var(--sapCriticalColor);
}

.legend-item--layout {
  color: var(--sapInformationColor);
}

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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 20rem;
  min-height: 70vh;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--sapBackgroundColor);
}

.canvas-panel,
.change-panel {
  min-width: 0;
  background: var(--sapGroup_ContentBackground);
  border: 1px solid var(--sapGroup_ContentBorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
}

.canvas-panel {
  display: flex;
  flex-direction: column;
}

.canvas-panel__header,
.change-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--sapList_HeaderBackground);
  border-bottom: 1px solid var(--sapList_BorderColor);
}

.canvas-panel__header h3,
.change-panel__header h3 {
  margin: 0.125rem 0 0;
  font-size: var(--sapFontHeader6Size);
  line-height: 1.25rem;
}

.canvas-panel__side,
.change-panel__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  min-height: 1.375rem;
  padding: 0 0.375rem;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  background: var(--sapList_AlternatingBackground);
  border: 1px solid var(--sapList_BorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
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
.canvas-state,
.dialog-state,
.change-state {
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
  max-height: calc(100vh - 13rem);
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

.change-panel__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.375rem;
  min-height: 0;
  padding: 0.5rem;
  overflow: auto;
}

.change-item {
  display: grid;
  width: 100%;
  gap: 0.1875rem;
  padding: 0.625rem 0.75rem;
  color: var(--sapTextColor);
  font: inherit;
  text-align: left;
  background: var(--sapList_Background);
  border: 1px solid var(--sapList_BorderColor);
  border-left-width: 0.25rem;
  border-radius: var(--sapElement_BorderCornerRadius);
  cursor: pointer;
}

.change-item:not(.change-item--file):hover {
  background: var(--sapList_Hover_Background);
}

.change-item:focus-visible {
  outline: 0.125rem solid var(--sapContent_FocusColor);
  outline-offset: 0.125rem;
}

.change-item--file {
  cursor: default;
}

.change-item--added {
  border-left-color: var(--sapPositiveColor);
}

.change-item--removed {
  border-left-color: var(--sapNegativeColor);
}

.change-item--changed {
  border-left-color: var(--sapCriticalColor);
}

.change-item--layout-only {
  border-left-color: var(--sapInformationColor);
  border-left-style: dotted;
}

.change-item__status {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.change-item strong {
  overflow-wrap: anywhere;
  font-size: var(--sapFontSize);
}

.change-item small {
  overflow-wrap: anywhere;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
}

.change-item__layout-note {
  width: fit-content;
  margin-top: 0.125rem;
  padding: 0.0625rem 0.25rem;
  color: var(--sapInformationTextColor);
  font-size: var(--sapFontSmallSize);
  background: var(--sapInformationBackground);
  border: 1px dotted var(--sapInformationBorderColor);
}

.change-state {
  flex: 1 1 auto;
  min-height: 8rem;
}

.change-state--error {
  color: var(--sapNegativeTextColor);
  background: var(--sapNegativeBackground);
}

.dialog-state {
  min-height: 60vh;
}

@media (max-width: 80rem) {
  .bpmn-dialog__layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .change-panel {
    grid-column: 1 / -1;
    max-height: 20rem;
  }
}

@media (max-width: 64rem) {
  .compare-direction {
    flex-basis: 100%;
  }

  .bpmn-dialog__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .bpmn-dialog__canvas,
  .canvas-placeholder {
    min-height: 42vh;
  }

  .change-panel {
    grid-column: auto;
  }
}

@media (max-width: 40rem) {
  .bpmn-dialog {
    width: calc(100vw - 1rem);
    height: calc(100vh - 1rem);
  }

  .compare-header,
  .compare-controls {
    align-items: stretch;
  }

  .compare-direction {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .compare-direction__arrow {
    display: none;
  }
}
</style>
