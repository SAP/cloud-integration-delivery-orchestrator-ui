import { describe, expect, it, vi } from 'vitest'
import type { BpmnChangeStatus, BpmnElementChange } from './diff'
import { createBpmnViewer, type ViewerLike } from './viewer'

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
  const factory = vi.fn(() => viewer as unknown as ViewerLike)
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
      container: harness.container
    })
    expect(harness.viewer.importXML).toHaveBeenCalledWith('<xml/>')
    expect(result).toEqual({ warnings: ['Import warning'] })
    expect(harness.canvas.addMarker.mock.calls).toEqual([
      ['Added_1', 'bpmn-diff-added'],
      ['Changed_1', 'bpmn-diff-changed']
    ])
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
