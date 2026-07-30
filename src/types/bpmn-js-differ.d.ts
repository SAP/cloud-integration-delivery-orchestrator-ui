declare module 'bpmn-js-differ' {
  export interface BpmnDiffElement {
    id?: string
    name?: string
    $type: string
    [property: string]: unknown
  }

  export interface BpmnAttributeChange {
    oldValue: unknown
    newValue: unknown
  }

  export interface BpmnChangedElement {
    model: BpmnDiffElement
    attrs: Record<string, BpmnAttributeChange>
  }

  export interface BpmnDiffResult {
    _added: Record<string, BpmnDiffElement>
    _removed: Record<string, BpmnDiffElement>
    _changed: Record<string, BpmnChangedElement>
    _layoutChanged: Record<string, BpmnDiffElement>
  }

  export function diff(oldDefinitions: object, newDefinitions: object): BpmnDiffResult
}
