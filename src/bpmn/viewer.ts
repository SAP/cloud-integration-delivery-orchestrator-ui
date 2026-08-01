import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import type { BaseViewerOptions } from 'bpmn-js/lib/BaseViewer'
import type Canvas from 'diagram-js/lib/core/Canvas'
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry'
import cpiRendererModule from './cpiRendererModule'
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
    additionalModules: [cpiRendererModule]
  })
  const activeMarkers: Array<{
    elementId: string
    className: string
  }> = []
  let imported = false
  let destroyed = false

  const services = () => ({
    canvas: viewer.get<Canvas>('canvas'),
    registry: viewer.get<ElementRegistry>('elementRegistry')
  })

  const clearMarkers = () => {
    if (activeMarkers.length === 0) return

    const { canvas } = services()
    activeMarkers.splice(0).forEach(({ elementId, className }) => {
      canvas.removeMarker(elementId, className)
    })
  }

  return {
    async importXml(xml: string) {
      if (destroyed) {
        throw new Error('BPMN viewer has been destroyed')
      }

      imported = false
      clearMarkers()
      const result = await viewer.importXML(prepareIflowXmlForRendering(xml))
      if (!destroyed) imported = true
      return result
    },

    applyChanges(changes: BpmnElementChange[], side: ViewerSide, showLayoutOnly: boolean) {
      if (!imported || destroyed) return

      clearMarkers()
      const { canvas, registry } = services()

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

    destroy() {
      if (destroyed) return

      destroyed = true
      imported = false
      try {
        clearMarkers()
      } finally {
        viewer.destroy()
      }
    }
  }
}

export type BpmnViewerHandle = ReturnType<typeof createBpmnViewer>
