import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import type { BaseViewerOptions } from 'bpmn-js/lib/BaseViewer'
import type Canvas from 'diagram-js/lib/core/Canvas'
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry'
import type Overlays from 'diagram-js/lib/features/overlays/Overlays'
import type EventBus from 'diagram-js/lib/core/EventBus'
import { cpiRendererModule } from './CpiRenderer'
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
    additionalModules: [cpiRendererModule, importConnectionCropperModule]
  })
  const activeMarkers: Array<{
    elementId: string
    className: string
  }> = []
  let imported = false
  let destroyed = false

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

  return {
    async importXml(xml: string) {
      if (destroyed) {
        throw new Error('BPMN viewer has been destroyed')
      }

      imported = false
      clearMarkers()
      clearOverlays()
      const result = await viewer.importXML(prepareIflowXmlForRendering(xml))
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
        if (!registry.get(change.id)) return

        const className = markerClass[change.status]
        canvas.addMarker(change.id, className)
        activeMarkers.push({
          elementId: change.id,
          className
        })

        try {
          overlays.add(change.id, 'diff', {
            position: { top: -14, right: 14 },
            html: `<span class="${overlayClass[change.status]}">${overlaySymbol[change.status]}</span>`
          })
        } catch {
          // ignore if element not visible
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
      if (!imported || destroyed) return

      const { canvas, registry } = services()
      if (!registry.get(elementId)) return

      canvas.scrollToElement(elementId, 120)
    },

    onViewboxChanged(callback: (viewbox: unknown) => void): () => void {
      if (destroyed) return () => {}

      const { eventBus } = services()
      const handler = (e: { viewbox: unknown }) => callback(e.viewbox)
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
