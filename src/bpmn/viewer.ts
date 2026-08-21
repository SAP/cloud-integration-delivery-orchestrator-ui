import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import type { BaseViewerOptions } from 'bpmn-js/lib/BaseViewer'
import type Canvas from 'diagram-js/lib/core/Canvas'
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry'
import type Overlays from 'diagram-js/lib/features/overlays/Overlays'
import type EventBus from 'diagram-js/lib/core/EventBus'
import { cpiRendererModule } from './CpiRenderer'
import { cpiConnectionMarkersModule } from './cpiConnectionMarkers'
import importConnectionCropperModule from './importConnectionCropperModule'
import type { BpmnChangeStatus, BpmnElementChange } from './diff'
import { prepareIflowXmlForRendering } from './iflowRenderXml'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import './bpmnDiff.css'

export type ViewerSide = 'left' | 'right'

export interface ViewerLike {
  importXML(xml: string): Promise<{ warnings: string[] }>
  get<T = unknown>(name: string): T
  destroy(): void
}

export type ViewerFactoryOptions = BaseViewerOptions & {
  container: HTMLElement
  additionalModules: NonNullable<BaseViewerOptions['additionalModules']>
}

export type ViewerFactory = (options: ViewerFactoryOptions) => ViewerLike

const markerClass: Record<BpmnChangeStatus, string> = {
  added: 'bpmn-diff-added',
  removed: 'bpmn-diff-removed',
  changed: 'bpmn-diff-changed',
  'layout-only': 'bpmn-diff-layout'
}

const overlaySymbol: Record<BpmnChangeStatus, string> = {
  added: '&#43;',
  removed: '&minus;',
  changed: '&#9998;',
  'layout-only': '&#8680;',
}

const overlayClass: Record<BpmnChangeStatus, string> = {
  added: 'bpmn-diff-badge bpmn-diff-badge--added',
  removed: 'bpmn-diff-badge bpmn-diff-badge--removed',
  changed: 'bpmn-diff-badge bpmn-diff-badge--changed',
  'layout-only': 'bpmn-diff-badge bpmn-diff-badge--layout',
}

// Selection emphasis is layered ON TOP of the always-on status markers, tracked
// separately so it never touches status-marker ownership.
const SELECTED_MARKER = 'bpmn-diff-selected'

function belongsOnSide(status: BpmnChangeStatus, side: ViewerSide) {
  return (
    status === 'changed' ||
    status === 'layout-only' ||
    (status === 'added' && side === 'right') ||
    (status === 'removed' && side === 'left')
  )
}

