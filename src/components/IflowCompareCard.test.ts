import { flushPromises, mount } from '@vue/test-utils'
import { createTwoFilesPatch } from 'diff'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Button from '@ui5/webcomponents/dist/Button.js'
import type { CompareFileItem } from '@/service/codeCompareFiles'
import IflowCompareCard from './IflowCompareCard.vue'
import componentSource from './IflowCompareCard.vue?raw'

const renderer = vi.hoisted(() => {
  const draw = vi.fn()
  const construct = vi.fn(function (
    this: { draw: () => void },
    container: HTMLElement,
    patch: string,
    options: Record<string, unknown>,
  ) {
    this.draw = () => {
      draw(container, patch, options)

      const output = document.createElement('div')
      output.dataset.testid = 'rendered-text-diff'
      container.append(output)
    }
  })

  return { construct, draw }
})

vi.mock('diff2html/lib-esm/ui/js/diff2html-ui-base', () => ({
  Diff2HtmlUI: renderer.construct,
}))

const file: CompareFileItem = {
  path: 'flows/order-processing.iflw',
  kind: 'bpmn',
  status: 'modified',
  patch: [
    '--- flows/order-processing.iflw',
    '+++ flows/order-processing.iflw',
    '@@ -1 +1 @@',
    '-<old />',
    '+<new />',
  ].join('\n'),
  leftContent: '<old />',
  rightContent: '<new />',
}

const mountCard = (fileProp: CompareFileItem = file) => mount(IflowCompareCard, {
  props: {
    file: fileProp,
    outputFormat: 'side-by-side',
    diffMatchStyle: 'word',
  },
})

