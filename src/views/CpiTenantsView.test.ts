import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import CpiTenantsView from './CpiTenantsView.vue'
import { GetCpiTenants, UpsertCpiTenant, SaveCfIdentity, GetTransportNodes, GetCentralTmsContext } from '@/service/api'

vi.mock('@/service/api', () => ({
  DeleteCpiTenant: vi.fn(),
  GetCpiTenants: vi.fn(),
  UpsertCpiTenant: vi.fn(),
  SaveCfIdentity: vi.fn(),
  ListCfOrgs: vi.fn(),
  ListCfSpaces: vi.fn(),
  ExchangeCfPasscode: vi.fn(),
  PreviewBootstrap: vi.fn(),
  ApplyBootstrap: vi.fn(),
  GetBootstrapStatus: vi.fn(),
  RetryBootstrap: vi.fn(),
  ResetBootstrap: vi.fn(),
  RegisterTmsNode: vi.fn(),
  GetTmsNodeRoutes: vi.fn(),
  ConfirmTmsRoutes: vi.fn(),
  GetCentralTmsContext: vi.fn(),
  GetTransportNodes: vi.fn(),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ hasScope: () => true }),
}))

const nodes = [
  { id: 20, name: 'DEV_NODE' },
  { id: 22, name: 'QA_NODE' },
]

const mountView = async () => {
  const wrapper = shallowMount(CpiTenantsView)
  await flushPromises()
  return wrapper
}

describe('CpiTenantsView create wizard', () => {
  beforeEach(() => {
    vi.mocked(GetCpiTenants).mockReset()
    vi.mocked(GetCentralTmsContext).mockResolvedValue(null as any)
    vi.mocked(GetTransportNodes).mockReset().mockResolvedValue(nodes as any)
    vi.mocked(UpsertCpiTenant).mockResolvedValue({ ID: 't1' } as any)
    vi.mocked(SaveCfIdentity).mockResolvedValue({} as any)
  })

  it('loads TMS nodes when a new tenant moves to step 2', async () => {
    vi.mocked(GetCpiTenants).mockResolvedValue([])
    const wrapper = await mountView()
    const vm = wrapper.vm as any
    vm.handleAdd()
    vm.selectedCpiTenant.Name = 'new-tenant'
    vi.mocked(GetCpiTenants).mockResolvedValue([
      { ID: 't1', Name: 'new-tenant', LifecycleState: 'configured' },
    ] as any)

    await vm.onSaveCfIdentity()

    expect(vm.wizardStep).toBe(2)
    expect(GetTransportNodes).toHaveBeenCalledTimes(1)
    expect(vm.tmsNodes).toEqual(nodes)
  })

  it('does not load TMS nodes when saving the CF connection fails', async () => {
    vi.mocked(GetCpiTenants).mockResolvedValue([])
    vi.mocked(SaveCfIdentity).mockRejectedValue(new Error('bad token'))
    const wrapper = await mountView()
    const vm = wrapper.vm as any
    vm.handleAdd()

    await vm.onSaveCfIdentity()

    expect(vm.wizardStep).toBe(1)
    expect(vm.step1Error).toBe('bad token')
    expect(GetTransportNodes).not.toHaveBeenCalled()
  })
})
