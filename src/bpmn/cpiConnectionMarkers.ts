import type Canvas from 'diagram-js/lib/core/Canvas'
import type EventBus from 'diagram-js/lib/core/EventBus'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Injects CPI-style connection markers (SlashStart + FilledEnd) into the
 * diagram SVG <defs>. These are referenced by CSS via marker-start/marker-end
 * on .djs-connection paths, replacing bpmn-js's default arrowheads.
 *
 * Marker shapes extracted from CPI Designer's own <defs>:
 *   - FilledEnd: triangle (M 0 0 L 14 5 L 0 10 z), filled #427CAC
 *   - SlashStart: diagonal line (M 3 0 L 13 10), stroke #427CAC
 */
class CpiConnectionMarkers {
  static $inject = ['canvas', 'eventBus']

  constructor(canvas: Canvas, eventBus: EventBus) {
    eventBus.on('canvas.init', () => {
      const svg = canvas.getContainer().querySelector('svg')
      if (!svg) return

      let defs = svg.querySelector('defs')
      if (!defs) {
        defs = document.createElementNS(SVG_NS, 'defs')
        svg.prepend(defs)
      }

      // FilledEnd — solid triangle arrowhead
      const filledEnd = document.createElementNS(SVG_NS, 'marker')
      filledEnd.setAttribute('id', 'cpi-arrow-end')
      filledEnd.setAttribute('markerUnits', 'userSpaceOnUse')
      filledEnd.setAttribute('refX', '14')
      filledEnd.setAttribute('refY', '5')
      filledEnd.setAttribute('markerWidth', '14')
      filledEnd.setAttribute('markerHeight', '10')
      filledEnd.setAttribute('orient', 'auto')
      const endPath = document.createElementNS(SVG_NS, 'path')
      endPath.setAttribute('d', 'M 0 0 L 14 5 L 0 10 z')
      endPath.setAttribute('fill', '#427CAC')
      endPath.setAttribute('stroke', 'none')
      filledEnd.appendChild(endPath)
      defs.appendChild(filledEnd)

      // SlashStart — diagonal slash line
      const slashStart = document.createElementNS(SVG_NS, 'marker')
      slashStart.setAttribute('id', 'cpi-arrow-start')
      slashStart.setAttribute('markerUnits', 'userSpaceOnUse')
      slashStart.setAttribute('refX', '0')
      slashStart.setAttribute('refY', '5')
      slashStart.setAttribute('markerWidth', '16')
      slashStart.setAttribute('markerHeight', '10')
      slashStart.setAttribute('orient', 'auto')
      const startPath = document.createElementNS(SVG_NS, 'path')
      startPath.setAttribute('d', 'M 3 0 L 13 10')
      startPath.setAttribute('stroke', '#427CAC')
      startPath.setAttribute('stroke-width', '1')
      startPath.setAttribute('fill', 'white')
      slashStart.appendChild(startPath)
      defs.appendChild(slashStart)
    })
  }
}

/** diagram-js DI module registration */
export const cpiConnectionMarkersModule = {
  __init__: ['cpiConnectionMarkers'],
  cpiConnectionMarkers: ['type', CpiConnectionMarkers],
}
