import type BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer'
import type { Attrs } from 'bpmn-js/lib/draw/BpmnRenderer'
import type { Shape as BpmnShape } from 'bpmn-js/lib/model/Types'
import type EventBus from 'diagram-js/lib/core/EventBus'
import type { ElementLike, ShapeLike } from 'diagram-js/lib/core/Types'
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append, classes, create } from 'tiny-svg'
import { createIconGroup } from './cpiIcons'
import { classifyCpiElement, familyOfElement } from './cpiMetadata'
import type { CpiVisualKind, ShapeFamily } from './cpiCatalog'

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

/**
 * Tags an element as the shape's CPI outline: adds the `.cpi-shape-outline`
 * class (diff markers target it) and, when the member kind is known, the
 * `data-cpi-kind` label (change strip / diff category). The kind is optional so
 * unrecognized members still get an outline without a spurious label.
 */
function markCpiOutline(element: SVGElement, kind: CpiVisualKind | undefined,): void {
  classes(element).add('cpi-shape-outline')
  if (kind !== undefined) element.setAttribute('data-cpi-kind', kind)
}

/**
 * Adapts a diagram-js render element to the semantic Level-1 family: guards that
 * it is a shape, then delegates to `familyOfElement` (the authority, which reads
 * the businessObject). Returns undefined for non-shapes or non-CPI types. Shared
 * by `canRender` (the dispatch gate) and `drawShape` so the two can never
 * disagree: if canRender returns true, drawShape is guaranteed a defined family.
 */
function resolveShapeFamily(element: ElementLike): ShapeFamily | undefined {
  return isShapeElement(element)
    ? familyOfElement(element.businessObject)
    : undefined
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
    return resolveShapeFamily(element) !== undefined
  }

  drawShape(parentGfx: SVGElement, shape: ShapeLike, attrs?: Attrs,): SVGElement {
    const family = resolveShapeFamily(shape)

    // canRender gates drawShape to elements whose type maps to a family; an
    // undefined family here is defensive and delegates to the default renderer.
    if (family === undefined) {
      return this.bpmnRenderer.drawShape(parentGfx, shape as BpmnShape, attrs)
    }

    // Member kind refines icon/label within the family. It may be undefined when
    // the CPI metadata is unrecognized — the family still renders (a generic box
    // for self-drawn families, an outlined default glyph for delegated ones).
    const kind = classifyCpiElement(shape.businessObject)

    switch (family) {
      case 'activity':
        return this.drawActivity(parentGfx, shape, kind)
      case 'endpoint':
        return this.drawEndpoint(parentGfx, shape, kind)
      case 'pool':
        return this.drawPool(parentGfx, shape)
      default:
        // gateway / event / container — delegate the glyph (default renderer
        // draws the diamond / event trigger / container) then add the outline.
        return this.delegateWithOutline(parentGfx, shape, attrs, kind)
    }
  }

  getShapePath(shape: ShapeLike): string {
    return this.bpmnRenderer.getShapePath(shape as BpmnShape)
  }

  private delegateWithOutline(parentGfx: SVGElement, shape: ShapeLike, attrs: Attrs | undefined, kind: CpiVisualKind | undefined,): SVGElement {
    const mainGfx = this.bpmnRenderer.drawShape(
      parentGfx,
      shape as BpmnShape,
      attrs,
    )
    markCpiOutline(mainGfx, kind)
    return mainGfx
  }

  private drawActivity(parentGfx: SVGElement, shape: ShapeLike, kind: CpiVisualKind | undefined,): SVGElement {
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
    markCpiOutline(rect, kind)
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
      text.setAttribute('fill', 'rgb(19, 30, 41)')
      text.textContent = name
      classes(text).add('djs-label')
      append(parentGfx, text)
    }

    // CPI renders the activity icon as a full-size 16×16 image at (2,3). An
    // unrecognized member has no kind, so createIconGroup returns null (generic box).
    const badge = createIconGroup(kind, 2, 3, 16, 16)
    if (badge) append(parentGfx, badge)

    return rect
  }

  private drawPool(parentGfx: SVGElement, shape: ShapeLike): SVGElement {
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
    markCpiOutline(rect, 'IntegrationProcess')
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
      text.setAttribute('fill', 'rgb(19, 30, 41)')
      text.textContent = name
      classes(text).add('djs-label')
      append(parentGfx, text)
    }

    // Icon sits in the 30px header, vertically centered: (30-16)/2 = 7
    const badge = createIconGroup('IntegrationProcess', 5, 7, 16, 16)
    if (badge) append(parentGfx, badge)

    return rect
  }

  /**
   * Sender / Receiver participant endpoints. Replicates SAP CPI's own rendering:
   * a white 100×140-ish box with a 32px header band whose bottom border acts as
   * the separator, a System icon (16×14 at 5,10) and the name left-aligned next
   * to it. Colors match CPI's computed styles (border rgb(169,180,190),
   * text rgb(19,30,41)).
   */
  private drawEndpoint(parentGfx: SVGElement, shape: ShapeLike, kind: CpiVisualKind | undefined,): SVGElement {
    const width = safeDimension(shape.width, 100)
    const height = safeDimension(shape.height, 140)
    const headerHeight = 32

    const body = create('rect', {
      x: 0,
      y: 0,
      width,
      height,
    })
    body.setAttribute('fill', 'rgb(255, 255, 255)')
    body.setAttribute('stroke', 'rgb(169, 180, 190)')
    body.setAttribute('stroke-width', '1')
    markCpiOutline(body, kind)
    append(parentGfx, body)

    const header = create('rect', {
      x: 0,
      y: 0,
      width,
      height: headerHeight,
    })
    header.setAttribute('fill', 'rgb(255, 255, 255)')
    header.setAttribute('stroke', 'rgb(169, 180, 190)')
    header.setAttribute('stroke-width', '1')
    append(parentGfx, header)

    const icon = createIconGroup(kind, 5, 10, 16, 14)
    if (icon) append(parentGfx, icon)

    const name = getName(shape)
    if (name) {
      const text = create('text', {
        x: 31,
        y: 20,
      })
      text.setAttribute('font-size', '12')
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
      text.setAttribute('fill', 'rgb(19, 30, 41)')
      text.textContent = name
      classes(text).add('djs-label')
      append(parentGfx, text)
    }

    return body
  }
}

/** diagram-js DI module registration */
export const cpiRendererModule = {
  __init__: ['cpiRenderer'],
  cpiRenderer: ['type', CpiRenderer],
}