export function createBpmnViewer(
  container: HTMLElement,
  factory: ViewerFactory = (options) => new NavigatedViewer(options) as unknown as ViewerLike
) {
  const viewer = factory({
    container,
    additionalModules: [cpiRendererModule, cpiConnectionMarkersModule, importConnectionCropperModule]
  })
  const activeMarkers: Array<{
    elementId: string
    className: string
  }> = []
  let imported = false
  let destroyed = false
  let selectedId: string | null = null

  const services = () => ({
    canvas: viewer.get<Canvas>('canvas'),
    registry: viewer.get<ElementRegistry>('elementRegistry'),
    overlays: viewer.get<Overlays>('overlays'),
    eventBus: viewer.get<EventBus>('eventBus'),
  })

  const clearMarkers = () => {
    if (activeMarkers.length === 0) return

    const { canvas } = services()
    activeMarkers.splice(0).forEach(({ elementId, className }) => {
      canvas.removeMarker(elementId, className)
    })
  }

  const clearOverlays = () => {
    if (!imported) return
    try {
      const { overlays } = services()
      overlays.remove({ type: 'diff' })
    } catch {
      // ignore if overlay service unavailable
    }
  }

  // Center the element in the viewport, keeping the current zoom level.
  const focusElement = (elementId: string) => {
    if (!imported || destroyed) return

    const { canvas, registry } = services()
    const element = registry.get(elementId)
    if (!element) return

    // Determine element center — shapes have x/y/width/height, connections have waypoints
    const shape = element as unknown as {
      x?: number; y?: number; width?: number; height?: number
      waypoints?: Array<{ x: number; y: number }>
    }

    let centerX: number
    let centerY: number

    if (shape.waypoints && shape.waypoints.length > 0) {
      // Center on the midpoint of the connection span (first→last), not the
      // middle array element — for a 2-point connection the latter is the
      // endpoint, not the center.
      const first = shape.waypoints[0]
      const last = shape.waypoints[shape.waypoints.length - 1]
      centerX = (first.x + last.x) / 2
      centerY = (first.y + last.y) / 2
    } else if (
      typeof shape.x === 'number' && typeof shape.y === 'number'
      && typeof shape.width === 'number' && typeof shape.height === 'number'
    ) {
      centerX = shape.x + shape.width / 2
      centerY = shape.y + shape.height / 2
    } else {
      return
    }

    if (!isFinite(centerX) || !isFinite(centerY)) return

    const currentViewbox = canvas.viewbox() as {
      x: number; y: number; width: number; height: number
    }
    if (!isFinite(currentViewbox.width) || !isFinite(currentViewbox.height)) return

    canvas.viewbox({
      x: centerX - currentViewbox.width / 2,
      y: centerY - currentViewbox.height / 2,
      width: currentViewbox.width,
      height: currentViewbox.height,
    })
  }

  const clearSelection = () => {
    if (selectedId === null) return
    const previous = selectedId
    selectedId = null
    if (!imported || destroyed) return
    try {
      services().canvas.removeMarker(previous, SELECTED_MARKER)
    } catch {
      // ignore if the element/canvas is already gone
    }
  }

  return {
    async importXml(xml: string) {
      if (destroyed) {
        throw new Error('BPMN viewer has been destroyed')
      }

      imported = false
      clearMarkers()
      clearOverlays()
      clearSelection()
      const result = await viewer.importXML(prepareIflowXmlForRendering(xml)) // NOTE: entry point for generation businessObject
      if (!destroyed) imported = true
      return result
    },

    applyChanges(changes: BpmnElementChange[], side: ViewerSide, showLayoutOnly: boolean) {
      if (!imported || destroyed) return

      clearMarkers()
      clearOverlays()
      const { canvas, registry, overlays } = services()

      changes.forEach((change) => {
        if (!belongsOnSide(change.status, side)) return
        if (change.status === 'layout-only' && !showLayoutOnly) return

        const element = registry.get(change.id)
        if (!element) return

        const className = markerClass[change.status]
        canvas.addMarker(change.id, className)
        activeMarkers.push({ elementId: change.id, className })

        const isConnection = 'waypoints' in element
        if (!isConnection) {
          // Shape badge at top-right
          try {
            overlays.add(change.id, 'diff', {
              position: { top: -14, right: 14 },
              html: `<span class="${overlayClass[change.status]}">${overlaySymbol[change.status]}</span>`
            })
          } catch { /* ignore */ }
        }
      })
    },

    fit() {
      if (!imported || destroyed) return

      const { canvas } = services()
      canvas.resized()
      canvas.zoom('fit-viewport')
    },

    focus(elementId: string) {
      focusElement(elementId)
    },

    /**
     * Emphasize a single element (selected state) on top of the always-on status
     * markers and center it. Replaces any previous selection. Unknown ids clear
     * the selection.
     */
    select(elementId: string) {
      if (!imported || destroyed) return

      const { canvas, registry } = services()
      if (!registry.get(elementId)) {
        clearSelection()
        return
      }

      if (selectedId !== null && selectedId !== elementId) {
        try { canvas.removeMarker(selectedId, SELECTED_MARKER) } catch { /* ignore */ }
      }
      canvas.addMarker(elementId, SELECTED_MARKER)
      selectedId = elementId
      focusElement(elementId)
    },

    clearSelection() {
      clearSelection()
    },

    /**
     * Subscribe to canvas element clicks (bidirectional binding). Returns an
     * unsubscribe function. Callback receives the clicked element id.
     */
    onElementClick(callback: (elementId: string) => void): () => void {
      if (destroyed) return () => {}

      const { eventBus } = services()
      const handler = (event: any) => {
        const id = event?.element?.id
        if (typeof id === 'string') callback(id)
      }
      eventBus.on('element.click', handler)
      return () => eventBus.off('element.click', handler)
    },

    onViewboxChanged(callback: (viewbox: unknown) => void): () => void {
      if (destroyed) return () => {}

      const { eventBus } = services()
      const handler = (e: any) => callback(e.viewbox)
      eventBus.on('canvas.viewbox.changed', handler)
      return () => eventBus.off('canvas.viewbox.changed', handler)
    },

    setViewbox(viewbox: unknown) {
      if (!imported || destroyed) return

      const { canvas } = services()
      canvas.viewbox(viewbox as any)
    },

    destroy() {
      if (destroyed) return

      // Clear the selection marker while the viewer is still live — its guard
      // skips removal once `destroyed`/`imported` flip below.
      clearSelection()
      destroyed = true
      imported = false
      try {
        clearMarkers()
        clearOverlays()
      } finally {
        viewer.destroy()
      }
    }
  }
}

export type BpmnViewerHandle = ReturnType<typeof createBpmnViewer>
