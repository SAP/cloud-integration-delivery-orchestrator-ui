import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CodeCompareSelectionBar from './CodeCompareSelectionBar.vue'

const artifacts = [
  {
    ID: 1,
    ArtifactTechID: 'Order_Processing',
    ArtifactName: 'Order Processing',
    ArtifactVersion: '1.4.2',
  },
  {
    ID: 2,
    ArtifactTechID: 'Invoice_Processing',
    ArtifactName: '',
    ArtifactVersion: '2.0.0',
  },
]

const targetTenants = [
  { ID: 20, Name: 'TEST' },
  { ID: 30, Name: 'PROD' },
]

function mountBar(
  props: Partial<InstanceType<typeof CodeCompareSelectionBar>['$props']> = {},
) {
  return mount(CodeCompareSelectionBar, {
    props: {
      sourceTenantName: 'DEV',
      artifacts,
      targetTenants,
      selectedArtifactId: 'Invoice_Processing',
      selectedTargetTenantId: 30,
      ...props,
    },
  })
}

describe('CodeCompareSelectionBar', () => {
  it('renders the fixed source, artifact, arrow, and target in one ordered row', () => {
    const wrapper = mountBar()
    const fields = wrapper.findAll('[data-testid^="compare-field-"]')

    expect(fields.map(field => field.attributes('data-testid'))).toEqual([
      'compare-field-source',
      'compare-field-artifact',
      'compare-field-target',
    ])
    const sourceInput = wrapper.get('[data-testid="source-tenant"]')
    expect((sourceInput.element as HTMLInputElement).value).toBe('DEV')
    expect((sourceInput.element as HTMLInputElement & { readonly: boolean }).readonly)
      .toBe(true)
    expect(wrapper.findAll('ui5-select')).toHaveLength(2)
    expect(fields[0].find('ui5-select').exists()).toBe(false)
    expect((
      wrapper.get('[data-testid="compare-direction"]').element as HTMLElement & {
        name: string
      }
    ).name).toBe('arrow-right')
  })

  it('shows artifact identity and preserves the controlled selections', () => {
    const wrapper = mountBar()
    const options = wrapper.findAll('ui5-option')

    expect(options.map(option => option.text())).toEqual([
      'Order Processing (v1.4.2)',
      'Invoice_Processing (v2.0.0)',
      'TEST',
      'PROD',
    ])
    expect((options[1].element as HTMLOptionElement).selected).toBe(true)
    expect((options[3].element as HTMLOptionElement).selected).toBe(true)
  })

  it('emits only artifact and target changes', async () => {
    const wrapper = mountBar()
    const selects = wrapper.findAll('ui5-select')

    selects[0].element.dispatchEvent(new CustomEvent('change', {
      detail: { selectedOption: { value: 'Order_Processing' } },
    }))
    selects[1].element.dispatchEvent(new CustomEvent('change', {
      detail: { selectedOption: { value: '20' } },
    }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('artifact-change')).toEqual([['Order_Processing']])
    expect(wrapper.emitted('target-change')).toEqual([[20]])
    expect(wrapper.emitted()).not.toHaveProperty('source-change')
  })

  it('selects the first available values when parent selections are empty', () => {
    const wrapper = mountBar({
      selectedArtifactId: '',
      selectedTargetTenantId: 0,
    })
    const options = wrapper.findAll('ui5-option')

    expect((options[0].element as HTMLOptionElement).selected).toBe(true)
    expect((options[2].element as HTMLOptionElement).selected).toBe(true)
  })
})
