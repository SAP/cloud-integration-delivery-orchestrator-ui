import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import DeliveryRuleView from './DeliveryRuleView.vue'
import { GetDeliveryRules, UpsertDeliveryRule, GetCpiTenants, GetTransportRoutes } from '@/service/api'

vi.mock('@/service/api', () => ({
  GetDeliveryRules: vi.fn(),
  UpsertDeliveryRule: vi.fn(),
  DeleteDeliveryRule: vi.fn(),
  GetCpiTenants: vi.fn(),
  GetTransportRoutes: vi.fn(),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ hasScope: () => true }),
}))

const mountView = async () => {
  const wrapper = shallowMount(DeliveryRuleView)
  await flushPromises()
  return wrapper
}

describe('DeliveryRuleView edit', () => {
  beforeEach(() => {
    vi.mocked(GetCpiTenants).mockResolvedValue([])
    vi.mocked(GetTransportRoutes).mockResolvedValue([])
  })

  it('opens the dialog with the latest values when the selected row is stale', async () => {
    // DataTable hands over the row object captured at selection time; after a
    // save the rules are reloaded, so that object no longer has the saved values.
    const staleRow = { ID: 3, Name: 'Version 2', VersionPattern: '2.1.*' } as any
    vi.mocked(GetDeliveryRules).mockResolvedValue([{ ...staleRow, VersionPattern: '2.2.*' }])
    const wrapper = await mountView()
    const vm = wrapper.vm as any

    vm.handleEdit([staleRow])

    expect(vm.selDeliveryRule.VersionPattern).toBe('2.2.*')
    expect(vm.showModal).toBe(true)
  })

  it('does not mutate the loaded rule while the dialog is edited', async () => {
    const loaded = { ID: 3, Name: 'Version 2', VersionPattern: '2.1.*' } as any
    vi.mocked(GetDeliveryRules).mockResolvedValue([loaded])
    const wrapper = await mountView()
    const vm = wrapper.vm as any

    vm.handleEdit([loaded])
    vm.selDeliveryRule.VersionPattern = '9.*'

    expect(vm.rules[0].VersionPattern).toBe('2.1.*')
  })

  it('warns and keeps the dialog closed when no rule is selected', async () => {
    vi.mocked(GetDeliveryRules).mockResolvedValue([])
    const warning = vi.fn()
    ;(window as any).$toast = { warning }
    const wrapper = await mountView()
    const vm = wrapper.vm as any

    vm.handleEdit([])

    expect(warning).toHaveBeenCalledWith('Please select a delivery rule')
    expect(vm.showModal).toBe(false)
  })
})

describe('DeliveryRuleView save', () => {
  beforeEach(() => {
    vi.mocked(GetDeliveryRules).mockResolvedValue([])
    vi.mocked(GetCpiTenants).mockResolvedValue([])
    vi.mocked(GetTransportRoutes).mockResolvedValue([])
    vi.mocked(UpsertDeliveryRule).mockReset()
  })

  it('clears saving before closing the dialog after a successful save', async () => {
    // The dialog blocks closing while saving is true (before-close handler),
    // so showModal must only turn false once saving has been cleared.
    const wrapper = await mountView()
    const vm = wrapper.vm as any
    vi.mocked(UpsertDeliveryRule).mockResolvedValue({} as any)
    vm.handleAdd()
    const savingWhenClosed: boolean[] = []
    vm.$watch('showModal', (open: boolean) => { if (!open) savingWhenClosed.push(vm.saving) }, { flush: 'sync' })

    await vm.onSave()

    expect(vm.showModal).toBe(false)
    expect(savingWhenClosed).toEqual([false])
  })

  it('keeps the dialog open and clears saving when the save fails', async () => {
    const wrapper = await mountView()
    const vm = wrapper.vm as any
    vi.mocked(UpsertDeliveryRule).mockRejectedValue(new Error('save failed'))
    vm.handleAdd()

    await expect(vm.onSave()).rejects.toThrow('save failed')

    expect(vm.showModal).toBe(true)
    expect(vm.saving).toBe(false)
  })

  it('prevents the dialog from closing while a save is in flight', async () => {
    const wrapper = await mountView()
    const vm = wrapper.vm as any
    const event = { preventDefault: vi.fn() }

    vm.saving = true
    vm.onBeforeClose(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)

    vm.saving = false
    vm.onBeforeClose(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
