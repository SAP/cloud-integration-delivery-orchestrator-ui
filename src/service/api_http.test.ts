import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArtifactTenantOperation } from './model'

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  httpGet: vi.fn(),
  httpPost: vi.fn(),
  httpPut: vi.fn(),
  httpDelete: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    get: mocks.axiosGet,
  },
}))

vi.mock('./http', () => ({
  default: {
    get: mocks.httpGet,
    post: mocks.httpPost,
    put: mocks.httpPut,
    delete: mocks.httpDelete,
  },
}))

const loadApi = async () => import('./api')

const makeOp = (overrides: Partial<ArtifactTenantOperation> = {}): ArtifactTenantOperation =>
  ({
    ID: 1,
    DeliveryRequestID: 1,
    ArtifactID: 1,
    Artifact: {} as ArtifactTenantOperation['Artifact'],
    ArtifactTechID: 'artifact-tech-id',
    ArtifactVersion: '1.0.0',
    ArtifactName: 'Artifact',
    ArtifactType: '' as ArtifactTenantOperation['ArtifactType'],
    PackageID: 'pkg-1',
    PackageName: 'Package',
    PackageVersion: '1.0.0',
    TenantID: 1,
    Tenant: { ID: 1 } as ArtifactTenantOperation['Tenant'],
    TransportRequestNumber: 'TR-001',
    RequestState: 'NOT_REQUESTED',
    ImportState: 'NOT_STARTED',
    DeployState: 'NOT_STARTED',
    SkipDeploy: false,
    CreatedAt: '2024-01-01T00:00:00Z',
    UpdatedAt: '2024-01-01T00:00:00Z',
    LastError: '',
    RetryCountImport: 0,
    RetryCountDeploy: 0,
    Conditions: '',
    ...overrides,
  }) as ArtifactTenantOperation

beforeEach(() => {
  vi.resetModules()
  mocks.axiosGet.mockReset()
  mocks.httpGet.mockReset()
  mocks.httpPost.mockReset()
  mocks.httpPut.mockReset()
  mocks.httpDelete.mockReset()
})

describe('api service helpers', () => {
  it('caches CurrentUser after the first request', async () => {
    const user = { name: 'Test User', email: 'test@example.com' }
    mocks.axiosGet.mockResolvedValue({ data: user })

    const { CurrentUser } = await loadApi()

    await expect(CurrentUser()).resolves.toEqual(user)
    await expect(CurrentUser()).resolves.toEqual(user)

    expect(mocks.axiosGet).toHaveBeenCalledTimes(1)
    expect(mocks.axiosGet).toHaveBeenCalledWith('/user-api/currentUser')
  })

  it('skips DeleteOps when there are no operation IDs', async () => {
    const { DeleteOps } = await loadApi()

    expect(DeleteOps(42, [])).toBeUndefined()
    expect(mocks.httpPost).not.toHaveBeenCalled()
  })

  it('returns an empty array from InsertOps without calling the backend', async () => {
    const { InsertOps } = await loadApi()

    await expect(InsertOps(42, [])).resolves.toEqual([])
    expect(mocks.httpPost).not.toHaveBeenCalled()
  })

  it('maps UpdateOps payload down to editable fields only', async () => {
    const op = makeOp({
      ID: 99,
      TransportRequestNumber: 'TR-099',
      SkipDeploy: true,
      ArtifactTechID: 'should-not-be-sent',
    })
    mocks.httpPut.mockResolvedValue([op])

    const { UpdateOps } = await loadApi()

    await UpdateOps(7, [op])

    expect(mocks.httpPut).toHaveBeenCalledWith('/api/v1/deliveryRequest/updateOps', {
      ops: [
        {
          ID: 99,
          TransportRequestNumber: 'TR-099',
          SkipDeploy: true,
        },
      ],
      deliveryRequestID: 7,
    })
  })

  it('serializes QueryVersionCompare boolean params for the backend contract', async () => {
    mocks.httpGet.mockResolvedValue({ items: [] })
    const { QueryVersionCompare } = await loadApi()

    await QueryVersionCompare(12, {
      packageIDs: 'pkg-1,pkg-2',
      designTime: false,
      runTime: true,
      mismatchOnly: false,
    })

    expect(mocks.httpGet).toHaveBeenCalledWith('/api/v1/deliveryRule/12/versionCompare', {
      params: {
        packageIDs: 'pkg-1,pkg-2',
        designTime: 'false',
        runTime: 'true',
        mismatchOnly: undefined,
      },
    })
  })

  it('passes silentError when creating a delivery request from mismatches', async () => {
    const req = { artifactKeys: [], snapshotID: 3, snapshotCompletedAt: '2024-01-01T00:00:00Z' }
    mocks.httpPost.mockResolvedValue({ deliveryRequest: null })

    const { CreateDRFromMismatch } = await loadApi()

    await CreateDRFromMismatch(5, req as never)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/api/v1/deliveryRule/5/versionCompare/createDR',
      req,
      { silentError: true },
    )
  })

  it('only includes requested BackfillTechIDs params', async () => {
    mocks.httpPost.mockResolvedValue({ updated: 0 })
    const { BackfillTechIDs } = await loadApi()

    await BackfillTechIDs(true, 88)

    expect(mocks.httpPost).toHaveBeenCalledWith('/api/v1/system/backfill-tech-id', null, {
      params: {
        dryRun: 'true',
        tenant: 88,
      },
    })
  })

  it('groups TenantOps by tenant ID and transport request number', async () => {
    const { TenantOps } = await loadApi()
    const opA = makeOp({ ID: 1, Tenant: { ID: 10 } as ArtifactTenantOperation['Tenant'], TransportRequestNumber: 'TR-10' })
    const opB = makeOp({ ID: 2, Tenant: { ID: 10 } as ArtifactTenantOperation['Tenant'], TransportRequestNumber: null as never })
    const opC = makeOp({ ID: 3, Tenant: { ID: 20 } as ArtifactTenantOperation['Tenant'], TransportRequestNumber: 'TR-20' })

    expect(TenantOps([opA, opB, opC])).toEqual({
      10: {
        '0': opB,
        'TR-10': opA,
      },
      20: {
        'TR-20': opC,
      },
    })
  })

  it('prefers deploy, then import, then request state in DeriveArtifactOpAgg', async () => {
    const { DeriveArtifactOpAgg } = await loadApi()

    expect(DeriveArtifactOpAgg(makeOp({ RequestState: 'READY', ImportState: 'COMPLETE', DeployState: 'FAILED' }))).toBe('FAILED')
    expect(DeriveArtifactOpAgg(makeOp({ RequestState: 'READY', ImportState: 'QUEUED', DeployState: 'NOT_STARTED' }))).toBe('QUEUED')
    expect(DeriveArtifactOpAgg(makeOp({ RequestState: 'REQUESTING', ImportState: 'NOT_STARTED', DeployState: 'NOT_STARTED' }))).toBe('REQUESTING')
  })
})
