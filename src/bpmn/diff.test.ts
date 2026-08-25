// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { BpmnDiffElement, BpmnDiffResult } from 'bpmn-js-differ'
import { buildBpmnFixture } from '@/test/bpmnDiffFixtures'
import {
  BpmnParseError,
  classifyBpmnDiff,
  computeBpmnDiff,
} from './diff'

function element(
  id: string,
  name?: string,
  type = 'bpmn:Task',
): BpmnDiffElement {
  return {
    $type: type,
    id,
    ...(name === undefined ? {} : { name }),
  }
}

function emptyRawDiff(): BpmnDiffResult {
  return {
    _added: {},
    _removed: {},
    _changed: {},
    _layoutChanged: {},
  }
}

describe('computeBpmnDiff', () => {
  it('classifies a task name change as semantic changed', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ taskName: 'Before' }),
      buildBpmnFixture({ taskName: 'After' }),
    )

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'Task_1',
        status: 'changed',
        alsoLayoutChanged: false,
      }),
    ]))
    expect(result.warnings).toEqual({ left: [], right: [] })
  })

  it('classifies a Bounds x-only change as layout-only', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ taskX: 200 }),
      buildBpmnFixture({ taskX: 260 }),
    )

    expect(result.changes).toEqual([
      {
        id: 'Task_1',
        type: 'bpmn:Task',
        name: 'Task',
        status: 'layout-only',
        alsoLayoutChanged: true,
      },
    ])
    expect(result.changes.some(change => change.status === 'changed')).toBe(false)
  })

  it('classifies an ifl property value-only change as semantic', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ iflValue: '30' }),
      buildBpmnFixture({ iflValue: '31' }),
    )

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'changed',
        alsoLayoutChanged: false,
      }),
    ]))
  })

  it('surfaces ifl:property key/value detail for changed elements', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ iflValue: '30' }),
      buildBpmnFixture({ iflValue: '31' }),
    )

    const changed = result.changes.find(c => c.id === 'Task_1' && c.status === 'changed')
    expect(changed).toBeDefined()
    expect(changed!.properties).toEqual([
      { key: 'transactionTimeout', oldValue: '30', newValue: '31' },
    ])
  })

  it('surfaces top-level attrs for name changes with corrected old→new direction', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ taskName: 'Before' }),
      buildBpmnFixture({ taskName: 'After' }),
    )

    const changed = result.changes.find(c => c.id === 'Task_1' && c.status === 'changed')
    expect(changed).toBeDefined()
    expect(changed!.attrs).toBeDefined()
    // Data layer corrects bpmn-js-differ's inverted oldValue/newValue: left is
    // old, right is new.
    expect(changed!.attrs!.name).toEqual({ oldValue: 'Before', newValue: 'After' })
  })

  it('lists the added element ifl:property with the new side only', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture(),
      buildBpmnFixture({ includeExtraTask: true }),
    )

    const added = result.changes.find(c => c.id === 'Task_2' && c.status === 'added')
    expect(added).toBeDefined()
    expect(added!.properties).toEqual([
      { key: 'retry', oldValue: undefined, newValue: '3' },
    ])
  })

  it('lists the removed element ifl:property with the old side only', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ includeExtraTask: true }),
      buildBpmnFixture(),
    )

    const removed = result.changes.find(c => c.id === 'Task_2' && c.status === 'removed')
    expect(removed).toBeDefined()
    expect(removed!.properties).toEqual([
      { key: 'retry', oldValue: '3', newValue: undefined },
    ])
  })

  it('does not add properties when ifl:property pairs are unchanged', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ taskName: 'Before', iflValue: '30' }),
      buildBpmnFixture({ taskName: 'After', iflValue: '30' }),
    )

    const changed = result.changes.find(c => c.id === 'Task_1' && c.status === 'changed')
    expect(changed).toBeDefined()
    expect(changed!.properties).toBeUndefined()
  })

  it('attaches full-config drill-down detail from the new side for changed elements', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ taskName: 'Before', iflValue: '30' }),
      buildBpmnFixture({ taskName: 'After', iflValue: '31' }),
    )

    const changed = result.changes.find(c => c.id === 'Task_1' && c.status === 'changed')
    expect(changed).toBeDefined()
    expect(changed!.detail).toBeDefined()
    // Full config lists every top-level scalar + every ifl:property (incl.
    // unchanged), taken from the new (right) side.
    expect(changed!.detail!.attributes).toEqual(expect.arrayContaining([
      { key: 'id', value: 'Task_1' },
      { key: 'name', value: 'After' },
    ]))
    expect(changed!.detail!.properties).toEqual([
      { key: 'transactionTimeout', value: '31' },
    ])
  })

  it('attaches full-config detail for added elements from the new side', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture(),
      buildBpmnFixture({ includeExtraTask: true }),
    )

    const added = result.changes.find(c => c.id === 'Task_2' && c.status === 'added')
    expect(added).toBeDefined()
    expect(added!.detail!.attributes).toEqual(expect.arrayContaining([
      { key: 'id', value: 'Task_2' },
      { key: 'name', value: 'Extra Task' },
    ]))
    expect(added!.detail!.properties).toEqual([{ key: 'retry', value: '3' }])
  })

  it('classifies Task_2 as added when the extra task appears', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture(),
      buildBpmnFixture({ includeExtraTask: true }),
    )

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'Task_2',
        status: 'added',
      }),
    ]))
  })

  it('classifies Task_2 as removed when the extra task disappears', async () => {
    const result = await computeBpmnDiff(
      buildBpmnFixture({ includeExtraTask: true }),
      buildBpmnFixture(),
    )

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'Task_2',
        status: 'removed',
      }),
    ]))
  })

  it('wraps malformed left XML with its side', async () => {
    const error = await computeBpmnDiff(
      '<broken>',
      buildBpmnFixture(),
    ).catch(cause => cause)

    expect(error).toBeInstanceOf(BpmnParseError)
    expect(error).toMatchObject({
      name: 'BpmnParseError',
      side: 'left',
    })
  })

  it('wraps malformed right XML with its side', async () => {
    const error = await computeBpmnDiff(
      buildBpmnFixture(),
      '<broken>',
    ).catch(cause => cause)

    expect(error).toBeInstanceOf(BpmnParseError)
    expect(error).toMatchObject({
      name: 'BpmnParseError',
      side: 'right',
    })
  })
})

