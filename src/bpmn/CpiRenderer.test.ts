import type BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer'
import Viewer from 'bpmn-js/lib/Viewer'
import type EventBus from 'diagram-js/lib/core/EventBus'
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry'
import type GraphicsFactory from 'diagram-js/lib/core/GraphicsFactory'
import type { ShapeLike } from 'diagram-js/lib/core/Types'
import { describe, expect, it, vi } from 'vitest'
import { withBpmnJsdomViewer } from '@/test/bpmnJsdomTestUtils'
import CpiRenderer, { CPI_RENDERER_PRIORITY } from './CpiRenderer'
import cpiRendererModule from './cpiRendererModule'
import { CPI_ICON_KINDS } from './cpiIcons'
import type { CpiVisualKind } from './cpiMetadata'

const SVG_NS = 'http://www.w3.org/2000/svg'

const allKinds: CpiVisualKind[] = [
  'ContentModifier',
  'Script',
  'Router',
  'Send',
  'RequestReply',
  'Sender',
  'Receiver',
  'IntegrationProcess',
]

function property(key: string, value: string) {
  return { $type: 'ifl:property', key, value }
}

function businessObjectFor(kind: CpiVisualKind): Record<string, unknown> {
  if (kind === 'Sender' || kind === 'Receiver' || kind === 'IntegrationProcess') {
    const participantType = kind === 'Sender'
      ? 'EndpointSender'
      : kind === 'Receiver'
        ? 'EndpointReceiver'
        : 'IntegrationProcess'

    return {
      $type: 'bpmn:Participant',
      $attrs: { 'ifl:type': participantType },
    }
  }

  const activityType: Record<
    Exclude<CpiVisualKind, 'Sender' | 'Receiver' | 'IntegrationProcess'>,
    string
  > = {
    ContentModifier: 'Enricher',
    Script: 'GroovyScript',
    Router: 'ExclusiveGateway',
    Send: 'Send',
    RequestReply: 'ExternalCall',
  }

  return {
    $type: kind === 'Router' ? 'bpmn:ExclusiveGateway' : 'bpmn:Task',
    extensionElements: {
      values: [property('activityType', activityType[kind])],
    },
  }
}

function shapeFor(
  kind: CpiVisualKind,
  overrides: Record<string, unknown> = {},
): ShapeLike {
  const participantKind = kind === 'Sender'
    || kind === 'Receiver'
    || kind === 'IntegrationProcess'

  return {
    id: `${kind}_1`,
    type: participantKind
      ? 'bpmn:Participant'
      : kind === 'Router'
        ? 'bpmn:ExclusiveGateway'
        : 'bpmn:Task',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    businessObject: businessObjectFor(kind),
    ...overrides,
  } as unknown as ShapeLike
}

function participantShape(
  kind: 'Sender' | 'Receiver' | 'IntegrationProcess',
  {
    expanded,
    horizontal,
    width,
    height,
  }: {
    expanded: boolean
    horizontal: boolean
    width: number
    height: number
  },
): ShapeLike {
  const businessObject = businessObjectFor(kind)
  if (expanded) businessObject.processRef = { id: `${kind}_Process` }

  return shapeFor(kind, {
    type: 'bpmn:Participant',
    width,
    height,
    businessObject,
    di: {
      $type: 'bpmndi:BPMNShape',
      isExpanded: expanded,
      isHorizontal: horizontal,
    },
  })
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name)
}

function rendererFixture() {
  const eventBus = {
    on: vi.fn(),
  } as unknown as EventBus
  const mainGeometry = svgElement('rect')
  mainGeometry.setAttribute('class', 'default-shape')
  const drawShape = vi.fn((parent: SVGElement) => {
    parent.append(mainGeometry)
    return mainGeometry
  })
  const bpmnRenderer = {
    drawShape,
    drawConnection: vi.fn(() => svgElement('path')),
    getShapePath: vi.fn(() => 'M 0 0 L 10 10'),
  } as unknown as BpmnRenderer

  return {
    bpmnRenderer,
    drawShape,
    eventBus,
    mainGeometry,
    renderer: new CpiRenderer(eventBus, bpmnRenderer),
  }
}

