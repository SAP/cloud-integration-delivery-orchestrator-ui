import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { withBpmnJsdomViewer } from './bpmnJsdomTestUtils'
import bpmnDiffCss from './bpmnDiff.css?raw'
import cpiRendererModule from './cpiRendererModule'
import type { BpmnChangeStatus, BpmnElementChange } from './diff'
import {
  createBpmnViewer,
  type ViewerFactory,
  type ViewerLike,
} from './viewer'

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC'
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI'

const changes: BpmnElementChange[] = [
  change('Added_1', 'added'),
  change('Removed_1', 'removed'),
  change('Changed_1', 'changed'),
  change('Layout_1', 'layout-only')
]

function change(id: string, status: BpmnChangeStatus): BpmnElementChange {
  return {
    id,
    type: 'bpmn:Task',
    status,
    alsoLayoutChanged: status === 'layout-only'
  }
}

const subprocessXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="${BPMN_NS}"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:di="${DI_NS}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1">
      <bpmn:startEvent id="Start_1" />
      <bpmn:task id="Task_1" />
      <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Sub_1_di" bpmnElement="Sub_1">
        <dc:Bounds x="80" y="60" width="360" height="220" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="120" y="140" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="240" y="118" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="156" y="158" />
        <di:waypoint x="240" y="158" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const rendererIntegrationXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="${BPMN_NS}"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:ifl="http://example.com/ifl"
  targetNamespace="http://example.com/cpi-renderer">
  <bpmn:process id="Process_1">
    <bpmn:task id="Recognized_1" name="Recognized label">
      <bpmn:extensionElements>
        <ifl:property>
          <ifl:key>activityType</ifl:key>
          <ifl:value>Enricher</ifl:value>
        </ifl:property>
      </bpmn:extensionElements>
    </bpmn:task>
    <bpmn:task id="Unknown_1" name="Unknown label">
      <bpmn:extensionElements>
        <ifl:property>
          <ifl:key>activityType</ifl:key>
          <ifl:value>UnknownCpiActivity</ifl:value>
        </ifl:property>
      </bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Recognized_1_di" bpmnElement="Recognized_1">
        <dc:Bounds x="80" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Unknown_1_di" bpmnElement="Unknown_1">
        <dc:Bounds x="240" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const diffStyles = {
  added: {
    marker: 'bpmn-diff-added',
    stroke: '#107e3e',
    fill: '#e8f5e9',
    dash: 'none',
  },
  removed: {
    marker: 'bpmn-diff-removed',
    stroke: '#bb0000',
    fill: '#ffebee',
    dash: '8 4',
  },
  changed: {
    marker: 'bpmn-diff-changed',
    stroke: '#c35500',
    fill: '#fff3e0',
    dash: '4 3',
  },
  'layout-only': {
    marker: 'bpmn-diff-layout',
    stroke: '#0a6ed1',
    fill: '#eaf3fc',
    dash: '1 4',
  },
} as const satisfies Record<
  BpmnChangeStatus,
  { marker: string; stroke: string; fill: string; dash: string }
>

type DiffStyle = (typeof diffStyles)[BpmnChangeStatus]

const bpmnDiffCssSource = bpmnDiffCss || readFileSync(
  resolve(process.cwd(), 'src/bpmn/bpmnDiff.css'),
  'utf8',
)

async function withDiffStyles<TResult>(
  run: (style: HTMLStyleElement) => Promise<TResult>,
): Promise<TResult> {
  const style = document.createElement('style')
  style.textContent = bpmnDiffCssSource
  document.head.append(style)

  try {
    return await run(style)
  } finally {
    style.remove()
  }
}

async function withRenderedDiffViewer<TResult>(
  run: (
    handle: ReturnType<typeof createBpmnViewer>,
    container: HTMLDivElement,
    style: HTMLStyleElement,
  ) => Promise<TResult>,
): Promise<TResult> {
  return withDiffStyles(style => withBpmnJsdomViewer(
    container => createBpmnViewer(container),
    async (handle, container) => {
      await handle.importXml(rendererIntegrationXml)
      return run(handle, container, style)
    },
  ))
}

function renderedElement(container: HTMLElement, id: string): SVGGElement {
  const element = container.querySelector<SVGGElement>(`[data-element-id="${id}"]`)
  expect(element).not.toBeNull()
  return element!
}

function directVisual(element: Element): SVGGElement {
  const visual = element.querySelector<SVGGElement>(':scope > .djs-visual')
  expect(visual).not.toBeNull()
  return visual!
}

