import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GitSnapshot, SnapshotFilesResponse } from '@/service/api'
import type { CompareFileItem } from '@/service/codeCompareFiles'
import CodeCompareViewer from './CodeCompareViewer.vue'

const api = vi.hoisted(() => {
  interface FileEntry {
    path: string
    content?: string
    isBinary: boolean
    size: number
  }

  const state = {
    sourceVersion: '1.0.0',
    targetVersion: '1.0.1',
    sourceFiles: [] as FileEntry[],
    targetFiles: [] as FileEntry[],
  }

  const defaultGetGitSnapshots = (
    _artifactId: string,
    tenantId: number,
  ): Promise<GitSnapshot[]> => Promise.resolve([{
      ID: tenantId === 1 ? 101 : 202,
      artifactId: 'Artifact',
      version: tenantId === 1
        ? state.sourceVersion
        : state.targetVersion,
      cpiTenantId: tenantId,
      status: 'completed' as const,
      triggeredAt: '2026-07-30T00:00:00Z',
      commitUrl: tenantId === 1
        ? 'https://example.test/source'
        : 'https://example.test/target',
    }])
  const defaultGetSnapshotFiles = (
    snapshotId: number,
  ): Promise<SnapshotFilesResponse> => {
    const isSource = snapshotId === 101
    return Promise.resolve({
      snapshotId,
      artifactId: 'Artifact',
      version: isSource ? state.sourceVersion : state.targetVersion,
      tenant: isSource ? 'DEV' : 'TEST',
      files: (isSource ? state.sourceFiles : state.targetFiles)
        .map(file => ({ ...file })),
    })
  }
  const defaultTriggerGitSync = async () => undefined
  const getGitSnapshots = vi.fn(defaultGetGitSnapshots)
  const getSnapshotFiles = vi.fn(defaultGetSnapshotFiles)
  const triggerGitSync = vi.fn(defaultTriggerGitSync)

  return {
    defaultGetGitSnapshots,
    defaultGetSnapshotFiles,
    defaultTriggerGitSync,
    getGitSnapshots,
    getSnapshotFiles,
    state,
    triggerGitSync,
  }
})

const renderer = vi.hoisted(() => {
  const draw = vi.fn()
  const construct = vi.fn(function (
    this: { draw: () => void },
    container: HTMLElement,
    input: string,
    options: Record<string, unknown>,
  ) {
    this.draw = () => {
      draw(container, input, options)

      const output = document.createElement('div')
      output.dataset.testid = 'rendered-diff'
      output.textContent = input
      container.replaceChildren(output)
    }
  })

  return { construct, draw }
})

vi.mock('@/service/api', () => ({
  GetGitSnapshots: api.getGitSnapshots,
  GetSnapshotFiles: api.getSnapshotFiles,
  TriggerGitSync: api.triggerGitSync,
}))

vi.mock('diff2html/lib-esm/ui/js/diff2html-ui-base', () => ({
  Diff2HtmlUI: renderer.construct,
}))

const IflowCompareCardStub = defineComponent({
  name: 'IflowCompareCard',
  props: ['file', 'outputFormat', 'diffMatchStyle'],
  emits: ['open-visual'],
  template: `
    <button
      data-testid="iflow-card"
      type="button"
      @click="$emit('open-visual', file)"
    >
      {{ file.path }}
    </button>
  `,
})

const BpmnCompareDialogStub = defineComponent({
  name: 'BpmnCompareDialog',
  props: ['open', 'file', 'leftLabel', 'rightLabel'],
  emits: ['close'],
  template: `
    <section data-testid="bpmn-dialog-stub">
      <button
        data-testid="close-bpmn-dialog"
        type="button"
        @click="$emit('close')"
      >
        Close
      </button>
    </section>
  `,
})

interface ViewerProps {
  artifactId: string
  artifactVersion: string
  packageId: string
  artifactType: string
  sourceTenantId: number
  targetTenantId: number
}

const defaultProps: ViewerProps = {
  artifactId: 'Artifact',
  artifactVersion: '1.0.0',
  packageId: 'Package',
  artifactType: 'Integration Flow',
  sourceTenantId: 1,
  targetTenantId: 2,
}

const mountedWrappers = new Set<{ unmount: () => void }>()

function file(
  path: string,
  content: string,
  isBinary = false,
) {
  return {
    path,
    content,
    isBinary,
    size: content.length,
  }
}

