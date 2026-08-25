import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetProbeCache, prepareIflowXmlForRendering } from './iflowRenderXml'

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC'
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI'
const PARSER_ERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

const subprocessFixture = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:bpmn2="${BPMN_NS}"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:di="${DI_NS}">
  <bpmn2:process id="Process_1">
    <bpmn2:subProcess id="Sub_Visible">
      <bpmn2:startEvent id="Start_Visible" />
      <bpmn2:task id="Task_Visible" />
      <bpmn2:sequenceFlow id="Flow_Visible" sourceRef="Start_Visible" targetRef="Task_Visible" />
    </bpmn2:subProcess>
    <bpmn2:subProcess id="Sub_Hidden">
      <bpmn2:task id="Task_Hidden" />
    </bpmn2:subProcess>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_Sub_Visible" bpmnElement="Sub_Visible">
        <dc:Bounds x="80" y="60" width="360" height="220" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Start_Visible" bpmnElement="Start_Visible">
        <dc:Bounds x="120" y="140" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_Visible" bpmnElement="Task_Visible">
        <dc:Bounds x="240" y="118" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow_Visible" bpmnElement="Flow_Visible">
        <di:waypoint x="156" y="158" />
        <di:waypoint x="240" y="158" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="Shape_Sub_Hidden" bpmnElement="Sub_Hidden">
        <dc:Bounds x="500" y="60" width="240" height="160" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`

function parse(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function shapeFor(xml: string, bpmnElement: string): Element | undefined {
  return Array.from(parse(xml).getElementsByTagNameNS(BPMNDI_NS, 'BPMNShape'))
    .find(shape => shape.getAttribute('bpmnElement') === bpmnElement)
}

function shapeById(xml: string, id: string): Element | undefined {
  return Array.from(parse(xml).getElementsByTagNameNS(BPMNDI_NS, 'BPMNShape'))
    .find(shape => shape.getAttribute('id') === id)
}

function geometry(xml: string): string[] {
  const document = parse(xml)
  return [
    ...Array.from(document.getElementsByTagNameNS(DC_NS, 'Bounds')),
    ...Array.from(document.getElementsByTagNameNS(DI_NS, 'waypoint')),
  ].map(element => ['x', 'y', 'width', 'height']
    .filter(name => element.hasAttribute(name))
    .map(name => `${name}=${element.getAttribute(name)}`)
    .join(','))
}

describe('prepareIflowXmlForRendering', () => {
  beforeEach(() => {
    _resetProbeCache()
  })

  it('expands only subprocesses whose semantic descendants have diagram references', () => {
    const result = prepareIflowXmlForRendering(subprocessFixture)

    expect(result).not.toBe(subprocessFixture)
    expect(shapeFor(result, 'Sub_Visible')?.getAttribute('isExpanded')).toBe('true')
    expect(shapeFor(result, 'Sub_Hidden')?.hasAttribute('isExpanded')).toBe(false)
  })

  it('preserves all existing bounds and waypoints', () => {
    const result = prepareIflowXmlForRendering(subprocessFixture)

    expect(geometry(result)).toEqual(geometry(subprocessFixture))
  })

  it('produces deterministic, idempotent output', () => {
    const first = prepareIflowXmlForRendering(subprocessFixture)
    const second = prepareIflowXmlForRendering(subprocessFixture)

    expect(second).toBe(first)
    expect(prepareIflowXmlForRendering(first)).toBe(first)
  })

  it('returns ordinary process XML byte-for-byte unchanged', () => {
    const source = `<definitions xmlns="${BPMN_NS}" xmlns:layout="${BPMNDI_NS}">
  <process id="Process_1"><task id="Task_1" /></process>
  <layout:BPMNDiagram id="Diagram_1" />
</definitions>`

    expect(prepareIflowXmlForRendering(source)).toBe(source)
  })

  it('does not expand a subprocess whose children have no diagram references', () => {
    const source = `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:di="${BPMNDI_NS}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1"><bpmn:task id="Task_1" /></bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram><di:BPMNPlane bpmnElement="Process_1">
    <di:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" />
  </di:BPMNPlane></di:BPMNDiagram>
