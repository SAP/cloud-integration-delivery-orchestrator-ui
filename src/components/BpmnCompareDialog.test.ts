import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompareFileItem } from '@/service/codeCompareFiles'
import BpmnCompareDialog from './BpmnCompareDialog.vue'
import componentSource from './BpmnCompareDialog.vue?raw'

const runtime = vi.hoisted(() => {
  type Side = 'left' | 'right'
  type ImportResult = { warnings: string[] }
  type DiffResult = {
    changes: Array<{
      id: string
      type: string
      name?: string
      status: 'added' | 'removed' | 'changed' | 'layout-only'
      alsoLayoutChanged: boolean
    }>
    warnings: { left: string[]; right: string[] }
  }

  class MockBpmnParseError extends Error {
    readonly side: Side
    readonly originalError: unknown

    constructor(side: Side, originalError: unknown) {
      super(`Failed to parse ${side} BPMN XML`)
      this.name = 'BpmnParseError'
      this.side = side
      this.originalError = originalError
    }
  }

  const importers: Record<
    Side,
    (xml: string) => Promise<ImportResult>
  > = {
    left: async () => ({ warnings: [] }),
    right: async () => ({ warnings: [] }),
  }
  const handles: Array<{
    side: Side
    importXml: ReturnType<typeof vi.fn<(xml: string) => Promise<ImportResult>>>
    applyChanges: ReturnType<typeof vi.fn>
    fit: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }> = []

  const create = vi.fn((container: HTMLElement) => {
    const side: Side = container.dataset.testid === 'left-canvas'
      ? 'left'
      : 'right'
    const handle = {
      side,
      importXml: vi.fn((xml: string) => importers[side](xml)),
      applyChanges: vi.fn(),
      fit: vi.fn(),
      focus: vi.fn(),
      destroy: vi.fn(),
    }
    handles.push(handle)
    return handle
  })
  const compute = vi.fn<
    (leftXml: string, rightXml: string) => Promise<DiffResult>
  >()

  return {
    MockBpmnParseError,
    compute,
    create,
    handles,
    importers,
  }
})

vi.mock('@/bpmn/viewer', () => ({
  createBpmnViewer: runtime.create,
}))

vi.mock('@/bpmn/diff', () => ({
  BpmnParseError: runtime.MockBpmnParseError,
  computeBpmnDiff: runtime.compute,
}))

const changes = [
  {
    id: 'Added_1',
    type: 'bpmn:Task',
    name: 'Added step',
    status: 'added' as const,
    alsoLayoutChanged: false,
  },
  {
    id: 'Changed_1',
    type: 'bpmn:ServiceTask',
    name: 'Changed and moved',
    status: 'changed' as const,
    alsoLayoutChanged: true,
  },
  {
    id: 'Layout_1',
    type: 'bpmn:ExclusiveGateway',
    name: 'Moved gateway',
    status: 'layout-only' as const,
    alsoLayoutChanged: true,
  },
]

const file: CompareFileItem = {
  path: 'flows/order-processing.iflw',
  kind: 'bpmn',
  status: 'modified',
  patch: 'patch',
  leftContent: '<left/>',
  rightContent: '<right/>',
}

const mountedWrappers = new Set<{ unmount: () => void }>()
const resizeObservers: MockResizeObserver[] = []

class MockResizeObserver {
  readonly observe = vi.fn<(target: Element) => void>()
  readonly unobserve = vi.fn<(target: Element) => void>()
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function useQueuedAnimationFrames() {
  let nextId = 1
  const frames = new Map<number, FrameRequestCallback>()
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++
    frames.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => {
    frames.delete(id)
  })
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)

  return {
    cancel,
    pending: () => frames.size,
    request,
    flush() {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach(callback => callback(0))
    },
  }
}

function mountDialog(
  fileProp: CompareFileItem | null = file,
  open = true,
) {
  const wrapper = mount(BpmnCompareDialog, {
    props: {
      open,
      file: fileProp,
      leftLabel: 'DEV 1.0.0',
      rightLabel: 'TEST 1.0.1',
    },
  })
  mountedWrappers.add(wrapper)
  return wrapper
}

async function openDialog(wrapper: ReturnType<typeof mountDialog>) {
  await wrapper.get('[data-testid="bpmn-dialog"]').trigger('open')
  await flushPromises()
}

function handle(side: 'left' | 'right') {
  const result = runtime.handles.find(item => item.side === side)
  if (!result) throw new Error(`Missing ${side} viewer handle`)
  return result
}