function cssSelectors(style: HTMLStyleElement): string[] {
  const rules = Array.from(style.sheet?.cssRules ?? [])
  return rules.flatMap(rule => (
    'selectorText' in rule
      ? (rule as CSSStyleRule).selectorText.split(',').map(selector => selector.trim())
      : []
  ))
}

function matchingMarkerTargets(
  style: HTMLStyleElement,
  container: HTMLElement,
  marker: string,
): Element[] {
  return cssSelectors(style)
    .filter(selector => selector.includes(`.${marker} `))
    .flatMap(selector => Array.from(container.querySelectorAll(selector)))
}

function expectDiffStyle(element: Element, expected: DiffStyle): void {
  const computed = getComputedStyle(element)
  expect(computed.stroke).toBe(expected.stroke)
  expect(computed.strokeWidth).toBe('2.5px')
  expect(computed.strokeDasharray).toBe(expected.dash)
  expect(computed.fill).toBe(expected.fill)
}

function removeSvgPresentationPaint(element: Element): void {
  for (const attribute of [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'style',
  ]) {
    element.removeAttribute(attribute)
  }
}

function geometry(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return [
    ...Array.from(document.getElementsByTagNameNS(DC_NS, 'Bounds')),
    ...Array.from(document.getElementsByTagNameNS(DI_NS, 'waypoint')),
  ].map(element => element.outerHTML)
}

function createHarness(elementIds: string[] = []) {
  const elements = new Map(elementIds.map((id) => [id, { id }]))
  const replaceElements = (ids: string[]) => {
    elements.clear()
    ids.forEach((id) => elements.set(id, { id }))
  }
  const canvas = {
    addMarker: vi.fn(),
    removeMarker: vi.fn(),
    resized: vi.fn(),
    zoom: vi.fn(),
    scrollToElement: vi.fn()
  }
  const registry = {
    get: vi.fn((id: string) => elements.get(id))
  }
  const get = vi.fn((name: string) => {
    if (name === 'canvas') return canvas
    if (name === 'elementRegistry') return registry
    throw new Error(`Unexpected service: ${name}`)
  })
  const importXML = vi.fn<ViewerLike['importXML']>().mockResolvedValue({ warnings: [] })
  const viewer = {
    importXML,
    get,
    destroy: vi.fn()
  }
  const factory = vi.fn<ViewerFactory>(() => viewer as unknown as ViewerLike)
  const container = document.createElement('div')
  const handle = createBpmnViewer(container, factory)

  return {
    canvas,
    container,
    factory,
    get,
    handle,
    replaceElements,
    registry,
    viewer
  }
}

