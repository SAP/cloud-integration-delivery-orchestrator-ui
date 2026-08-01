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

const visualKindClass: Readonly<Record<CpiVisualKind, string>> = {
  ContentModifier: 'content-modifier',
  Script: 'script',
  Router: 'router',
  Send: 'send',
  RequestReply: 'request-reply',
  Sender: 'sender',
  Receiver: 'receiver',
  IntegrationProcess: 'integration-process',
}

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

function iconSize(width: number, height: number): number {
  const shortestSide = Math.min(width, height)
  if (shortestSide < 8) return Math.max(0.1, shortestSide / 2)
  return Math.min(24, shortestSide - 8)
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object'
    ? value as UnknownRecord
    : undefined
}

function participantLayout(shape: ShapeLike): {
  expanded: boolean
  horizontal: boolean
} | undefined {
  const businessObject = asRecord(shape.businessObject)
  if (businessObject?.$type !== 'bpmn:Participant') return undefined

  const shapeDi = asRecord(shape.di)
  const businessObjectDi = asRecord(businessObject.di)
  const di = shapeDi ?? businessObjectDi
  const horizontal = typeof di?.isHorizontal === 'boolean'
    ? di.isHorizontal
    : true
  const expanded = Boolean(businessObject.processRef)

  return { expanded, horizontal }
}

function participantIconPlacement(
  width: number,
  height: number,
  layout: { expanded: boolean; horizontal: boolean },
): { x: number; y: number; scale: number } {
  const regularSize = iconSize(width, height)

  if (!layout.expanded) {
    const size = Math.min(18, regularSize)
    return layout.horizontal
      ? {
          x: width + 4,
          y: Math.max(0, (height - size) / 2),
          scale: size / 24,
        }
      : {
          x: Math.max(0, (width - size) / 2),
          y: height + 4,
          scale: size / 24,
        }
  }

  const size = regularSize
  if (layout.horizontal) {
    const contentX = width - size - 8
    return contentX >= 30
      ? {
          x: contentX,
          y: Math.min(8, Math.max(0, height - size)),
          scale: size / 24,
        }
      : {
          x: width + 4,
          y: Math.max(0, (height - size) / 2),
          scale: size / 24,
        }
  }

  const contentY = 30 + 8
  return contentY + size <= height
    ? {
        x: Math.max(0, width - size - 8),
        y: contentY,
        scale: size / 24,
      }
    : {
        x: Math.max(0, (width - size) / 2),
        y: height + 4,
        scale: size / 24,
      }
}

function activityIconPlacement(
  width: number,
  height: number,
): { x: number; y: number; scale: number } {
  const size = iconSize(width, height)
  const gap = 4

  return {
    x: Math.min(8, Math.max(0, width - size)),
    y: -(size + gap),
    scale: size / 24,
  }
}

function iconPlacement(
  shape: ShapeLike,
  kind: CpiVisualKind,
): { x: number; y: number; scale: number } {
  const width = safeDimension(shape.width, 100)
  const height = safeDimension(shape.height, 80)
  const participant = participantLayout(shape)
  if (participant !== undefined) {
    return participantIconPlacement(width, height, participant)
  }

  const size = iconSize(width, height)
  if (kind === 'Router') {
    return {
      x: Math.max(0, (width - size) / 2),
      y: Math.max(0, (height - size) / 2),
      scale: size / 24,
    }
  }

  if (kind === 'ContentModifier'
    || kind === 'Script'
    || kind === 'Send'
    || kind === 'RequestReply') {
    return activityIconPlacement(width, height)
  }

  const avoidsParticipantTitle = kind === 'IntegrationProcess' && width >= 160
  return {
    x: Math.min(Math.max(0, width - size), avoidsParticipantTitle ? 32 : 8),
    y: Math.min(Math.max(0, height - size), 8),
    scale: size / 24,
  }
}

function createIconBadge(
  shape: ShapeLike,
  kind: CpiVisualKind,
): SVGGElement {
  const { x, y, scale } = iconPlacement(shape, kind)
  const icon = create('g', {
    class: `cpi-shape-icon cpi-kind-${visualKindClass[kind]}`,
    'data-cpi-kind': kind,
    'aria-hidden': 'true',
    focusable: 'false',
    transform: `translate(${x} ${y}) scale(${scale})`,
  })
  const badge = create('rect', {
    class: 'cpi-icon-badge',
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    rx: 4,
  })
  icon.setAttribute('pointer-events', 'none')
  badge.setAttribute('fill', 'var(--cpi-icon-badge-background, white)')
  badge.setAttribute('fill-opacity', '1')
  badge.setAttribute('stroke', 'none')

  append(icon, badge)
  append(icon, createCpiIconSymbol(kind))
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
    const mainGfx = this.bpmnRenderer.drawShape(
      parentGfx,
      shape as BpmnShape,
      attrs,
    )
    const kind = isShapeElement(shape)
      ? classifyCpiElement(shape.businessObject)
      : undefined

    if (kind === undefined) return mainGfx

    classes(mainGfx)
      .add('cpi-shape-outline')
      .add(`cpi-kind-${visualKindClass[kind]}`)
    mainGfx.setAttribute('data-cpi-kind', kind)
    append(parentGfx, createIconBadge(shape, kind))

    return mainGfx
  }

  getShapePath(shape: ShapeLike): string {
    return this.bpmnRenderer.getShapePath(shape as BpmnShape)
  }
}
