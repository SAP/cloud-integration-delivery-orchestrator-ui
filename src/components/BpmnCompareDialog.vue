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
const expandedChangeId = ref<string | null>(null)

let generation = 0
let closeEmitted = !props.open
let dialogActuallyOpen = false
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null
let fitScheduled = false
let viewboxSyncCleanup: (() => void) | null = null

const changePanelOpen = ref(true)

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

function invalidate() {
  generation += 1
  stopResizeMonitoring()
  stopViewboxSync()
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

function focusChange(change: BpmnElementChange) {
  expandedChangeId.value = expandedChangeId.value === change.id ? null : change.id
  runViewerAction('left', viewer => viewer.focus(change.id))
  runViewerAction('right', viewer => viewer.focus(change.id))
}

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.length > 60 ? value.slice(0, 57) + '…' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return '[object]'
  return String(value)
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
          Layout-only
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

        <section class="change-strip">
          <button
            class="change-strip__toggle"
            type="button"
            @click="changePanelOpen = !changePanelOpen"
          >
            <span>Changes ({{ file.status === 'modified' ? visibleChanges.length : 1 }})</span>
            <span class="change-strip__arrow">{{ changePanelOpen ? '▼' : '▲' }}</span>
          </button>

          <div v-show="changePanelOpen" class="change-strip__body">
            <ul
              v-if="failures.length > 0"
              class="failure-list"
              aria-label="Visual comparison errors"
            >
              <li v-for="failure in failures" :key="failure.key">
                <strong>{{ failure.side }}</strong>
                <span>{{ failure.text }}</span>
              </li>
            </ul>

            <div v-if="phase === 'loading'" class="change-strip__status" role="status">
              Computing changes…
            </div>

            <div v-else class="change-strip__scroll">
              <div
                v-if="file.status !== 'modified'"
                class="change-chip"
                :class="`change-chip--${file.status === 'added' ? 'added' : 'removed'}`"
              >
                <span class="change-chip__status">
                  {{ file.status === 'added' ? 'ADDED' : 'REMOVED' }}
                </span>
                <strong>Entire iFlow</strong>
              </div>

              <button
                v-for="change in visibleChanges"
                v-else
                :key="change.id"
                class="change-chip"
                :class="[
                  `change-chip--${change.status}`,
                  { 'change-chip--expanded': expandedChangeId === change.id },
                ]"
                type="button"
                @click="focusChange(change)"
              >
                <span class="change-chip__status">{{ change.status }}</span>
                <strong>{{ change.name || change.id }}</strong>
                <small>{{ change.type }}</small>
                <dl
                  v-if="expandedChangeId === change.id && change.properties"
                  class="change-chip__attrs"
                >
                  <template v-for="prop in change.properties" :key="prop.key">
                    <dt>{{ prop.key }}</dt>
                    <dd>
                      <span class="attr-old">{{ prop.oldValue ?? '—' }}</span>
                      <span class="attr-arrow">&rarr;</span>
                      <span class="attr-new">{{ prop.newValue ?? '—' }}</span>
                    </dd>
                  </template>
                </dl>
                <dl
                  v-else-if="expandedChangeId === change.id && change.attrs"
                  class="change-chip__attrs"
                >
                  <template v-for="(detail, prop) in change.attrs" :key="prop">
                    <dt>{{ prop }}</dt>
                    <dd>
                      <span class="attr-old">{{ formatAttrValue(detail.oldValue) }}</span>
                      <span class="attr-arrow">&rarr;</span>
                      <span class="attr-new">{{ formatAttrValue(detail.newValue) }}</span>
                    </dd>
                  </template>
                </dl>
              </button>

              <div
                v-if="file.status === 'modified' && visibleChanges.length === 0 && failures.length === 0"
                class="change-strip__status"
              >
                No BPMN element changes
              </div>
            </div>
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

.change-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--sapGroup_ContentBackground);
  border: 1px solid var(--sapGroup_ContentBorderColor);
  border-radius: var(--sapElement_BorderCornerRadius);
}

.change-strip__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 1rem;
  color: var(--sapLinkColor, #0064d9);
  font: inherit;
  font-size: var(--sapFontSize);
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
}

.change-strip__toggle:hover {
  text-decoration: underline;
}

.change-strip__arrow {
  font-size: 0.625rem;
}

.change-strip__body {
  width: 100%;
  border-top: 1px solid var(--sapGroup_ContentBorderColor);
}

.change-strip__scroll {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  overflow-x: auto;
}

.change-strip__status {
  padding: 0.5rem 1rem;
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSize);
  text-align: center;
}

.change-chip {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.625rem;
  min-width: 6rem;
  max-width: 12rem;
  color: var(--sapTextColor);
  font: inherit;
  text-align: left;
  background: var(--sapList_Background);
  border: 1px solid var(--sapList_BorderColor);
  border-left-width: 0.25rem;
  border-radius: var(--sapElement_BorderCornerRadius);
  cursor: pointer;
}

.change-chip:hover {
  background: var(--sapList_Hover_Background);
}

.change-chip:focus-visible {
  outline: 0.125rem solid var(--sapContent_FocusColor);
  outline-offset: 0.125rem;
}

.change-chip--added { border-left-color: var(--sapPositiveColor); }
.change-chip--removed { border-left-color: var(--sapNegativeColor); }
.change-chip--changed { border-left-color: var(--sapCriticalColor); }
.change-chip--layout-only { border-left-color: var(--sapInformationColor); border-left-style: dotted; }

.change-chip__status {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.change-chip strong {
  font-size: var(--sapFontSize);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-chip small {
  color: var(--sapContent_LabelColor);
  font-size: var(--sapFontSmallSize);
  white-space: nowrap;
}

.change-chip--expanded {
  max-width: 24rem;
}

.change-chip__attrs {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.125rem 0.5rem;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0 0;
  border-top: 1px solid var(--sapGroup_ContentBorderColor);
  font-size: var(--sapFontSmallSize);
}

.change-chip__attrs dt {
  color: var(--sapContent_LabelColor);
  font-weight: 600;
  white-space: nowrap;
}

.change-chip__attrs dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-chip__attrs .attr-old {
  color: var(--sapNegativeTextColor, #bb0000);
  text-decoration: line-through;
}

.change-chip__attrs .attr-arrow {
  margin: 0 0.25rem;
  color: var(--sapContent_LabelColor);
}

.change-chip__attrs .attr-new {
  color: var(--sapPositiveTextColor, #107e3e);
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
