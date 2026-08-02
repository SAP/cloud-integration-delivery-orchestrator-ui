import type BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer'
import type { Attrs } from 'bpmn-js/lib/draw/BpmnRenderer'
import type { Shape as BpmnShape } from 'bpmn-js/lib/model/Types'
import type EventBus from 'diagram-js/lib/core/EventBus'
import type { ElementLike, ShapeLike } from 'diagram-js/lib/core/Types'
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append, classes, create } from 'tiny-svg'
import { createCpiIconSymbol } from './cpiIcons'
import {
  classifyCpiElement,
  type CpiVisualKind,
} from './cpiMetadata'

export const CPI_RENDERER_PRIORITY = 1500

type UnknownRecord = Record<string, unknown>

function isShapeElement(element: ElementLike): element is ShapeLike {
  return element !== null
    && typeof element === 'object'
    && !('labelTarget' in element)
    && !('waypoints' in element)
    && 'x' in element
    && 'y' in element
    && 'width' in element
    && 'height' in element
}

function safeDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object'
    ? value as UnknownRecord
    : undefined
}

function getName(shape: ShapeLike): string {
  const bo = asRecord(shape.businessObject)
  return typeof bo?.name === 'string' ? bo.name : ''
}

function createIconBadge(
  shape: ShapeLike,
  kind: CpiVisualKind,
): SVGGElement | null {
  const symbol = createCpiIconSymbol(kind)
  if (!symbol) return null

  // All CPI icons go in the top-left corner at (4, 4)
  // IntegrationProcess slightly lower to center in header
  const y = kind === 'IntegrationProcess' ? 7 : 4
  const icon = create('g', {
    class: 'cpi-shape-icon',
    'data-cpi-kind': kind,
    'aria-hidden': 'true',
    focusable: 'false',
    transform: `translate(4 ${y}) scale(0.667)`,
  })
  icon.setAttribute('pointer-events', 'none')

  append(icon, symbol)
  return icon
}

export default class CpiRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer']

  constructor(
    eventBus: EventBus,
    private readonly bpmnRenderer: BpmnRenderer,
  ) {
    super(eventBus, CPI_RENDERER_PRIORITY)
  }

  canRender(element: ElementLike): boolean {
    return isShapeElement(element)
      && classifyCpiElement(element.businessObject) !== undefined
  }

  drawShape(
    parentGfx: SVGElement,
    shape: ShapeLike,
    attrs?: Attrs,
  ): SVGElement {
    const kind = isShapeElement(shape)
      ? classifyCpiElement(shape.businessObject)
      : undefined

    if (kind === 'IntegrationProcess') {
      return this.drawIntegrationProcess(parentGfx, shape)
    }

    if (kind === 'ContentModifier'
      || kind === 'Script'
      || kind === 'Send'
      || kind === 'RequestReply') {
      return this.drawCpiActivity(parentGfx, shape, kind)
    }

    // Sender, Receiver, Router — use default bpmn-js rendering
    const mainGfx = this.bpmnRenderer.drawShape(
      parentGfx,
      shape as BpmnShape,
      attrs,
    )

    if (kind !== undefined) {
      classes(mainGfx).add('cpi-shape-outline')
      mainGfx.setAttribute('data-cpi-kind', kind)
    }

    return mainGfx
  }

  getShapePath(shape: ShapeLike): string {
    return this.bpmnRenderer.getShapePath(shape as BpmnShape)
  }

  private drawCpiActivity(
    parentGfx: SVGElement,
    shape: ShapeLike,
    kind: CpiVisualKind,
  ): SVGElement {
    const width = safeDimension(shape.width, 100)
    const height = safeDimension(shape.height, 60)

    const rect = create('rect', {
      x: 0,
      y: 0,
      width,
      height,
      rx: 3,
      ry: 3,
    })
    rect.setAttribute('fill', 'rgb(235, 248, 255)')
    rect.setAttribute('stroke', 'rgb(123, 207, 255)')
    rect.setAttribute('stroke-width', '1')
    classes(rect).add('cpi-shape-outline')
    rect.setAttribute('data-cpi-kind', kind)
    append(parentGfx, rect)

    const name = getName(shape)
    if (name) {
      const text = create('text', {
        x: width / 2,
        y: height / 2,
      })
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('font-size', '12')
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
      text.setAttribute('fill', '#333333')
      text.textContent = name
      classes(text).add('djs-label')
      append(parentGfx, text)
    }

    const badge = createIconBadge(shape, kind)
    if (badge) append(parentGfx, badge)

    return rect
  }

  private drawIntegrationProcess(parentGfx: SVGElement, shape: ShapeLike): SVGElement {
    const width = safeDimension(shape.width, 600)
    const height = safeDimension(shape.height, 200)
    const headerHeight = 30

    const rect = create('rect', {
      x: 0,
      y: 0,
      width,
      height,
      rx: 2,
      ry: 2,
    })
    rect.setAttribute('fill', '#ffffff')
    rect.setAttribute('stroke', 'rgb(169, 180, 190)')
    rect.setAttribute('stroke-width', '1')
    classes(rect).add('cpi-shape-outline')
    rect.setAttribute('data-cpi-kind', 'IntegrationProcess')
    append(parentGfx, rect)

    const separator = create('line', {
      x1: 0,
      y1: headerHeight,
      x2: width,
      y2: headerHeight,
    })
    separator.setAttribute('stroke', '#cccccc')
    separator.setAttribute('stroke-width', '1')
    append(parentGfx, separator)

    const name = getName(shape)
    if (name) {
      const text = create('text', {
        x: width / 2,
        y: headerHeight / 2,
      })
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('font-size', '14')
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
      text.setAttribute('fill', '#333333')
      text.textContent = name
      classes(text).add('djs-label')
      append(parentGfx, text)
    }

    const badge = createIconBadge(shape, 'IntegrationProcess')
    if (badge) append(parentGfx, badge)

    return rect
  }
}

/** diagram-js DI module registration */
export const cpiRendererModule = {
  __init__: ['cpiRenderer'],
  cpiRenderer: ['type', CpiRenderer],
}