describe('IflowCompareCard', () => {
  beforeEach(() => {
    renderer.construct.mockClear()
    renderer.draw.mockClear()
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('shows file metadata and keeps the large XML diff collapsed initially', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain(file.path)
    expect(wrapper.text()).toContain('modified')
    expect(wrapper.text()).toContain('Large XML diff hidden')
    expect(wrapper.find('[data-testid="text-diff"]').exists()).toBe(false)
    expect(renderer.construct).not.toHaveBeenCalled()
    expect(renderer.draw).not.toHaveBeenCalled()
  })

  it('exposes disclosure state and the stable panel id through UI5 accessibilityAttributes', async () => {
    const wrapper = mountCard()
    const disclosure = wrapper.get('[data-testid="show-text-diff"]').element as Button

    expect(disclosure.hasAttribute('aria-expanded')).toBe(false)
    expect(disclosure.accessibilityAttributes).toEqual(expect.objectContaining({
      expanded: false,
      controls: expect.any(String),
    }))

    const panelId = disclosure.accessibilityAttributes.controls
    expect(panelId).not.toBe('')

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="text-diff"]').attributes('id')).toBe(panelId)
    expect(disclosure.accessibilityAttributes).toEqual(expect.objectContaining({
      expanded: true,
      controls: panelId,
    }))

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')

    expect(disclosure.accessibilityAttributes).toEqual(expect.objectContaining({
      expanded: false,
      controls: panelId,
    }))
  })

  it('lazily draws the text diff once and removes generated DOM when collapsed', async () => {
    const wrapper = mountCard()
    const toggle = wrapper.get('[data-testid="show-text-diff"]')

    await toggle.trigger('click')
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(1)
    expect(renderer.draw).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="show-text-diff"]').text()).toBe('Hide text diff')
    expect(wrapper.find('[data-testid="text-diff"]').exists()).toBe(true)

    const container = renderer.construct.mock.calls[0][0] as HTMLElement
    expect(container.querySelector('[data-testid="rendered-text-diff"]')).not.toBeNull()

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')

    expect(wrapper.get('[data-testid="show-text-diff"]').text()).toBe('Show text diff')
    expect(wrapper.find('[data-testid="text-diff"]').exists()).toBe(false)
    expect(container.childElementCount).toBe(0)
  })

  it('emits the same file when the visual diff is requested', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="open-visual-diff"]').trigger('click')

    const emitted = wrapper.emitted('open-visual')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toBe(wrapper.props('file'))
  })

  it('redraws an expanded diff when rendering props or the patch change', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    await flushPromises()
    renderer.construct.mockClear()
    renderer.draw.mockClear()

    await wrapper.setProps({ outputFormat: 'line-by-line' })
    await flushPromises()
    expect(renderer.construct).toHaveBeenCalledTimes(1)
    expect(renderer.construct.mock.calls[0][2]).toEqual(expect.objectContaining({
      outputFormat: 'line-by-line',
      drawFileList: false,
      matching: 'words',
      diffStyle: 'word',
      synchronisedScroll: true,
      fileContentToggle: false,
      stickyFileHeaders: true,
      highlight: false,
    }))

    await wrapper.setProps({ diffMatchStyle: 'char' })
    await flushPromises()
    expect(renderer.construct).toHaveBeenCalledTimes(2)
    expect(renderer.construct.mock.calls[1][2]).toMatchObject({
      outputFormat: 'line-by-line',
      matching: 'none',
      diffStyle: 'char',
    })

    const changedFile = {
      ...file,
      patch: `${file.patch}\n+<updated />`,
    }
    await wrapper.setProps({ file: changedFile })
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(3)
    expect(renderer.draw).toHaveBeenCalledTimes(3)
    expect(renderer.construct.mock.calls[2][1]).toBe(changedFile.patch)
  })

  it('coalesces expansion and same-tick rendering prop changes into one latest draw', async () => {
    const wrapper = mountCard()
    const changedFile = {
      ...file,
      patch: `${file.patch}\n+<updated />`,
    }

    const toggle = wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    const update = wrapper.setProps({
      outputFormat: 'line-by-line',
      diffMatchStyle: 'char',
      file: changedFile,
    })
    await Promise.all([toggle, update])
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(1)
    expect(renderer.draw).toHaveBeenCalledTimes(1)
    expect(renderer.construct.mock.calls[0][1]).toBe(changedFile.patch)
    expect(renderer.construct.mock.calls[0][2]).toMatchObject({
      outputFormat: 'line-by-line',
      matching: 'none',
      diffStyle: 'char',
    })
  })

  it('coalesces multiple rendering prop changes in one expanded update', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    await flushPromises()
    renderer.construct.mockClear()
    renderer.draw.mockClear()

    const changedFile = {
      ...file,
      patch: `${file.patch}\n+<updated />`,
    }
    await wrapper.setProps({
      outputFormat: 'line-by-line',
      diffMatchStyle: 'char',
      file: changedFile,
    })
    await flushPromises()

    expect(renderer.construct).toHaveBeenCalledTimes(1)
    expect(renderer.draw).toHaveBeenCalledTimes(1)
  })

  it('does not redraw when the file object changes but its patch is equal', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    await flushPromises()
    renderer.construct.mockClear()
    renderer.draw.mockClear()

    await wrapper.setProps({ file: { ...file } })
    await flushPromises()

    expect(renderer.construct).not.toHaveBeenCalled()
    expect(renderer.draw).not.toHaveBeenCalled()
  })

  it('does not draw when rendering props or the patch change while collapsed', async () => {
    const wrapper = mountCard()

    await wrapper.setProps({
      outputFormat: 'line-by-line',
      diffMatchStyle: 'char',
      file: {
        ...file,
        patch: `${file.patch}\n+<updated />`,
      },
    })
    await flushPromises()

    expect(renderer.construct).not.toHaveBeenCalled()
    expect(renderer.draw).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="text-diff"]').exists()).toBe(false)
  })

  it('clears renderer-created DOM before unmounting', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(IflowCompareCard, {
      attachTo: host,
      props: {
        file,
        outputFormat: 'side-by-side',
        diffMatchStyle: 'word',
      },
    })

    await wrapper.get('[data-testid="show-text-diff"]').trigger('click')
    await flushPromises()

    const container = renderer.construct.mock.calls[0][0] as HTMLElement
    const generatedNode = container.querySelector('[data-testid="rendered-text-diff"]')
    expect(generatedNode?.isConnected).toBe(true)

    wrapper.unmount()

    expect(container.childNodes).toHaveLength(0)
    expect(generatedNode?.isConnected).toBe(false)
  })

  it('keeps sticky diff headers outside scrolling card ancestors', () => {
    const styleSource = componentSource.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1]
    const cardRule = styleSource?.match(/\.iflow-compare-card\s*\{([^}]*)\}/)?.[1]
    const textDiffRule = styleSource?.match(/\.text-diff\s*\{([^}]*)\}/)?.[1]

    expect(cardRule).toContain('box-sizing: border-box')
    expect(cardRule).not.toMatch(/\boverflow(?:-x|-y)?\s*:\s*(?:hidden|auto|scroll|clip)/)
    expect(textDiffRule).toContain('box-sizing: border-box')
    expect(textDiffRule).not.toMatch(/\boverflow(?:-x|-y)?\s*:\s*(?:hidden|auto|scroll|clip)/)
  })
})

describe('Diff2HtmlUI integration', () => {
  it('renders a file wrapper from a valid unified patch', async () => {
    const { Diff2HtmlUI: ActualDiff2HtmlUI } = await vi.importActual<
      typeof import('diff2html/lib-esm/ui/js/diff2html-ui-base')
    >('diff2html/lib-esm/ui/js/diff2html-ui-base')
    const container = document.createElement('div')
    const patch = createTwoFilesPatch(
      'flows/order-processing.iflw',
      'flows/order-processing.iflw',
      '<old />',
      '<new />',
    )

    new ActualDiff2HtmlUI(container, patch, {
      drawFileList: false,
      highlight: false,
    }).draw()

    expect(container.querySelector('.d2h-file-wrapper')).not.toBeNull()
  })
})
