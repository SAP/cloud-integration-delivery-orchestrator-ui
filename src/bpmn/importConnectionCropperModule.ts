import CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking'
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry'
import type GraphicsFactory from 'diagram-js/lib/core/GraphicsFactory'
import type EventBus from 'diagram-js/lib/core/EventBus'
import type Canvas from 'diagram-js/lib/core/Canvas'
import type { ElementLike, ConnectionLike } from 'diagram-js/lib/core/Types'

/**
 * After import, CPI .iflw files have connection waypoints targeting shape centers.
 * Standard bpmn-js Viewer renders waypoints as-is (no cropping).
 * This module crops all connection endpoints at shape boundaries after import.
 */
function ImportConnectionCropper(
  eventBus: EventBus,
  elementRegistry: ElementRegistry,
  graphicsFactory: GraphicsFactory,
  canvas: Canvas,
) {
  const docking = new CroppingConnectionDocking(elementRegistry, graphicsFactory)

  eventBus.on('import.done', () => {
    // filter yields ElementLike[]; the waypoints guard narrows them to connections.
    const connections = elementRegistry.filter(
      (el: ElementLike) => !!el.waypoints,
    ) as ConnectionLike[]

    for (const connection of connections) {
      if (!connection.source || !connection.target) continue

      try {
        const cropped = docking.getCroppedWaypoints(connection, connection.source, connection.target)
        if (cropped && cropped.length >= 2) {
          connection.waypoints = cropped
          graphicsFactory.update('connection', connection, canvas.getGraphics(connection))
        }
      } catch {
        // Skip connections that can't be cropped (missing graphics, etc.)
      }
    }
  })
}

ImportConnectionCropper.$inject = ['eventBus', 'elementRegistry', 'graphicsFactory', 'canvas']

export default {
  __init__: ['importConnectionCropper'],
  importConnectionCropper: ['type', ImportConnectionCropper],
}
