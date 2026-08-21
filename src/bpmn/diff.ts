import { BpmnModdle } from 'bpmn-moddle'
import {
  diff,
  type BpmnAttributeChange,
  type BpmnDiffElement,
  type BpmnDiffResult,
} from 'bpmn-js-differ'
import { iflPropertyEntries } from './moddleProperties'

export type BpmnDiffSide = 'left' | 'right'
export type BpmnChangeStatus =
  | 'added'
  | 'removed'
  | 'changed'
  | 'layout-only'
// Tier 2 property-level(ifl:property) diff
export interface BpmnPropertyChange {
  key: string
  oldValue: string | undefined
  newValue: string | undefined
}

export interface BpmnElementChange {
  id: string
  type: string
  name?: string
  status: BpmnChangeStatus
  alsoLayoutChanged: boolean
  /** Property-level detail for 'changed' elements (absent for added/removed/layout-only). */
  attrs?: Record<string, BpmnAttributeChange>
  /** CPI ifl:property key/value diff for 'changed' elements. */
  properties?: BpmnPropertyChange[]
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
  attrs?: Record<string, BpmnAttributeChange>,
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

  if (attrs !== undefined && Object.keys(attrs).length > 0) {
    change.attrs = attrs
  }

  return change
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * bpmn-js-differ@3.2.0 stores `_changed[id].attrs[prop]` with oldValue/newValue
 * INVERTED: its ChangeHandler.changed signature names params (newValue,
 * oldValue) but the walker passes jsondiffpatch's [old, new] order, so the
 * stored `oldValue` field actually holds the new value and vice versa. Swap here
 * so the data layer exposes semantically-correct direction and consumers never
 * need to re-swap.
 *
 * WARNING: this is coupled to the pinned differ version. If bpmn-js-differ is
 * bumped, re-verify the inversion still holds (an upstream fix would turn this
 * swap into a double-inversion).
 */
function correctAttrDirection(
  attrs: Record<string, BpmnAttributeChange>,
): Record<string, BpmnAttributeChange> {
  const corrected: Record<string, BpmnAttributeChange> = {}
  for (const [key, change] of Object.entries(attrs)) {
    corrected[key] = { oldValue: change.newValue, newValue: change.oldValue }
  }
  return corrected
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

  for (const [id, changed] of Object.entries(raw._changed)) {
    if (claimed.has(id)) continue

    claimed.add(id)
    changes.push(
      toChange(id, changed.model, 'changed', layoutIds, correctAttrDirection(changed.attrs)),
    )
  }

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

// --- ifl:property extraction for Tier 2 ---

function diffProperties(leftElement: unknown, rightElement: unknown,): BpmnPropertyChange[] | undefined {
  // Assumes ifl:property keys are unique per element (CPI exports do not repeat
  // them). new Map collapses any duplicate key to its last occurrence, so a
  // duplicate-key change would be missed — accepted given the invariant.
  const leftPairs = new Map(iflPropertyEntries(leftElement))
  const rightPairs = new Map(iflPropertyEntries(rightElement))

  const changes: BpmnPropertyChange[] = []
  const allKeys = new Set([...leftPairs.keys(), ...rightPairs.keys()])

  for (const key of allKeys) {
    const oldVal = leftPairs.get(key)
    const newVal = rightPairs.get(key)
    if (oldVal !== newVal) {
      changes.push({ key, oldValue: oldVal, newValue: newVal })
    }
  }

  return changes.length > 0 ? changes : undefined
}

/**
 * Field-level ifl:property list for a whole-element add/remove: an added element
 * has no "old" side (every property is new → oldValue undefined) and a removed
 * element has no "new" side (newValue undefined). Entries keep list order and
 * any duplicate keys, unlike the Map-collapsed `changed` path.
 */
function sidePropertyList(
  element: unknown,
  status: 'added' | 'removed',
): BpmnPropertyChange[] | undefined {
  const entries = iflPropertyEntries(element)
  if (entries.length === 0) return undefined

  return entries.map(([key, value]) =>
    status === 'added'
      ? { key, oldValue: undefined, newValue: value }
      : { key, oldValue: value, newValue: undefined },
  )
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

  // Enrich entries with ifl:property-level detail (Tier 2).
  // A pure ifl:property change (nested in extensionElements, no top-level attr
  // change) still lands in 'changed': bpmn-js-differ's *detection* walks the
  // whole moddle subtree, but its *recording* into `attrs` only covers top-level
  // tracked scalars — so such elements are 'changed' with empty `attrs`. This
  // gate therefore correctly admits them; diffProperties supplies the detail.
  // added/removed carry no per-property diff from the differ, so we list the
  // present side's ifl:property directly (single-sided detail).
  for (const change of classified.changes) {
    if (change.status === 'changed') {
      const leftEl = left.elementsById[change.id]
      const rightEl = right.elementsById[change.id]
      if (leftEl === undefined || rightEl === undefined) continue

      const properties = diffProperties(leftEl, rightEl)
      if (properties !== undefined) change.properties = properties
    } else if (change.status === 'added') {
      const properties = sidePropertyList(right.elementsById[change.id], 'added')
      if (properties !== undefined) change.properties = properties
    } else if (change.status === 'removed') {
      const properties = sidePropertyList(left.elementsById[change.id], 'removed')
      if (properties !== undefined) change.properties = properties
    }
  }

  return {
    ...classified,
    warnings: {
      left: left.warnings.map(toWarningMessage),
      right: right.warnings.map(toWarningMessage),
    },
  }
}