function useMixedChanges() {
  api.state.sourceFiles = [
    file('flow/Integration.iflw', '<old/>'),
    file('script/a.groovy', 'old'),
  ]
  api.state.targetFiles = [
    file('flow/Integration.iflw', '<new/>'),
    file('script/a.groovy', 'new'),
  ]
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

function snapshotFiles(
  snapshotId: number,
  tenant: string,
  version: string,
  files: SnapshotFilesResponse['files'],
): SnapshotFilesResponse {
  return {
    snapshotId,
    artifactId: 'Artifact',
    version,
    tenant,
    files,
  }
}

function completedSnapshot(
  ID: number,
  cpiTenantId: number,
  version: string,
): GitSnapshot {
  return {
    ID,
    artifactId: 'Artifact',
    version,
    cpiTenantId,
    status: 'completed',
    triggeredAt: '2026-07-30T00:00:00Z',
  }
}

function mountViewer(
  props: Partial<ViewerProps> = {},
  attachTo?: HTMLElement,
) {
  const wrapper = mount(CodeCompareViewer, {
    attachTo,
    props: {
      ...defaultProps,
      ...props,
    },
    global: {
      stubs: {
        BpmnCompareDialog: BpmnCompareDialogStub,
        IflowCompareCard: IflowCompareCardStub,
      },
    },
  })
  mountedWrappers.add(wrapper)
  return wrapper
}

describe('CodeCompareViewer', () => {
  beforeEach(() => {
    api.getGitSnapshots.mockReset()
    api.getGitSnapshots.mockImplementation(api.defaultGetGitSnapshots)
    api.getSnapshotFiles.mockReset()
    api.getSnapshotFiles.mockImplementation(api.defaultGetSnapshotFiles)
    api.triggerGitSync.mockReset()
    api.triggerGitSync.mockImplementation(api.defaultTriggerGitSync)
    renderer.construct.mockClear()
    renderer.draw.mockClear()
    api.state.sourceVersion = '1.0.0'
    api.state.targetVersion = '1.0.1'
    useMixedChanges()
  })

  afterEach(() => {
    mountedWrappers.forEach(wrapper => wrapper.unmount())
    mountedWrappers.clear()
    document.body.replaceChildren()
  })

  it('routes changed iflw files to cards and regular files to the top-level renderer', async () => {
    const wrapper = mountViewer()

    await flushPromises()

    const cards = wrapper.findAllComponents(IflowCompareCardStub)
    expect(cards).toHaveLength(1)
    expect(cards[0].props('file')).toMatchObject({
      path: 'flow/Integration.iflw',
      kind: 'bpmn',
      status: 'modified',
      leftContent: '<old/>',
      rightContent: '<new/>',
    })
    expect(cards[0].props('outputFormat')).toBe('side-by-side')
    expect(cards[0].props('diffMatchStyle')).toBe('word')

    expect(renderer.construct).toHaveBeenCalledTimes(1)
    const diffInput = renderer.construct.mock.calls[0][1]
    expect(diffInput).toContain('script/a.groovy')
    expect(diffInput).not.toContain('flow/Integration.iflw')
    expect(wrapper.text()).toContain('~2')
    expect(wrapper.text()).toContain('DEV v1.0.0')
    expect(wrapper.text()).toContain('TEST v1.0.1')

    const cardElement = wrapper.get('[data-testid="iflow-card"]').element
    const diffOutput = wrapper.get('[data-testid="rendered-diff"]').element
    expect(
      cardElement.compareDocumentPosition(diffOutput)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
  })

  it('keeps an iflw-only comparison in the diff state without creating a top-level renderer', async () => {
    api.state.sourceFiles = [
      file('flow/Integration.iflw', '<old/>'),
    ]
    api.state.targetFiles = [
      file('flow/Integration.iflw', '<new/>'),
    ]
    const wrapper = mountViewer()

    await flushPromises()

    expect(wrapper.findAllComponents(IflowCompareCardStub)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('No differences found')
    expect(wrapper.find('ui5-segmented-button').exists()).toBe(true)
    expect(renderer.construct).not.toHaveBeenCalled()
  })

  it('shows no differences only when all non-binary files are unchanged', async () => {
    api.state.sourceFiles = [
      file('script/a.groovy', 'same'),
      file('lib/dependency.jar', 'old-binary', true),
    ]
    api.state.targetFiles = [
      file('script/a.groovy', 'same'),
      file('lib/dependency.jar', 'new-binary', true),
    ]
    const wrapper = mountViewer()

    await flushPromises()

    expect(wrapper.text()).toContain(
      'No differences found between the two versions.',
    )
    expect(wrapper.findAllComponents(IflowCompareCardStub)).toHaveLength(0)
    expect(renderer.construct).not.toHaveBeenCalled()
  })

  it('opens the visual dialog for the emitted file and clears it on close', async () => {
    const wrapper = mountViewer()
    await flushPromises()

    const card = wrapper.getComponent(IflowCompareCardStub)
    const selectedFile = card.props('file') as CompareFileItem
    await card.trigger('click')

    const dialog = wrapper.getComponent(BpmnCompareDialogStub)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('file')).toBe(selectedFile)
    expect(dialog.props('leftLabel')).toBe('DEV v1.0.0')
    expect(dialog.props('rightLabel')).toBe('TEST v1.0.1')

    await dialog.get('[data-testid="close-bpmn-dialog"]').trigger('click')

    expect(dialog.props('open')).toBe(false)
    expect(dialog.props('file')).toBeNull()
  })

  it('clears an open iflw selection when compare props trigger a reload', async () => {
    const wrapper = mountViewer()
    await flushPromises()

    await wrapper.getComponent(IflowCompareCardStub).trigger('click')
    const dialog = wrapper.getComponent(BpmnCompareDialogStub)
    expect(dialog.props('open')).toBe(true)

    api.state.sourceVersion = '2.0.0'
    await wrapper.setProps({ artifactVersion: '2.0.0' })
    await flushPromises()

    expect(api.getGitSnapshots).toHaveBeenCalledTimes(4)
    expect(dialog.props('open')).toBe(false)
    expect(dialog.props('file')).toBeNull()
  })

  it('keeps the newer comparison when older snapshot files resolve last', async () => {
    const sourceA = deferred<SnapshotFilesResponse>()
    const targetA = deferred<SnapshotFilesResponse>()
    const sourceB = deferred<SnapshotFilesResponse>()
    const targetB = deferred<SnapshotFilesResponse>()
    api.getSnapshotFiles
      .mockImplementationOnce(() => sourceA.promise)
      .mockImplementationOnce(() => targetA.promise)
      .mockImplementationOnce(() => sourceB.promise)
      .mockImplementationOnce(() => targetB.promise)

    const wrapper = mountViewer()
    await flushPromises()
    expect(api.getSnapshotFiles).toHaveBeenCalledTimes(2)

    api.state.sourceVersion = '2.0.0'
    api.state.targetVersion = '2.0.1'
    await wrapper.setProps({ artifactVersion: '2.0.0' })
    await flushPromises()
    expect(api.getSnapshotFiles).toHaveBeenCalledTimes(4)

    sourceB.resolve(snapshotFiles(101, 'B-SOURCE', '2.0.0', [
      file('flow/B.iflw', '<b-old/>'),
      file('script/B.groovy', 'b-old'),
    ]))
    targetB.resolve(snapshotFiles(202, 'B-TARGET', '2.0.1', [
      file('flow/B.iflw', '<b-new/>'),
      file('script/B.groovy', 'b-new'),
    ]))
    await flushPromises()

    expect(wrapper.getComponent(IflowCompareCardStub).props('file'))
      .toMatchObject({ path: 'flow/B.iflw' })
    expect(wrapper.get('[data-testid="rendered-diff"]').text())
      .toContain('script/B.groovy')
    expect(wrapper.text()).toContain('B-SOURCE v2.0.0')
    expect(wrapper.text()).toContain('B-TARGET v2.0.1')
    expect(wrapper.text()).toContain('~2')
    expect(renderer.construct).toHaveBeenCalledTimes(1)

    sourceA.resolve(snapshotFiles(101, 'A-SOURCE', '1.0.0', [
      file('flow/A.iflw', '<a-old/>'),
      file('script/A.groovy', 'a-old'),
      file('config/A.properties', 'a=old'),
    ]))
    targetA.resolve(snapshotFiles(202, 'A-TARGET', '1.0.1', [
      file('flow/A.iflw', '<a-new/>'),
      file('script/A.groovy', 'a-new'),
      file('config/A.properties', 'a=new'),
    ]))
    await flushPromises()

    expect(wrapper.getComponent(IflowCompareCardStub).props('file'))
      .toMatchObject({ path: 'flow/B.iflw' })
    expect(wrapper.get('[data-testid="rendered-diff"]').text())
      .toContain('script/B.groovy')
    expect(wrapper.text()).toContain('B-SOURCE v2.0.0')
    expect(wrapper.text()).toContain('B-TARGET v2.0.1')
    expect(wrapper.text()).toContain('~2')
    expect(wrapper.text()).not.toContain('A-SOURCE')
    expect(wrapper.text()).not.toContain('~3')
    expect(wrapper.find('ui5-busy-indicator').exists()).toBe(false)
    expect(renderer.construct).toHaveBeenCalledTimes(1)
  })

  it('does not let stale file completion clear a newer loading state', async () => {
    const sourceA = deferred<SnapshotFilesResponse>()
    const targetA = deferred<SnapshotFilesResponse>()
    const sourceB = deferred<SnapshotFilesResponse>()
    const targetB = deferred<SnapshotFilesResponse>()
    api.getSnapshotFiles
      .mockImplementationOnce(() => sourceA.promise)
      .mockImplementationOnce(() => targetA.promise)
      .mockImplementationOnce(() => sourceB.promise)
      .mockImplementationOnce(() => targetB.promise)

    const wrapper = mountViewer()
    await flushPromises()

    api.state.sourceVersion = '2.0.0'
    api.state.targetVersion = '2.0.1'
    await wrapper.setProps({ artifactVersion: '2.0.0' })
    await flushPromises()

    sourceA.resolve(snapshotFiles(101, 'A-SOURCE', '1.0.0', [
      file('script/A.groovy', 'a-old'),
    ]))
    targetA.resolve(snapshotFiles(202, 'A-TARGET', '1.0.1', [
      file('script/A.groovy', 'a-new'),
    ]))
    await flushPromises()

    expect(wrapper.find('ui5-busy-indicator').exists()).toBe(true)
    expect(renderer.construct).not.toHaveBeenCalled()

    sourceB.resolve(snapshotFiles(101, 'B-SOURCE', '2.0.0', [
      file('script/B.groovy', 'b-old'),
    ]))
    targetB.resolve(snapshotFiles(202, 'B-TARGET', '2.0.1', [
      file('script/B.groovy', 'b-new'),
    ]))
    await flushPromises()

    expect(wrapper.find('ui5-busy-indicator').exists()).toBe(false)
    expect(wrapper.get('[data-testid="rendered-diff"]').text())
      .toContain('script/B.groovy')
  })

  it('invalidates a pending snapshot response when unmounted', async () => {
    const sourceSnapshots = deferred<GitSnapshot[]>()
    const targetSnapshots = deferred<GitSnapshot[]>()
    api.getGitSnapshots
      .mockImplementationOnce(() => sourceSnapshots.promise)
      .mockImplementationOnce(() => targetSnapshots.promise)
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mountViewer({}, host)
    await flushPromises()
    expect(api.getGitSnapshots).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    mountedWrappers.delete(wrapper)
    sourceSnapshots.resolve([completedSnapshot(101, 1, '1.0.0')])
    targetSnapshots.resolve([completedSnapshot(202, 2, '1.0.1')])
    await flushPromises()

    expect(api.getSnapshotFiles).not.toHaveBeenCalled()
    expect(renderer.construct).not.toHaveBeenCalled()
    expect(host.childElementCount).toBe(0)
  })

  it('preserves top-level text diff options and toolbar redraw behavior', async () => {
    api.state.sourceFiles = [
      file('script/a.groovy', 'old'),
    ]
    api.state.targetFiles = [
      file('script/a.groovy', 'new'),
    ]
    const wrapper = mountViewer()

    await flushPromises()

    expect(wrapper.findAllComponents(IflowCompareCardStub)).toHaveLength(0)
    expect(renderer.construct).toHaveBeenCalledTimes(1)
    expect(renderer.construct.mock.calls[0][1]).toContain('script/a.groovy')
    expect(renderer.construct.mock.calls[0][2]).toEqual({
      outputFormat: 'side-by-side',
      drawFileList: true,
      matching: 'words',
      diffStyle: 'word',
      synchronisedScroll: true,
      fileContentToggle: true,
      stickyFileHeaders: true,
      highlight: false,
    })
    expect(renderer.draw).toHaveBeenCalledTimes(1)

    const toolbarItems = wrapper.findAll('ui5-segmented-button-item')
    expect(toolbarItems).toHaveLength(4)
    const segmentedButtons = wrapper.findAll('ui5-segmented-button')
    expect(segmentedButtons).toHaveLength(2)
    expect(
      (segmentedButtons[0].element as HTMLElement & {
        accessibleName: string
      }).accessibleName,
    ).toBe('Diff layout')
    expect(
      (segmentedButtons[1].element as HTMLElement & {
        accessibleName: string
      }).accessibleName,
    ).toBe('Diff granularity')

    await toolbarItems[1].trigger('click')
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(2)
    expect(renderer.construct.mock.calls[1][2]).toMatchObject({
      outputFormat: 'line-by-line',
      matching: 'words',
      diffStyle: 'word',
    })

    await toolbarItems[3].trigger('click')
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(3)
    expect(renderer.construct.mock.calls[2][2]).toMatchObject({
      outputFormat: 'line-by-line',
      matching: 'none',
      diffStyle: 'char',
    })
    expect(renderer.draw).toHaveBeenCalledTimes(3)
  })
})