describe('classifyBpmnDiff', () => {
  it('uses the differ map key as marker id and keeps semantic priority over layout', () => {
    const raw = emptyRawDiff()
    raw._changed.Marker_Task_1 = {
      model: element('Model_Task_1', 'Changed task'),
      attrs: {},
    }
    raw._layoutChanged.Marker_Task_1 = element(
      'Different_Layout_Model_Id',
      'Changed task',
    )

    expect(classifyBpmnDiff(raw)).toEqual({
      changes: [
        {
          id: 'Marker_Task_1',
          type: 'bpmn:Task',
          name: 'Changed task',
          status: 'changed',
          alsoLayoutChanged: true,
        },
      ],
    })
  })

  it('claims duplicate ids by added, removed, changed, then layout-only priority', () => {
    const raw = emptyRawDiff()
    raw._added.Shared = element('Added_Model', 'Shared')
    raw._removed.Shared = element('Removed_Model', 'Shared')
    raw._changed.Shared = {
      model: element('Changed_Model', 'Shared'),
      attrs: {},
    }
    raw._layoutChanged.Shared = element('Layout_Model', 'Shared')

    expect(classifyBpmnDiff(raw).changes).toEqual([
      {
        id: 'Shared',
        type: 'bpmn:Task',
        name: 'Shared',
        status: 'added',
        alsoLayoutChanged: true,
      },
    ])
  })

  it('returns stable plain changes sorted by status, then name and id', () => {
    const raw = emptyRawDiff()
    const addedB = element('Model_B', 'Same')
    addedB.internalState = { mustNotLeak: true }
    raw._added.Added_B = addedB
    raw._added.Added_A = element('Model_A', 'Same')
    raw._removed.Removed_Z = element('Model_Removed', 'Removed')
    raw._changed.Changed_Z = {
      model: element('Model_Changed', 'Changed'),
      attrs: {},
    }
    raw._layoutChanged.Layout_Z = element('Model_Layout', undefined, 'bpmn:Event')

    const result = classifyBpmnDiff(raw)

    expect(result).toEqual({
      changes: [
        {
          id: 'Added_A',
          type: 'bpmn:Task',
          name: 'Same',
          status: 'added',
          alsoLayoutChanged: false,
        },
        {
          id: 'Added_B',
          type: 'bpmn:Task',
          name: 'Same',
          status: 'added',
          alsoLayoutChanged: false,
        },
        {
          id: 'Removed_Z',
          type: 'bpmn:Task',
          name: 'Removed',
          status: 'removed',
          alsoLayoutChanged: false,
        },
        {
          id: 'Changed_Z',
          type: 'bpmn:Task',
          name: 'Changed',
          status: 'changed',
          alsoLayoutChanged: false,
        },
        {
          id: 'Layout_Z',
          type: 'bpmn:Event',
          status: 'layout-only',
          alsoLayoutChanged: true,
        },
      ],
    })
    for (const change of result.changes) {
      expect(Object.getPrototypeOf(change)).toBe(Object.prototype)
      expect(change).not.toHaveProperty('model')
      expect(change).not.toHaveProperty('internalState')
    }
  })
})