describe('createBpmnViewer', () => {
  it('imports XML and marks only right-side semantic changes', async () => {
    const harness = createHarness(changes.map((item) => item.id))
    harness.viewer.importXML.mockResolvedValueOnce({
      warnings: ['Import warning']
    })

    const result = await harness.handle.importXml('<xml/>')
    harness.handle.applyChanges(changes, 'right', false)

    expect(harness.factory).toHaveBeenCalledWith({
      container: harness.container,
      additionalModules: [cpiRendererModule]
    })
    expect(harness.viewer.importXML).toHaveBeenCalledWith('<xml/>')
    expect(result).toEqual({ warnings: ['Import warning'] })
    expect(harness.canvas.addMarker.mock.calls).toEqual([
      ['Added_1', 'bpmn-diff-added'],
      ['Changed_1', 'bpmn-diff-changed']
    ])
  })

  it('imports a preprocessed render copy without changing caller XML or DI geometry', async () => {
    const harness = createHarness()
    const callerXml = subprocessXml
    const originalXml = `${callerXml}`

    await harness.handle.importXml(callerXml)

    const importedXml = harness.viewer.importXML.mock.calls[0][0]
    const importedDocument = new DOMParser().parseFromString(importedXml, 'application/xml')
    const subprocessShape = Array.from(
      importedDocument.getElementsByTagNameNS(BPMNDI_NS, 'BPMNShape'),
    ).find(shape => shape.getAttribute('bpmnElement') === 'Sub_1')

    expect(importedXml).not.toBe(callerXml)
    expect(subprocessShape?.getAttribute('isExpanded')).toBe('true')
    expect(geometry(importedXml)).toEqual(geometry(callerXml))
    expect(callerXml).toBe(originalXml)
  })

  it.each([
    ['ordinary', `<bpmn:definitions xmlns:bpmn="${BPMN_NS}"><bpmn:process id="Process_1" /></bpmn:definitions>`],
    ['malformed', '<bpmn:definitions><bpmn:process></bpmn:definitions>'],
  ])('passes %s XML to the viewer byte-for-byte unchanged', async (_label, xml) => {
    const harness = createHarness()

    await harness.handle.importXml(xml)

    expect(harness.viewer.importXML).toHaveBeenCalledWith(xml)
  })

  it('uses the real viewer path to render recognized CPI shapes once and preserve fallback labels', async () => {
    await withBpmnJsdomViewer(
      container => createBpmnViewer(container),
      async (handle, container) => {
        await handle.importXml(rendererIntegrationXml)
        const recognizedVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Recognized_1"] .djs-visual',
        )!
        const unknownVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Unknown_1"] .djs-visual',
        )!

        expect(recognizedVisual.querySelectorAll(':scope > .cpi-shape-icon')).toHaveLength(1)
        expect(recognizedVisual.querySelectorAll(':scope > .cpi-shape-outline')).toHaveLength(1)
        expect(recognizedVisual.querySelectorAll('.djs-label')).toHaveLength(1)
        expect(recognizedVisual.textContent).toContain('Recognized label')
        expect(unknownVisual.querySelector('.cpi-shape-icon')).toBeNull()
        expect(unknownVisual.querySelector('.cpi-shape-outline')).toBeNull()
        expect(unknownVisual.querySelectorAll(':scope > rect')).toHaveLength(1)
        expect(unknownVisual.querySelectorAll('.djs-label')).toHaveLength(1)
        expect(unknownVisual.textContent).toContain('Unknown label')

        await handle.importXml(rendererIntegrationXml)
        const reimportedRecognizedVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Recognized_1"] .djs-visual',
        )!
        const reimportedUnknownVisual = container.querySelector<SVGGElement>(
          '[data-element-id="Unknown_1"] .djs-visual',
        )!

        expect(reimportedRecognizedVisual.querySelectorAll(':scope > .cpi-shape-icon'))
          .toHaveLength(1)
        expect(reimportedRecognizedVisual.querySelectorAll(':scope > .cpi-shape-outline'))
          .toHaveLength(1)
        expect(reimportedRecognizedVisual.querySelectorAll('.djs-label')).toHaveLength(1)
        expect(reimportedUnknownVisual.querySelector('.cpi-shape-icon')).toBeNull()
        expect(reimportedUnknownVisual.querySelector('.cpi-shape-outline')).toBeNull()
        expect(reimportedUnknownVisual.querySelectorAll('.djs-label')).toHaveLength(1)
      },
    )
  })

  it('defines authoritative CPI outline selectors while retaining guarded shape and connection fallbacks', async () => {
    await withDiffStyles(async (style) => {
      expect(bpmnDiffCssSource).toContain('.djs-shape.bpmn-diff-added')
      expect(style.textContent).toBe(bpmnDiffCssSource)
      expect(style.sheet?.cssRules.length).toBeGreaterThan(0)
      const selectors = cssSelectors(style)

      for (const { marker } of Object.values(diffStyles)) {
        expect(selectors).toContain(
          `.djs-shape.${marker} .djs-visual > .cpi-shape-outline`,
        )
        expect(selectors).toContain(
          `.djs-shape.${marker} .djs-visual > :first-child:not(.cpi-shape-icon):not(.cpi-icon-symbol):not(.cpi-icon-badge):not(.djs-label)`,
        )
        expect(selectors).toContain(
          `.djs-connection.${marker} .djs-visual > path`,
        )
      }
    })
  })

  it('targets only CPI outlines for every marker even when the icon is the first visual', async () => {
    await withRenderedDiffViewer(async (handle, container, style) => {
      const element = renderedElement(container, 'Recognized_1')
      const visual = directVisual(element)
      const outline = visual.querySelector<SVGElement>(':scope > .cpi-shape-outline')!
      const icon = visual.querySelector<SVGGElement>(':scope > .cpi-shape-icon')!
      const badge = icon.querySelector<SVGElement>('.cpi-icon-badge')!
      const symbol = icon.querySelector<SVGElement>('.cpi-icon-symbol')!
      const label = visual.querySelector<SVGElement>('.djs-label')!
      const protectedNodes = [icon, badge, symbol, label]
      removeSvgPresentationPaint(outline)
      const protectedStyles = protectedNodes.map(node => ({
        fill: getComputedStyle(node).fill,
        stroke: getComputedStyle(node).stroke,
      }))

      visual.prepend(icon)
      expect(visual.firstElementChild).toBe(icon)

      for (const [status, expected] of Object.entries(diffStyles) as Array<
        [BpmnChangeStatus, DiffStyle]
      >) {
        handle.applyChanges(
          [change('Recognized_1', status)],
          status === 'removed' ? 'left' : 'right',
          true,
        )

        expect(element.classList.contains(expected.marker)).toBe(true)
        expect(new Set(matchingMarkerTargets(style, container, expected.marker)))
          .toEqual(new Set([outline]))
        expectDiffStyle(outline, expected)
        protectedNodes.forEach((node, index) => {
          expect({
            fill: getComputedStyle(node).fill,
            stroke: getComputedStyle(node).stroke,
          }).toEqual(protectedStyles[index])
        })
      }
    })
  })

  it('shows added only on source/right, removed only on target/left, and changed on both', async () => {
    await withRenderedDiffViewer(async (handle, container) => {
      const element = renderedElement(container, 'Recognized_1')
      const cases = [
        { status: 'added', right: true, left: false },
        { status: 'removed', right: false, left: true },
        { status: 'changed', right: true, left: true },
      ] as const

      for (const { status, right, left } of cases) {
        const marker = diffStyles[status].marker

        handle.applyChanges([change('Recognized_1', status)], 'right', false)
        expect(element.classList.contains(marker)).toBe(right)

        handle.applyChanges([change('Recognized_1', status)], 'left', false)
        expect(element.classList.contains(marker)).toBe(left)
      }
    })
  })

  it('shows layout-only on both sides only while enabled and removes its styling when hidden', async () => {
    await withRenderedDiffViewer(async (handle, container) => {
      const element = renderedElement(container, 'Recognized_1')
      const outline = directVisual(element)
        .querySelector<SVGElement>(':scope > .cpi-shape-outline')!
      removeSvgPresentationPaint(outline)
      const originalStyle = {
        fill: getComputedStyle(outline).fill,
        stroke: getComputedStyle(outline).stroke,
        strokeDasharray: getComputedStyle(outline).strokeDasharray,
      }

      for (const side of ['right', 'left'] as const) {
        handle.applyChanges([change('Recognized_1', 'layout-only')], side, true)
        expect(element.classList.contains(diffStyles['layout-only'].marker)).toBe(true)
        expectDiffStyle(outline, diffStyles['layout-only'])

        handle.applyChanges([change('Recognized_1', 'layout-only')], side, false)
        expect(element.classList.contains(diffStyles['layout-only'].marker)).toBe(false)
        expect({
          fill: getComputedStyle(outline).fill,
          stroke: getComputedStyle(outline).stroke,
          strokeDasharray: getComputedStyle(outline).strokeDasharray,
        }).toEqual(originalStyle)
      }
    })
  })

  it('styles unknown BPMN shapes through the guarded default-geometry fallback', async () => {
    await withRenderedDiffViewer(async (handle, container, style) => {
      const element = renderedElement(container, 'Unknown_1')
      const visual = directVisual(element)
      const geometry = visual.querySelector<SVGElement>(':scope > :first-child')!
      removeSvgPresentationPaint(geometry)

      expect(geometry.matches('.cpi-shape-outline')).toBe(false)
      expect(geometry.matches('.cpi-shape-icon, .cpi-icon-symbol, .cpi-icon-badge, .djs-label'))
        .toBe(false)

      handle.applyChanges([change('Unknown_1', 'changed')], 'right', false)

      expect(element.classList.contains(diffStyles.changed.marker)).toBe(true)
      expect(
        matchingMarkerTargets(style, container, diffStyles.changed.marker).includes(geometry),
      ).toBe(true)
      expectDiffStyle(geometry, diffStyles.changed)
    })
  })

  it('clears old marker classes and computed styles on repeated applyChanges calls', async () => {
    await withRenderedDiffViewer(async (handle, container) => {
      const element = renderedElement(container, 'Recognized_1')
      const outline = directVisual(element)
        .querySelector<SVGElement>(':scope > .cpi-shape-outline')!
      removeSvgPresentationPaint(outline)
      const originalStyle = {
        fill: getComputedStyle(outline).fill,
        stroke: getComputedStyle(outline).stroke,
        strokeDasharray: getComputedStyle(outline).strokeDasharray,
      }

      handle.applyChanges([change('Recognized_1', 'added')], 'right', false)
      expect(element.classList.contains(diffStyles.added.marker)).toBe(true)
      expectDiffStyle(outline, diffStyles.added)

      handle.applyChanges([change('Recognized_1', 'changed')], 'right', false)
      expect(element.classList.contains(diffStyles.added.marker)).toBe(false)
      expect(element.classList.contains(diffStyles.changed.marker)).toBe(true)
      expectDiffStyle(outline, diffStyles.changed)

      handle.applyChanges([], 'right', false)
      expect(element.classList.contains(diffStyles.changed.marker)).toBe(false)
      expect({
        fill: getComputedStyle(outline).fill,
        stroke: getComputedStyle(outline).stroke,
        strokeDasharray: getComputedStyle(outline).strokeDasharray,
      }).toEqual(originalStyle)
    })
  })

  it('restores globals and removes the container when viewer creation throws', async () => {
    const svgMatrixDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'SVGMatrix')
    const bodyChildCount = document.body.childElementCount
    const creationError = new Error('Viewer construction failed')

    await expect(withBpmnJsdomViewer(
      () => {
        throw creationError
      },
      async () => undefined,
    )).rejects.toBe(creationError)

    expect(Object.getOwnPropertyDescriptor(globalThis, 'SVGMatrix'))
      .toEqual(svgMatrixDescriptor)
    expect(document.body.childElementCount).toBe(bodyChildCount)
  })

  it('restores globals and removes the container when viewer destruction throws', async () => {
    const svgMatrixDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'SVGMatrix')
    const bodyChildCount = document.body.childElementCount
    const destructionError = new Error('Viewer destruction failed')

    await expect(withBpmnJsdomViewer(
      () => ({
        destroy() {
          throw destructionError
        },
      }),
      async (_viewer, container) => {
        expect(container.isConnected).toBe(true)
        expect(Object.getOwnPropertyDescriptor(globalThis, 'SVGMatrix'))
          .not.toEqual(svgMatrixDescriptor)
      },
    )).rejects.toBe(destructionError)

    expect(Object.getOwnPropertyDescriptor(globalThis, 'SVGMatrix'))
      .toEqual(svgMatrixDescriptor)
    expect(document.body.childElementCount).toBe(bodyChildCount)
  })

  it('marks removed, changed, and visible layout-only changes on the left', async () => {
    const { canvas, handle } = createHarness(changes.map((item) => item.id))
    await handle.importXml('<xml/>')

    handle.applyChanges(changes, 'left', true)

    expect(canvas.addMarker.mock.calls).toEqual([
      ['Removed_1', 'bpmn-diff-removed'],
      ['Changed_1', 'bpmn-diff-changed'],
      ['Layout_1', 'bpmn-diff-layout']
    ])
  })

  it('removes existing markers by id before applying replacements', async () => {
    const { canvas, handle } = createHarness(['Added_1', 'Changed_1'])
    await handle.importXml('<xml/>')

    handle.applyChanges([change('Added_1', 'added')], 'right', false)
    handle.applyChanges([change('Changed_1', 'changed')], 'right', false)

    expect(canvas.removeMarker).toHaveBeenCalledWith('Added_1', 'bpmn-diff-added')
    expect(canvas.addMarker).toHaveBeenNthCalledWith(2, 'Changed_1', 'bpmn-diff-changed')
    expect(canvas.removeMarker.mock.invocationCallOrder[0]).toBeLessThan(
      canvas.addMarker.mock.invocationCallOrder[1]
    )
  })

  it('skips missing registry elements for markers and focus', async () => {
    const { canvas, handle, registry } = createHarness(['Present_1'])
    await handle.importXml('<xml/>')

    handle.applyChanges([change('Missing_1', 'changed')], 'right', false)
    handle.focus('Missing_1')

    expect(registry.get).toHaveBeenCalledWith('Missing_1')
    expect(canvas.addMarker).not.toHaveBeenCalled()
    expect(canvas.scrollToElement).not.toHaveBeenCalled()
  })

  it('resizes before fitting and focuses an existing element by id', async () => {
    const { canvas, handle } = createHarness(['Present_1'])
    await handle.importXml('<xml/>')

    handle.fit()
    handle.focus('Present_1')

    expect(canvas.resized).toHaveBeenCalledOnce()
    expect(canvas.zoom).toHaveBeenCalledWith('fit-viewport')
    expect(canvas.resized.mock.invocationCallOrder[0]).toBeLessThan(
      canvas.zoom.mock.invocationCallOrder[0]
    )
    expect(canvas.scrollToElement).toHaveBeenCalledWith('Present_1', 120)
  })

  it('clears active markers before destroying the viewer', async () => {
    const { canvas, handle, viewer } = createHarness(['Changed_1'])
    await handle.importXml('<xml/>')
    handle.applyChanges([change('Changed_1', 'changed')], 'right', false)

    handle.destroy()

    expect(canvas.removeMarker).toHaveBeenCalledWith('Changed_1', 'bpmn-diff-changed')
    expect(viewer.destroy).toHaveBeenCalledOnce()
    expect(canvas.removeMarker.mock.invocationCallOrder[0]).toBeLessThan(
      viewer.destroy.mock.invocationCallOrder[0]
    )
  })

  it('clears stale markers before a re-import replaces registry ids', async () => {
    const harness = createHarness(['Old_1'])
    harness.canvas.removeMarker.mockImplementation((elementId: string) => {
      if (!harness.registry.get(elementId)) {
        throw new Error(`Missing registry element: ${elementId}`)
      }
    })

    await harness.handle.importXml('<old/>')
    harness.handle.applyChanges([change('Old_1', 'changed')], 'right', false)
    harness.viewer.importXML.mockImplementationOnce(async () => {
      harness.replaceElements(['New_1'])
      return { warnings: [] }
    })

    await harness.handle.importXml('<new/>')
    harness.handle.applyChanges([change('New_1', 'changed')], 'right', false)

    expect(harness.canvas.removeMarker).toHaveBeenNthCalledWith(1, 'Old_1', 'bpmn-diff-changed')
    expect(harness.canvas.removeMarker.mock.invocationCallOrder[0]).toBeLessThan(
      harness.viewer.importXML.mock.invocationCallOrder[1]
    )
    expect(() => harness.handle.destroy()).not.toThrow()
    expect(harness.canvas.removeMarker).toHaveBeenNthCalledWith(2, 'New_1', 'bpmn-diff-changed')
  })

  it('leaves no active markers or imported state after a failed re-import', async () => {
    const harness = createHarness(['Old_1'])
    harness.canvas.removeMarker.mockImplementation((elementId: string) => {
      if (!harness.registry.get(elementId)) {
        throw new Error(`Missing registry element: ${elementId}`)
      }
    })

    await harness.handle.importXml('<old/>')
    harness.handle.applyChanges([change('Old_1', 'changed')], 'right', false)
    harness.viewer.importXML.mockImplementationOnce(async () => {
      harness.replaceElements([])
      throw new Error('Import failed')
    })

    await expect(harness.handle.importXml('<broken/>')).rejects.toThrow('Import failed')
    expect(() => {
      harness.handle.applyChanges([change('Old_1', 'changed')], 'right', false)
      harness.handle.focus('Old_1')
      harness.handle.destroy()
    }).not.toThrow()
    expect(harness.canvas.removeMarker).toHaveBeenCalledOnce()
    expect(harness.canvas.addMarker).toHaveBeenCalledOnce()
    expect(harness.canvas.scrollToElement).not.toHaveBeenCalled()
  })

  it('does not access viewer services before a successful import', () => {
    const { get, handle } = createHarness(['Present_1'])

    handle.applyChanges([change('Present_1', 'changed')], 'right', false)
    handle.focus('Present_1')
    handle.fit()

    expect(get).not.toHaveBeenCalled()
  })

  it('destroys idempotently and does not access services afterwards', async () => {
    const { get, handle, viewer } = createHarness(['Present_1'])
    await handle.importXml('<xml/>')
    handle.applyChanges([change('Present_1', 'changed')], 'right', false)

    handle.destroy()
    const serviceCallsAtDestroy = get.mock.calls.length
    handle.destroy()
    handle.applyChanges([change('Present_1', 'changed')], 'right', false)
    handle.focus('Present_1')
    handle.fit()

    expect(viewer.destroy).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledTimes(serviceCallsAtDestroy)
  })

  it('destroys without resolving canvas when no markers are active', () => {
    const { get, handle, viewer } = createHarness()

    handle.destroy()

    expect(get).not.toHaveBeenCalled()
    expect(viewer.destroy).toHaveBeenCalledOnce()
  })
})
