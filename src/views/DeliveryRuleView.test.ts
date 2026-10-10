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