describe('BpmnCompareDialog', () => {
  beforeEach(() => {
    runtime.create.mockClear()
    runtime.compute.mockReset()
    runtime.compute.mockResolvedValue({
      changes,
      warnings: { left: [], right: [] },
    })
    runtime.handles.splice(0)
    runtime.importers.left = async () => ({ warnings: [] })
    runtime.importers.right = async () => ({ warnings: [] })
    resizeObservers.splice(0)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    mountedWrappers.forEach(wrapper => wrapper.unmount())
    mountedWrappers.clear()
    document.body.replaceChildren()
  })

  it('initializes both modified viewers only after UI5 open, then imports, applies, and fits', async () => {
    runtime.importers.left = async () => ({ warnings: ['Left import warning'] })
    runtime.compute.mockResolvedValueOnce({
      changes,
      warnings: { left: [], right: ['Right parse warning'] },
    })
    const wrapper = mountDialog()

    expect(runtime.create).not.toHaveBeenCalled()
    expect(runtime.compute).not.toHaveBeenCalled()

    await openDialog(wrapper)

    expect(runtime.compute).toHaveBeenCalledWith('<left/>', '<right/>')
    expect(runtime.create).toHaveBeenCalledTimes(2)
    expect(handle('left').importXml).toHaveBeenCalledWith('<left/>')
    expect(handle('right').importXml).toHaveBeenCalledWith('<right/>')
    expect(handle('left').applyChanges).toHaveBeenCalledWith(
      changes,
      'left',
      false,
    )
    expect(handle('right').applyChanges).toHaveBeenCalledWith(
      changes,
      'right',
      false,
    )
    expect(handle('left').fit).toHaveBeenCalledOnce()
    expect(handle('right').fit).toHaveBeenCalledOnce()
    expect(handle('left').importXml.mock.invocationCallOrder[0]).toBeLessThan(
      handle('left').applyChanges.mock.invocationCallOrder[0],
    )
    expect(handle('left').applyChanges.mock.invocationCallOrder[0]).toBeLessThan(
      handle('left').fit.mock.invocationCallOrder[0],
    )
    expect(wrapper.get('[data-testid="warning-summary"]').text()).toContain(
      '2 warnings',
    )
  })

  it('hides only layout-only entries by default and reapplies them when unchecked', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)

    expect(wrapper.find('[data-testid="change-Layout_1"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="change-Changed_1"]').text()).toContain(
      'Changed and moved',
    )
    expect(wrapper.get('[data-testid="change-Changed_1"]').text()).toContain(
      'Layout also changed',
    )

    const checkbox = wrapper.get('[data-testid="hide-layout-only"]')
    expect((checkbox.element as HTMLElement & { checked: boolean }).checked).toBe(
      true,
    )
    ;(checkbox.element as HTMLElement & { checked: boolean }).checked = false
    await checkbox.trigger('change')

    expect(wrapper.get('[data-testid="change-Layout_1"]').text()).toContain(
      'Moved gateway',
    )
    expect(handle('left').applyChanges).toHaveBeenLastCalledWith(
      changes,
      'left',
      true,
    )
    expect(handle('right').applyChanges).toHaveBeenLastCalledWith(
      changes,
      'right',
      true,
    )
  })

  it('distinguishes an empty diff from layout-only changes hidden by the filter', async () => {
    const layoutOnly = changes.filter(change => change.status === 'layout-only')
    runtime.compute.mockResolvedValueOnce({
      changes: layoutOnly,
      warnings: { left: [], right: [] },
    })
    const wrapper = mountDialog()

    await openDialog(wrapper)

    expect(wrapper.find('[data-testid="no-changes"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="all-layout-hidden"]').text()).toBe(
      'All layout-only changes are hidden',
    )
  })

  it('uses keyboard-capable change buttons to focus the element in both viewers', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)

    const entry = wrapper.get('[data-testid="change-Changed_1"]')
    expect(entry.element.tagName).toBe('BUTTON')
    expect(entry.attributes('type')).toBe('button')
    await entry.trigger('click')

    expect(handle('left').focus).toHaveBeenCalledWith('Changed_1')
    expect(handle('right').focus).toHaveBeenCalledWith('Changed_1')
  })

  it('destroys on host close and emits close only once', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('close')
    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('close')

    expect(handle('left').destroy).toHaveBeenCalledOnce()
    expect(handle('right').destroy).toHaveBeenCalledOnce()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('deduplicates footer close from the subsequent prop and UI5 close events', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await wrapper.get('[data-testid="close-dialog"]').trigger('click')
    await wrapper.setProps({ open: false })
    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('close')

    expect(handle('left').destroy).toHaveBeenCalledOnce()
    expect(handle('right').destroy).toHaveBeenCalledOnce()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('destroys on open=false and destroys the next generation on unmount without emitting', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)
    const firstHandles = [...runtime.handles]

    await wrapper.setProps({ open: false })

    firstHandles.forEach(viewer => {
      expect(viewer.destroy).toHaveBeenCalledOnce()
    })
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.setProps({ open: true })
    await openDialog(wrapper)
    const secondHandles = runtime.handles.slice(2)

    wrapper.unmount()
    mountedWrappers.delete(wrapper)

    expect(secondHandles).toHaveLength(2)
    secondHandles.forEach(viewer => {
      expect(viewer.destroy).toHaveBeenCalledOnce()
    })
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('ignores a stale host open event while closed and initializes on the legitimate reopen', async () => {
    const wrapper = mountDialog()
    await openDialog(wrapper)
    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('close')
    await wrapper.setProps({ open: false })
    runtime.create.mockClear()

    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('open')
    await flushPromises()
    expect(runtime.create).not.toHaveBeenCalled()

    await wrapper.setProps({ open: true })
    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('open')
    await flushPromises()

    expect(runtime.create).toHaveBeenCalledTimes(2)
    expect(runtime.handles.slice(2).map(viewer => viewer.side)).toEqual([
      'left',
      'right',
    ])
    expect(runtime.handles[2].importXml).toHaveBeenCalledWith('<left/>')
    expect(runtime.handles[3].importXml).toHaveBeenCalledWith('<right/>')
  })

  it('prevents delayed imports from writing state after open becomes false', async () => {
    const leftImport = deferred<{ warnings: string[] }>()
    runtime.importers.left = () => leftImport.promise
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="bpmn-dialog"]').trigger('open')
    await flushPromises()
    expect(runtime.create).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ open: false })
    leftImport.resolve({ warnings: [] })
    await flushPromises()

    expect(runtime.compute).not.toHaveBeenCalled()
    runtime.handles.forEach(viewer => {
      expect(viewer.destroy).toHaveBeenCalledOnce()
      expect(viewer.applyChanges).not.toHaveBeenCalled()
      expect(viewer.fit).not.toHaveBeenCalled()
    })
    expect(wrapper.find('[data-testid="change-Changed_1"]').exists()).toBe(false)
  })

  it('reinitializes once for a changed file while open and cancels the old resize generation', async () => {
    const frames = useQueuedAnimationFrames()
    const wrapper = mountDialog()
    await openDialog(wrapper)
    frames.flush()

    const oldHandles = [...runtime.handles]
    const oldObserver = resizeObservers[0]
    oldHandles.forEach(viewer => viewer.fit.mockClear())
    oldObserver.trigger()
    expect(frames.pending()).toBe(1)

    const fileB: CompareFileItem = {
      path: 'flows/new-target.iflw',
      kind: 'bpmn',
      status: 'added',
      patch: 'new patch',
      rightContent: '<new-right/>',
    }
    await wrapper.setProps({ file: fileB })
    await flushPromises()

    expect(oldObserver.disconnect).toHaveBeenCalledOnce()
    oldHandles.forEach(viewer => {
      expect(viewer.destroy).toHaveBeenCalledOnce()
      expect(viewer.fit).not.toHaveBeenCalled()
    })
    expect(runtime.create).toHaveBeenCalledTimes(3)
    const newHandle = runtime.handles[2]
    expect(newHandle.side).toBe('right')
    expect(newHandle.importXml).toHaveBeenCalledWith('<new-right/>')
    expect(resizeObservers).toHaveLength(2)
    expect(resizeObservers[1].observe).toHaveBeenCalledOnce()

    frames.flush()
    expect(newHandle.fit).toHaveBeenCalledOnce()
  })

  it('observes both canvas containers, coalesces resize fits, and disconnects on unmount', async () => {
    const frames = useQueuedAnimationFrames()
    const wrapper = mountDialog()
    await openDialog(wrapper)

    expect(resizeObservers).toHaveLength(1)
    const observer = resizeObservers[0]
    expect(observer.observe).toHaveBeenCalledTimes(2)
    expect(observer.observe).toHaveBeenCalledWith(
      wrapper.get('[data-testid="left-canvas"]').element,
    )
    expect(observer.observe).toHaveBeenCalledWith(
      wrapper.get('[data-testid="right-canvas"]').element,
    )

    frames.flush()
    runtime.handles.forEach(viewer => viewer.fit.mockClear())
    frames.request.mockClear()
    observer.trigger()
    observer.trigger()

    expect(frames.request).toHaveBeenCalledOnce()
    expect(frames.pending()).toBe(1)
    runtime.handles.forEach(viewer => {
      expect(viewer.fit).not.toHaveBeenCalled()
    })

    frames.flush()
    runtime.handles.forEach(viewer => {
      expect(viewer.fit).toHaveBeenCalledOnce()
      viewer.fit.mockClear()
    })

    observer.trigger()
    wrapper.unmount()
    mountedWrappers.delete(wrapper)

    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(frames.cancel).toHaveBeenCalled()
    frames.flush()
    runtime.handles.forEach(viewer => {
      expect(viewer.fit).not.toHaveBeenCalled()
    })
  })

  it.each([
    {
      status: 'added' as const,
      existingSide: 'right' as const,
      content: '<right/>',
      message: 'Entire iFlow added',
      placeholder: 'Not present in source',
    },
    {
      status: 'deleted' as const,
      existingSide: 'left' as const,
      content: '<left/>',
      message: 'Entire iFlow removed',
      placeholder: 'Not present in target',
    },
  ])(
    'creates only the $existingSide viewer for a $status file and keeps its file entry non-focusable',
    async ({ status, existingSide, content, message, placeholder }) => {
      const singleFile: CompareFileItem = status === 'added'
        ? {
            ...file,
            status,
            leftContent: undefined,
            rightContent: content,
          }
        : {
            ...file,
            status,
            leftContent: content,
            rightContent: undefined,
          }
      const wrapper = mountDialog(singleFile)

      await openDialog(wrapper)

      expect(runtime.create).toHaveBeenCalledOnce()
      expect(runtime.handles[0].side).toBe(existingSide)
      expect(runtime.handles[0].importXml).toHaveBeenCalledWith(content)
      expect(runtime.compute).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain(placeholder)

      const entry = wrapper.get('[data-testid="file-change"]')
      expect(entry.text()).toContain(message)
      expect(entry.element.tagName).toBe('DIV')
      expect(entry.attributes('role')).toBe('status')
      expect(entry.attributes('tabindex')).toBeUndefined()
      expect(runtime.handles[0].focus).not.toHaveBeenCalled()
    },
  )

  it.each([
    {
      status: 'modified' as const,
      existingSide: 'left' as const,
      missingSide: null,
      file: {
        ...file,
        leftContent: undefined,
      } satisfies CompareFileItem,
    },
    {
      status: 'added' as const,
      existingSide: 'right' as const,
      missingSide: 'left' as const,
      file: {
        ...file,
        status: 'added' as const,
        leftContent: undefined,
        rightContent: undefined,
      } satisfies CompareFileItem,
    },
    {
      status: 'deleted' as const,
      existingSide: 'left' as const,
      missingSide: 'right' as const,
      file: {
        ...file,
        status: 'deleted' as const,
        leftContent: undefined,
        rightContent: undefined,
      } satisfies CompareFileItem,
    },
  ])(
    'imports undefined content as malformed XML for a present $status $existingSide side',
    async ({ status, existingSide, missingSide, file: undefinedContentFile }) => {
      runtime.importers[existingSide] = async () => {
        throw new Error(`${existingSide} empty XML`)
      }
      if (status === 'modified') {
        runtime.compute.mockRejectedValueOnce(
          new runtime.MockBpmnParseError(
            existingSide,
            new Error(`${existingSide} empty XML`),
          ),
        )
      }
      const wrapper = mountDialog(undefinedContentFile)

      await openDialog(wrapper)

      expect(handle(existingSide).importXml).toHaveBeenCalledWith('')
      expect(wrapper.get('[data-testid="error-list"]').text()).toContain(
        `${existingSide} empty XML`,
      )
      if (missingSide) {
        expect(runtime.handles.some(viewer => viewer.side === missingSide)).toBe(
          false,
        )
      } else {
        expect(runtime.create).toHaveBeenCalledTimes(2)
      }
    },
  )

  it.each(['left', 'right'] as const)(
    'reports a malformed %s side with the path and text-diff fallback while retaining the other viewer',
    async (side) => {
      runtime.importers[side] = async () => {
        throw new Error(`${side} viewer import failed`)
      }
      runtime.compute.mockRejectedValueOnce(
        new runtime.MockBpmnParseError(
          side,
          new Error(`${side} XML malformed`),
        ),
      )
      const brokenFile: CompareFileItem = {
        ...file,
        [side === 'left' ? 'leftContent' : 'rightContent']: '',
      }
      const wrapper = mountDialog(brokenFile)

      await openDialog(wrapper)

      expect(handle(side).importXml).toHaveBeenCalledWith('')
      const errorText = wrapper.get('[data-testid="error-list"]').text()
      expect(errorText).toContain(file.path)
      expect(errorText.toLowerCase()).toContain(side)
      expect(errorText).toContain(`${side} XML malformed`)
      expect(errorText).toContain(
        'Close this dialog and use Show text diff',
      )

      const otherSide = side === 'left' ? 'right' : 'left'
      expect(handle(otherSide).fit).toHaveBeenCalledOnce()
      expect(handle(side).fit).not.toHaveBeenCalled()
    },
  )

  it('preserves import error attribution when the opposite viewer cannot be created', async () => {
    runtime.create.mockImplementationOnce(() => {
      throw new Error('left viewer creation failed')
    })
    runtime.importers.right = async () => {
      throw new Error('right viewer import failed')
    }
    runtime.compute.mockRejectedValueOnce(new Error('semantic diff unavailable'))
    const wrapper = mountDialog()

    await openDialog(wrapper)

    const errorText = wrapper.get('[data-testid="error-list"]').text()
    expect(errorText).toContain(
      `${file.path} — left (Source): left viewer creation failed`,
    )
    expect(errorText).toContain(
      `${file.path} — right (Target): right viewer import failed`,
    )
  })

  it('shows general runtime failures in both canvas areas with the text-diff fallback', async () => {
    runtime.compute.mockRejectedValueOnce(new Error('diff runtime unavailable'))
    const wrapper = mountDialog()

    await openDialog(wrapper)

    const leftError = wrapper.get('[data-testid="canvas-error-left"]').text()
    const rightError = wrapper.get('[data-testid="canvas-error-right"]').text()
    expect(leftError).toContain('diff runtime unavailable')
    expect(rightError).toContain('diff runtime unavailable')
    expect(leftError).toContain('Close this dialog and use Show text diff')
    expect(rightError).toContain('Close this dialog and use Show text diff')
  })

  it('shows an explicit empty result when no BPMN elements changed', async () => {
    runtime.compute.mockResolvedValueOnce({
      changes: [],
      warnings: { left: [], right: [] },
    })
    const wrapper = mountDialog()

    await openDialog(wrapper)

    expect(wrapper.get('[data-testid="no-changes"]').text()).toBe(
      'No BPMN element changes',
    )
  })

  it('presents enterprise metadata and four accurately encoded legends', () => {
    const wrapper = mountDialog()

    expect(
      wrapper.get('[data-testid="bpmn-dialog"]').attributes('header-text'),
    ).toBe('BPMN Visual Diff')
    expect(wrapper.text()).toContain(file.path)
    expect(wrapper.text()).toContain('Source · DEV 1.0.0')
    expect(wrapper.text()).toContain('Target · TEST 1.0.1')
    expect(wrapper.get('[data-testid="legend-added"]').text()).toMatch(
      /Added.*solid/i,
    )
    expect(wrapper.get('[data-testid="legend-removed"]').text()).toMatch(
      /Removed.*dashed/i,
    )
    expect(wrapper.get('[data-testid="legend-changed"]').text()).toMatch(
      /Changed.*short dashed/i,
    )
    expect(wrapper.get('[data-testid="legend-layout-only"]').text()).toMatch(
      /Layout-only.*dotted/i,
    )
    const removedLine = wrapper.get(
      '[data-testid="legend-removed"] line',
    )
    const changedLine = wrapper.get(
      '[data-testid="legend-changed"] line',
    )
    expect(removedLine.attributes('stroke-dasharray')).toBe('8 4')
    expect(changedLine.attributes('stroke-dasharray')).toBe('4 3')
    expect(changedLine.attributes('stroke-dasharray')).not.toBe(
      removedLine.attributes('stroke-dasharray'),
    )
  })

  it('uses literal lazy imports for both BPMN runtime boundaries', () => {
    expect(componentSource).toContain("import('@/bpmn/diff')")
    expect(componentSource).toContain("import('@/bpmn/viewer')")
    expect(componentSource).not.toMatch(
      /import\s+\{[^}]*computeBpmnDiff[^}]*\}\s+from\s+['"]@\/bpmn\/diff['"]/,
    )
    expect(componentSource).not.toMatch(
      /import\s+\{[^}]*createBpmnViewer[^}]*\}\s+from\s+['"]@\/bpmn\/viewer['"]/,
    )
  })
})