</bpmn:definitions>`

    expect(prepareIflowXmlForRendering(source)).toBe(source)
  })

  it('leaves already-expanded subprocess XML byte-for-byte unchanged', () => {
    const source = `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:di="${BPMNDI_NS}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1"><bpmn:task id="Task_1" /></bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram><di:BPMNPlane bpmnElement="Process_1">
    <di:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" isExpanded="true" />
    <di:BPMNShape id="Shape_Task_1" bpmnElement="Task_1" />
  </di:BPMNPlane></di:BPMNDiagram>
</bpmn:definitions>`

    expect(prepareIflowXmlForRendering(source)).toBe(source)
  })

  it('returns malformed XML byte-for-byte unchanged', () => {
    const malformed = '<bpmn:definitions><bpmn:process id="Process_1"></bpmn:definitions>'

    expect(prepareIflowXmlForRendering(malformed)).toBe(malformed)
  })

  it.each([
    { label: 'Mozilla', namespace: PARSER_ERROR_NS },
    { label: 'Blink/WebKit XHTML', namespace: XHTML_NS },
  ])('detects a nested $label parsererror using the runtime probe namespace', ({ namespace }) => {
    const probeError = parse(`<parsererror xmlns="${namespace}">probe error</parsererror>`)
    const parsedWithNestedError = parse(`<bpmn:definitions
  xmlns:bpmn="${BPMN_NS}"
  xmlns:di="${BPMNDI_NS}"
  xmlns:failure="${namespace}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1"><bpmn:task id="Task_1" /></bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram><di:BPMNPlane bpmnElement="Process_1">
    <di:BPMNShape bpmnElement="Sub_1" />
    <di:BPMNShape bpmnElement="Task_1" />
  </di:BPMNPlane></di:BPMNDiagram>
  <failure:parsererror>invalid XML</failure:parsererror>
</bpmn:definitions>`)
    const parseSpy = vi.spyOn(DOMParser.prototype, 'parseFromString')
      .mockReturnValueOnce(probeError)
      .mockReturnValueOnce(parsedWithNestedError)
    const source = '<original malformed input>'

    try {
      expect(prepareIflowXmlForRendering(source)).toBe(source)
      expect(parseSpy).toHaveBeenNthCalledWith(1, '<invalid', 'application/xml')
      expect(parseSpy).toHaveBeenNthCalledWith(2, source, 'application/xml')
    } finally {
      parseSpy.mockRestore()
    }
  })

  it('does not treat a vendor parsererror extension as malformed XML', () => {
    const source = `<bpmn:definitions
  xmlns:bpmn="${BPMN_NS}"
  xmlns:di="${BPMNDI_NS}"
  xmlns:vendor="urn:vendor-extension">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1">
      <bpmn:task id="Task_1" />
      <bpmn:extensionElements><vendor:parsererror>domain data</vendor:parsererror></bpmn:extensionElements>
    </bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram><di:BPMNPlane bpmnElement="Process_1">
    <di:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" />
    <di:BPMNShape id="Shape_Task_1" bpmnElement="Task_1" />
  </di:BPMNPlane></di:BPMNDiagram>