function iconTransform(visuals: SVGElement): number[] {
  const transform = visuals
    .querySelector<SVGGElement>('.cpi-shape-icon')
    ?.getAttribute('transform')
  const match = /^translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)$/.exec(
    transform ?? '',
  )

  expect(match).not.toBeNull()
  return match!.slice(1).map(Number)
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function iconBounds(visuals: SVGElement): Bounds {
  const [x, y, scale] = iconTransform(visuals)
  return { x, y, width: 24 * scale, height: 24 * scale }
}

function intersects(first: Bounds, second: Bounds): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

const integrationXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:ifl="http://example.com/ifl"
  id="Definitions_1"
  targetNamespace="http://example.com/cpi-renderer">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="Task_1" name="Transform payload">
      <bpmn:extensionElements>
        <ifl:property>
          <ifl:key>activityType</ifl:key>
          <ifl:value>Enricher</ifl:value>
        </ifl:property>
      </bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant
      id="Participant_1"
      name="Sender endpoint"
      processRef="Process_1"
      ifl:type="EndpointSender" />
  </bpmn:collaboration>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape
        id="Participant_1_di"
        bpmnElement="Participant_1"
        isHorizontal="true">
        <dc:Bounds x="20" y="20" width="600" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="100" y="80" width="100" height="60" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe('CpiRenderer', () => {
  it('renders one deterministic and distinguishable symbol for every CPI kind', () => {
    expect(CPI_ICON_KINDS).toEqual(allKinds)
    const structures = new Set<string>()

    for (const kind of allKinds) {
      const { renderer } = rendererFixture()
      const visuals = svgElement('g')

      renderer.drawShape(visuals, shapeFor(kind))

      const icons = visuals.querySelectorAll('.cpi-shape-icon')
      expect(icons).toHaveLength(1)
      expect(icons[0].getAttribute('data-cpi-kind')).toBe(kind)

      const symbols = icons[0].querySelectorAll('.cpi-icon-symbol')
      expect(symbols).toHaveLength(1)
      expect(symbols[0].getAttribute('data-cpi-symbol')).toBe(kind)
      expect(icons[0].children[0].classList.contains('cpi-icon-badge')).toBe(true)
      expect(icons[0].children[1]).toBe(symbols[0])

      const structure = Array.from(symbols[0].children)
        .map(child => `${child.tagName}:${child.getAttribute('d') ?? ''}`)
        .join('|')
      expect(structure).not.toBe('')
      structures.add(structure)
    }

    expect(structures.size).toBe(allKinds.length)
  })

  it('decorates the returned default geometry without changing existing labels', () => {
    const { drawShape, mainGeometry, renderer } = rendererFixture()
    const visuals = svgElement('g')
    const label = svgElement('text')
    label.setAttribute('class', 'djs-label')
    label.textContent = 'Keep this label'
    visuals.append(label)
    const labelBefore = label.outerHTML
    const shape = shapeFor('Script')

    const result = renderer.drawShape(visuals, shape)

    expect(drawShape).toHaveBeenCalledOnce()
    expect(drawShape).toHaveBeenCalledWith(visuals, shape, undefined)
    expect(result).toBe(mainGeometry)
    expect(mainGeometry.classList.contains('default-shape')).toBe(true)
    expect(mainGeometry.classList.contains('cpi-shape-outline')).toBe(true)
    expect(mainGeometry.classList.contains('cpi-kind-script')).toBe(true)
    expect(mainGeometry.getAttribute('data-cpi-kind')).toBe('Script')
    expect(
      visuals
        .querySelector('.cpi-shape-icon path')
        ?.classList.contains('cpi-shape-outline'),
    ).not.toBe(true)
    expect(label.outerHTML).toBe(labelBefore)
  })

  it('only claims recognized non-label shape elements', () => {
    const { renderer } = rendererFixture()
    const recognized = shapeFor('Send')
    const unknown = {
      ...recognized,
      businessObject: { $type: 'bpmn:Task' },
    } as ShapeLike
    const label = {
      ...recognized,
      labelTarget: recognized,
    } as ShapeLike
    const connection = {
      ...recognized,
      waypoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    } as unknown as ShapeLike
    const notAShape = {
      id: 'metadata-only',
      businessObject: businessObjectFor('Send'),
    } as unknown as ShapeLike

    expect(renderer.canRender(recognized)).toBe(true)
    expect(renderer.canRender(unknown)).toBe(false)
    expect(renderer.canRender(label)).toBe(false)
    expect(renderer.canRender(connection)).toBe(false)
    expect(renderer.canRender(notAShape)).toBe(false)
  })

  it('defensively delegates unknown direct draw calls without decoration', () => {
    const { drawShape, mainGeometry, renderer } = rendererFixture()
    const visuals = svgElement('g')
    const unknown = {
      ...shapeFor('Send'),
      businessObject: {
        extensionElements: {
          values: [property('activityType', 'NotACpiShape')],
        },
      },
    } as ShapeLike

    const result = renderer.drawShape(visuals, unknown)

    expect(result).toBe(mainGeometry)
    expect(drawShape).toHaveBeenCalledOnce()
    expect(mainGeometry.classList.contains('cpi-shape-outline')).toBe(false)
    expect(mainGeometry.hasAttribute('data-cpi-kind')).toBe(false)
    expect(visuals.querySelector('.cpi-shape-icon')).toBeNull()
  })

  it('defensively delegates direct label draw calls without decoration', () => {
    const { drawShape, mainGeometry, renderer } = rendererFixture()
    const visuals = svgElement('g')
    const target = shapeFor('Send')
    const label = {
      ...target,
      id: 'Send_1_label',
      labelTarget: target,
    } as ShapeLike

    const result = renderer.drawShape(visuals, label)

    expect(result).toBe(mainGeometry)
    expect(drawShape).toHaveBeenCalledOnce()
    expect(mainGeometry.classList.contains('cpi-shape-outline')).toBe(false)
    expect(mainGeometry.hasAttribute('data-cpi-kind')).toBe(false)
    expect(visuals.querySelector('.cpi-shape-icon')).toBeNull()
  })

  it('creates a pointer-inert, hidden, monochrome icon on an opaque badge', () => {
    const { renderer } = rendererFixture()
    const visuals = svgElement('g')

    renderer.drawShape(visuals, shapeFor('RequestReply'))

    const icon = visuals.querySelector<SVGGElement>('.cpi-shape-icon')!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('focusable')).toBe('false')
    expect(icon.getAttribute('pointer-events')).toBe('none')

    const badge = icon.querySelector<SVGRectElement>('.cpi-icon-badge')!
    expect(badge.getAttribute('fill')).toBe(
      'var(--cpi-icon-badge-background, white)',
    )
    expect(badge.getAttribute('fill-opacity')).toBe('1')

    const symbol = icon.querySelector<SVGGElement>('.cpi-icon-symbol')!
    expect(symbol.getAttribute('stroke')).toBe('currentColor')
    for (const paintedNode of symbol.querySelectorAll('[stroke], [fill]')) {
      for (const attribute of ['stroke', 'fill']) {
        const value = paintedNode.getAttribute(attribute)
        if (value !== null) expect(['currentColor', 'none']).toContain(value)
      }
    }
  })

  it.each([
    'ContentModifier',
    'Script',
    'Send',
    'RequestReply',
  ] as const)(
    'places a 100x60 %s badge above the embedded-label region',
    (kind) => {
      const { renderer } = rendererFixture()
      const visuals = svgElement('g')
      const label = svgElement('text')
      label.setAttribute('class', 'djs-label')
      label.textContent = kind === 'RequestReply'
        ? 'Request customer details and wait for the complete reply'
        : `${kind} label`
      visuals.append(label)
      const labelBefore = label.outerHTML
      const shape = shapeFor(kind, { width: 100, height: 60 })

      renderer.drawShape(visuals, shape)

      const badge = iconBounds(visuals)
      expect(intersects(
        badge,
        { x: 0, y: 0, width: shape.width, height: shape.height },
      )).toBe(false)
      expect(badge.x).toBeGreaterThanOrEqual(0)
      expect(badge.x + badge.width).toBeLessThanOrEqual(shape.width)
      expect(badge.y + badge.height).toBeLessThan(0)
      expect(label.outerHTML).toBe(labelBefore)
    },
  )

  it('keeps compact Router gateway badges centered', () => {
    const compactVisuals = svgElement('g')
    const { renderer } = rendererFixture()

    renderer.drawShape(
      compactVisuals,
      shapeFor('Router', { width: 50, height: 50 }),
    )

    expect(iconTransform(compactVisuals)).toEqual([13, 13, 1])
  })

  it.each([
    {
      name: 'expanded horizontal sender',
      kind: 'Sender',
      expanded: true,
      horizontal: true,
      width: 600,
      height: 200,
      labelRegion: { x: 0, y: 0, width: 30, height: 200 },
    },
    {
      name: 'expanded vertical receiver',
      kind: 'Receiver',
      expanded: true,
      horizontal: false,
      width: 200,
      height: 300,
      labelRegion: { x: 0, y: 0, width: 200, height: 30 },
    },
    {
      name: 'collapsed horizontal integration process',
      kind: 'IntegrationProcess',
      expanded: false,
      horizontal: true,
      width: 300,
      height: 40,
      labelRegion: { x: 0, y: 0, width: 300, height: 40 },
    },
    {
      name: 'collapsed vertical sender',
      kind: 'Sender',
      expanded: false,
      horizontal: false,
      width: 40,
      height: 300,
      labelRegion: { x: 0, y: 0, width: 40, height: 300 },
    },
  ] as const)(
    'keeps the badge outside the $name label region',
    ({ kind, expanded, horizontal, width, height, labelRegion }) => {
      const { renderer } = rendererFixture()
      const visuals = svgElement('g')
      const shape = participantShape(kind, {
        expanded,
        horizontal,
        width,
        height,
      })

      renderer.drawShape(visuals, shape)

      expect(shape.type).toBe('bpmn:Participant')
      expect(intersects(iconBounds(visuals), labelRegion)).toBe(false)
    },
  )

  it('reads participant orientation from business-object DI as a fallback', () => {
    const { renderer } = rendererFixture()
    const visuals = svgElement('g')
    const shape = participantShape('Receiver', {
      expanded: true,
      horizontal: false,
      width: 200,
      height: 300,
    })
    const businessObject = shape.businessObject as Record<string, unknown>
    businessObject.di = shape.di
    delete shape.di

    renderer.drawShape(visuals, shape)

    expect(intersects(
      iconBounds(visuals),
      { x: 0, y: 0, width: 200, height: 30 },
    )).toBe(false)
  })

  it('treats DI-expanded participants without processRef as collapsed', () => {
    const { renderer } = rendererFixture()
    const visuals = svgElement('g')
    const shape = participantShape('Sender', {
      expanded: false,
      horizontal: true,
      width: 300,
      height: 40,
    })
    shape.di.isExpanded = true
    delete shape.di.isHorizontal

    renderer.drawShape(visuals, shape)

    const badge = iconBounds(visuals)
    expect(badge.x).toBeGreaterThanOrEqual(shape.width)
    expect(intersects(
      badge,
      { x: 0, y: 0, width: shape.width, height: shape.height },
    )).toBe(false)
  })

  it('treats participants with processRef as expanded despite false DI state', () => {
    const { renderer } = rendererFixture()
    const visuals = svgElement('g')
    const shape = participantShape('IntegrationProcess', {
      expanded: true,
      horizontal: false,
      width: 200,
      height: 300,
    })
    shape.di.isExpanded = false

    renderer.drawShape(visuals, shape)

    const badge = iconBounds(visuals)
    expect(badge.y).toBeGreaterThanOrEqual(30)
    expect(badge.y + badge.height).toBeLessThanOrEqual(shape.height)
  })

  it('keeps icon transforms finite and bounded for undersized or malformed dimensions', () => {
    const { renderer } = rendererFixture()
    const undersizedVisuals = svgElement('g')
    const malformedVisuals = svgElement('g')
    const malformedParticipantVisuals = svgElement('g')

    renderer.drawShape(
      undersizedVisuals,
      shapeFor('RequestReply', { width: 2, height: 3 }),
    )
    renderer.drawShape(
      malformedVisuals,
      shapeFor('Script', { width: Number.NaN, height: Number.NEGATIVE_INFINITY }),
    )
    renderer.drawShape(
      malformedParticipantVisuals,
      participantShape('Sender', {
        expanded: false,
        horizontal: true,
        width: Number.NaN,
        height: Number.NEGATIVE_INFINITY,
      }),
    )

    const undersized = iconTransform(undersizedVisuals)
    const malformed = iconTransform(malformedVisuals)
    const malformedParticipant = iconTransform(malformedParticipantVisuals)

    expect(undersized.every(Number.isFinite)).toBe(true)
    expect(undersized[0]).toBeGreaterThanOrEqual(0)
    expect(undersized[0] + undersized[2] * 24).toBeLessThanOrEqual(2)
    expect(undersized[1] + undersized[2] * 24).toBeLessThan(0)
    expect(undersized[2]).toBeGreaterThan(0)
    expect(malformed).toEqual([8, -28, 1])
    expect(malformedParticipant.every(Number.isFinite)).toBe(true)
    expect(malformedParticipant[0]).toBeGreaterThanOrEqual(100)
  })

  it('delegates shape path calculation to the default BPMN renderer', () => {
    const { bpmnRenderer, renderer } = rendererFixture()
    const shape = shapeFor('ContentModifier')

    expect(renderer.getShapePath(shape)).toBe('M 0 0 L 10 10')
    expect(bpmnRenderer.getShapePath).toHaveBeenCalledWith(shape)
  })

  it('registers through diagram-js DI above the default renderer priority', () => {
    const { eventBus } = rendererFixture()
    const priorities = vi.mocked(eventBus.on).mock.calls.map(call => call[1])

    expect(CPI_RENDERER_PRIORITY).toBe(1500)
    expect(CPI_RENDERER_PRIORITY).toBeGreaterThan(1000)
    expect(priorities).toEqual([CPI_RENDERER_PRIORITY, CPI_RENDERER_PRIORITY])
    expect(CpiRenderer.$inject).toEqual(['eventBus', 'bpmnRenderer'])
    expect(cpiRendererModule).toEqual({
      __init__: ['cpiRenderer'],
      cpiRenderer: ['type', CpiRenderer],
    })
  })

  it('integrates with real bpmn-js DI and rendering without duplicate output', async () => {
    await withBpmnJsdomViewer(
      container => new Viewer({
        container,
        additionalModules: [cpiRendererModule],
      }),
      async (viewer, container) => {
        const result = await viewer.importXML(integrationXml)
        const registry = viewer.get<ElementRegistry>('elementRegistry')
        const graphicsFactory = viewer.get<GraphicsFactory>('graphicsFactory')
        const task = registry.get('Task_1') as ShapeLike
        const participant = registry.get('Participant_1') as ShapeLike
        const taskVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Task_1"] .djs-visual',
        )!
        const participantVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Participant_1"] .djs-visual',
        )!

        expect(result.warnings).toEqual([])
        expect(viewer.get<CpiRenderer>('cpiRenderer')).toBeInstanceOf(CpiRenderer)
        expect(taskVisual.querySelectorAll(':scope > .cpi-shape-outline')).toHaveLength(1)
        expect(taskVisual.querySelectorAll(':scope > .cpi-shape-icon')).toHaveLength(1)
        expect(taskVisual.querySelectorAll(':scope > rect')).toHaveLength(1)
        expect(taskVisual.querySelectorAll('.djs-label')).toHaveLength(1)
        const taskLabel = taskVisual.querySelector<SVGTextElement>('.djs-label')!
        expect(taskLabel.textContent).toBe('Transform payload')
        expect(intersects(
          iconBounds(taskVisual),
          { x: 0, y: 0, width: task.width, height: task.height },
        )).toBe(false)

        expect(
          participantVisual.querySelectorAll(':scope > .cpi-shape-outline'),
        ).toHaveLength(1)
        expect(
          participantVisual.querySelectorAll(':scope > .cpi-shape-icon'),
        ).toHaveLength(1)
        expect(participantVisual.querySelectorAll(':scope > rect')).toHaveLength(1)
        expect(participantVisual.querySelectorAll('.djs-label')).toHaveLength(1)
        expect(participantVisual.textContent).toContain('Sender endpoint')
        expect(participantVisual.querySelectorAll(':scope > path')).toHaveLength(1)
        expect(intersects(
          iconBounds(participantVisual),
          { x: 0, y: 0, width: 30, height: participant.height },
        )).toBe(false)

        const path = graphicsFactory.getShapePath(task)
        expect(path).toBe(viewer.get<BpmnRenderer>('bpmnRenderer').getShapePath(
          task as never,
        ))
        expect(path).toContain('M')
      },
    )
  })
})
