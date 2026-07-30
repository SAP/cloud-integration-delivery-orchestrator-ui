import { BpmnModdle } from 'bpmn-moddle'
import {
  diff,
  type BpmnDiffElement,
  type BpmnDiffResult,
} from 'bpmn-js-differ'

export type BpmnDiffSide = 'left' | 'right'
export type BpmnChangeStatus =
  | 'added'
  | 'removed'
  | 'changed'
  | 'layout-only'

export interface BpmnElementChange {
  id: string
  type: string
  name?: string
  status: BpmnChangeStatus
  alsoLayoutChanged: boolean
}

export interface BpmnDiffViewModel {
  changes: BpmnElementChange[]
  warnings: {
    left: string[]
    right: string[]
  }
}

export class BpmnParseError extends Error {
  constructor(
    public readonly side: BpmnDiffSide,
    public readonly originalError: unknown,
  ) {
    super(`Failed to parse ${side} BPMN XML`)
    this.name = 'BpmnParseError'
  }
}

const statusOrder: Record<BpmnChangeStatus, number> = {
  added: 0,
  removed: 1,
  changed: 2,
  'layout-only': 3,
}

function toChange(
  id: string,
  model: BpmnDiffElement,
  status: BpmnChangeStatus,
  layoutIds: ReadonlySet<string>,
): BpmnElementChange {
  const change: BpmnElementChange = {
    id,
    type: model.$type,
    status,
    alsoLayoutChanged: layoutIds.has(id),
  }

  if (model.name !== undefined) {
    change.name = model.name
  }

  return change
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function classifyBpmnDiff(
  raw: BpmnDiffResult,
): Pick<BpmnDiffViewModel, 'changes'> {
  const layoutIds = new Set(Object.keys(raw._layoutChanged))
  const claimed = new Set<string>()
  const changes: BpmnElementChange[] = []

  const append = (
    entries: Iterable<readonly [string, BpmnDiffElement]>,
    status: BpmnChangeStatus,
  ) => {
    for (const [id, model] of entries) {
      if (claimed.has(id)) continue

      claimed.add(id)
      changes.push(toChange(id, model, status, layoutIds))
    }
  }

  append(Object.entries(raw._added), 'added')
  append(Object.entries(raw._removed), 'removed')
  append(
    Object.entries(raw._changed).map(([id, change]) => [
      id,
      change.model,
    ] as const),
    'changed',
  )
  append(Object.entries(raw._layoutChanged), 'layout-only')

  changes.sort((left, right) => {
    const statusComparison = statusOrder[left.status] - statusOrder[right.status]
    if (statusComparison !== 0) return statusComparison

    const nameComparison = compareText(
      left.name ?? left.id,
      right.name ?? right.id,
    )
    if (nameComparison !== 0) return nameComparison

    return compareText(left.id, right.id)
  })

  return { changes }
}

function toWarningMessage(warning: unknown): string {
  if (typeof warning === 'string') return warning
  if (
    warning !== null
    && typeof warning === 'object'
    && 'message' in warning
  ) {
    return String(warning.message)
  }

  return String(warning)
}

async function parse(xml: string, side: BpmnDiffSide) {
  try {
    const moddle = new BpmnModdle()
    return await moddle.fromXML(xml)
  } catch (error) {
    throw new BpmnParseError(side, error)
  }
}

export async function computeBpmnDiff(
  leftXml: string,
  rightXml: string,
): Promise<BpmnDiffViewModel> {
  const [left, right] = await Promise.all([
    parse(leftXml, 'left'),
    parse(rightXml, 'right'),
  ])
  const classified = classifyBpmnDiff(
    diff(left.rootElement, right.rootElement),
  )

  return {
    ...classified,
    warnings: {
      left: left.warnings.map(toWarningMessage),
      right: right.warnings.map(toWarningMessage),
    },
  }
}
