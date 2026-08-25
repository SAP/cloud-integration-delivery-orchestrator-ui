export interface FixtureOptions {
  taskName?: string
  taskX?: number
  iflValue?: string
  includeExtraTask?: boolean
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildBpmnFixture({
  taskName = 'Task',
  taskX = 200,
  iflValue = '30',
  includeExtraTask = false,
}: FixtureOptions = {}): string {
  const extraTask = includeExtraTask
    ? `
      <bpmn2:serviceTask id="Task_2" name="Extra Task">
        <bpmn2:extensionElements>
          <ifl:property>
            <key>retry</key>
            <value>3</value>
          </ifl:property>
        </bpmn2:extensionElements>
      </bpmn2:serviceTask>
      <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2" />`
    : ''
  const extraShape = includeExtraTask
    ? `
        <bpmndi:BPMNShape id="Shape_Task_2" bpmnElement="Task_2">
          <dc:Bounds x="360" y="100" width="100" height="80" />
        </bpmndi:BPMNShape>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd"
  id="Definitions_1"
  targetNamespace="http://example.com/bpmn">
  <bpmn2:process id="Process_1">
    <bpmn2:task id="Task_1" name="${escapeXml(taskName)}">
      <bpmn2:extensionElements>
        <ifl:property>
          <key>transactionTimeout</key>
          <value>${escapeXml(iflValue)}</value>
        </ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:task>${extraTask}
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_Task_1" bpmnElement="Task_1">
        <dc:Bounds x="${taskX}" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>${extraShape}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`
}