</bpmn:definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeById(result, 'Shape_Sub_1')?.getAttribute('isExpanded')).toBe('true')
  })

  it('matches BPMN elements by namespace and local name rather than prefix', () => {
    const source = `<definitions xmlns="${BPMN_NS}" xmlns:visual="${BPMNDI_NS}" xmlns:path="${DI_NS}">
  <process id="Process_1">
    <subProcess id="Sub_1">
      <task id="Task_1" />
      <sequenceFlow id="Flow_1" sourceRef="Task_1" targetRef="Task_1" />
    </subProcess>
  </process>
  <visual:BPMNDiagram><visual:BPMNPlane bpmnElement="Process_1">
    <visual:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" />
    <visual:BPMNEdge id="Edge_Flow_1" bpmnElement="Flow_1">
      <path:waypoint x="10" y="20" />
    </visual:BPMNEdge>
  </visual:BPMNPlane></visual:BPMNDiagram>
</definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeFor(result, 'Sub_1')?.getAttribute('isExpanded')).toBe('true')
  })

  it('normalizes QName bpmnElement references before matching semantic ids', () => {
    const source = `<model:definitions xmlns:model="${BPMN_NS}" xmlns:visual="${BPMNDI_NS}">
  <model:process id="Process_1">
    <model:subProcess id="Sub_1"><model:task id="Task_1" /></model:subProcess>
  </model:process>
  <visual:BPMNDiagram><visual:BPMNPlane bpmnElement="model:Process_1">
    <visual:BPMNShape id="Shape_Sub_1" bpmnElement="model:Sub_1" />
    <visual:BPMNShape id="Shape_Task_1" bpmnElement="model:Task_1" />
  </visual:BPMNPlane></visual:BPMNDiagram>
</model:definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeById(result, 'Shape_Sub_1')?.getAttribute('isExpanded')).toBe('true')
  })

  it('correlates only QName references resolved to the BPMN model namespace', () => {
    const source = `<model:definitions
  xmlns:model="${BPMN_NS}"
  xmlns:visual="${BPMNDI_NS}"
  xmlns:foreign="urn:foreign-model">
  <model:process id="Process_1">
    <model:subProcess id="Model_Sub"><model:task id="Model_Task" /></model:subProcess>
    <model:subProcess id="Foreign_Sub"><model:task id="Foreign_Task" /></model:subProcess>
  </model:process>
  <visual:BPMNDiagram><visual:BPMNPlane bpmnElement="model:Process_1">
    <visual:BPMNShape id="Model_Sub_Shape" bpmnElement="model:Model_Sub" />
    <visual:BPMNShape id="Model_Task_Shape" bpmnElement="model:Model_Task" />
    <visual:BPMNShape id="Foreign_Sub_Shape" bpmnElement="model:Foreign_Sub" />
    <visual:BPMNShape id="Foreign_Task_Shape" bpmnElement="foreign:Foreign_Task" />
  </visual:BPMNPlane></visual:BPMNDiagram>
</model:definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeById(result, 'Model_Sub_Shape')?.getAttribute('isExpanded')).toBe('true')
    expect(shapeById(result, 'Foreign_Sub_Shape')?.hasAttribute('isExpanded')).toBe(false)
  })

  it('rejects unprefixed QName references under a foreign default namespace', () => {
    const source = `<model:definitions xmlns:model="${BPMN_NS}" xmlns:visual="${BPMNDI_NS}">
  <model:process id="Process_1">
    <model:subProcess id="Sub_1"><model:task id="Task_1" /></model:subProcess>
  </model:process>
  <visual:BPMNDiagram><visual:BPMNPlane xmlns="urn:foreign-model" bpmnElement="Process_1">
    <visual:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" />
    <visual:BPMNShape id="Shape_Task_1" bpmnElement="Task_1" />
  </visual:BPMNPlane></visual:BPMNDiagram>
</model:definitions>`

    expect(prepareIflowXmlForRendering(source)).toBe(source)
  })

  it('expands only the repeated subprocess shape sharing a plane with child DI', () => {
    const source = `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:di="${BPMNDI_NS}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Sub_1"><bpmn:task id="Task_1" /></bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram id="Main_Diagram"><di:BPMNPlane id="Main_Plane" bpmnElement="Process_1">
    <di:BPMNShape id="Main_Sub_Shape" bpmnElement="Sub_1" />
  </di:BPMNPlane></di:BPMNDiagram>
  <di:BPMNDiagram id="Detail_Diagram"><di:BPMNPlane id="Detail_Plane" bpmnElement="Sub_1">
    <di:BPMNShape id="Detail_Sub_Shape" bpmnElement="Sub_1" />
    <di:BPMNShape id="Detail_Task_Shape" bpmnElement="Task_1" />
  </di:BPMNPlane></di:BPMNDiagram>
</bpmn:definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeById(result, 'Main_Sub_Shape')?.hasAttribute('isExpanded')).toBe(false)
    expect(shapeById(result, 'Detail_Sub_Shape')?.getAttribute('isExpanded')).toBe('true')
  })

  it('expands nested subprocesses locally without changing their shapes on other planes', () => {
    const source = `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:di="${BPMNDI_NS}">
  <bpmn:process id="Process_1">
    <bpmn:subProcess id="Outer_Sub">
      <bpmn:subProcess id="Inner_Sub"><bpmn:task id="Nested_Task" /></bpmn:subProcess>
    </bpmn:subProcess>
  </bpmn:process>
  <di:BPMNDiagram id="Nested_Diagram"><di:BPMNPlane id="Nested_Plane" bpmnElement="Process_1">
    <di:BPMNShape id="Nested_Outer_Shape" bpmnElement="Outer_Sub" />
    <di:BPMNShape id="Nested_Inner_Shape" bpmnElement="Inner_Sub" />
    <di:BPMNShape id="Nested_Task_Shape" bpmnElement="Nested_Task" />
  </di:BPMNPlane></di:BPMNDiagram>
  <di:BPMNDiagram id="Summary_Diagram"><di:BPMNPlane id="Summary_Plane" bpmnElement="Process_1">
    <di:BPMNShape id="Summary_Outer_Shape" bpmnElement="Outer_Sub" />
  </di:BPMNPlane></di:BPMNDiagram>
</bpmn:definitions>`

    const result = prepareIflowXmlForRendering(source)

    expect(shapeById(result, 'Nested_Outer_Shape')?.getAttribute('isExpanded')).toBe('true')
    expect(shapeById(result, 'Nested_Inner_Shape')?.getAttribute('isExpanded')).toBe('true')
    expect(shapeById(result, 'Summary_Outer_Shape')?.hasAttribute('isExpanded')).toBe(false)
  })

  it('indexes semantic ownership once across many planes', () => {
    const depth = 8
    const planeCount = 20
    const nestedSubprocesses = Array.from(
      { length: depth },
      (_, index) => `<bpmn:subProcess id="Sub_${index}">`,
    ).join('')
    const diagrams = Array.from(
      { length: planeCount },
      (_, index) => `<di:BPMNDiagram id="Diagram_${index}">
    <di:BPMNPlane id="Plane_${index}" bpmnElement="Process_1">
      <di:BPMNShape id="Shape_Sub_0_${index}" bpmnElement="Sub_0" />
      <di:BPMNShape id="Shape_Deep_Task_${index}" bpmnElement="Deep_Task" />
    </di:BPMNPlane>
  </di:BPMNDiagram>`,
    ).join('')
    const source = `<bpmn:definitions xmlns:bpmn="${BPMN_NS}" xmlns:di="${BPMNDI_NS}">
  <bpmn:process id="Process_1">
    ${nestedSubprocesses}<bpmn:task id="Deep_Task" />${'</bpmn:subProcess>'.repeat(depth)}
  </bpmn:process>
  ${diagrams}
</bpmn:definitions>`
    const probeError = parse(`<parsererror xmlns="${PARSER_ERROR_NS}">probe</parsererror>`)
    const parsedSource = parse(source)
    const semanticElements = Array.from(
      parsedSource.getElementsByTagNameNS(BPMN_NS, '*'),
    )
    let semanticChildReads = 0
    semanticElements.forEach((element) => {
      const children = element.children
      Object.defineProperty(element, 'children', {
        configurable: true,
        get() {
          semanticChildReads += 1
          return children
        },
      })
    })
    const parseSpy = vi.spyOn(DOMParser.prototype, 'parseFromString')
      .mockReturnValueOnce(probeError)
      .mockReturnValueOnce(parsedSource)
    let result: string

    try {
      result = prepareIflowXmlForRendering(source)
    } finally {
      parseSpy.mockRestore()
    }

    expect(shapeById(result, 'Shape_Sub_0_0')?.getAttribute('isExpanded')).toBe('true')
    expect(shapeById(result, `Shape_Sub_0_${planeCount - 1}`)?.getAttribute('isExpanded'))
      .toBe('true')
    expect(semanticChildReads).toBeLessThanOrEqual(semanticElements.length * 3)
  })
})
