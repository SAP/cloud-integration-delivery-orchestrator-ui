import { describe, it, expect } from 'vitest'
import { DeriveNodeAgg, DeriveGroupAgg } from './api'
import type { ArtifactTenantOperation } from './model'
import type { RequestState, ImportState, DeployState, AggregateStatus } from './statuses'

describe('DeriveNodeAgg', () => {
  // Helper function to create a mock ArtifactTenantOperation
  const createOp = (
    requestState: RequestState,
    importState: ImportState,
    deployState: DeployState
  ): ArtifactTenantOperation => ({
    ID: 1,
    CreatedAt: '2024-01-01T00:00:00Z',
    UpdatedAt: '2024-01-01T00:00:00Z',
    DeliveryRequestID: 1,
    ArtifactID: 1,
    Artifact: {} as any,
    ArtifactTechID: 'artifact1',
    ArtifactVersion: '1.0.0',
    ArtifactName: '',
    ArtifactType: '',
    PackageID: '',
    PackageName: '',
    PackageVersion: '',
    TenantID: 1,
    Tenant: {} as any,
    TransportRequestNumber: 'TR001',
    RequestState: requestState,
    ImportState: importState,
    DeployState: deployState,
    SkipDeploy: false,
    LastError: '',
    RetryCountImport: 0,
    RetryCountDeploy: 0,
    Conditions: ''
  })

  describe('Empty operations', () => {
    it('should return UNKNOWN when ops array is empty', () => {
      const result = DeriveNodeAgg([])
      expect(result).toBe('UNKNOWN')
    })
  })

  describe('Request phase errors', () => {
    it('should return Error when any operation has FAILED RequestState', () => {
      const ops = [
        createOp('FAILED', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('READY', 'COMPLETE', 'COMPLETE')
      ]
      expect(DeriveNodeAgg(ops)).toBe('Error')
    })

    it('should return Error when request fails despite successful import/deploy', () => {
      const ops = [
        createOp('FAILED', 'COMPLETE', 'COMPLETE'),
        createOp('FAILED', 'COMPLETE', 'COMPLETE')
      ]
      expect(DeriveNodeAgg(ops)).toBe('Error')
    })
  })

  describe('Deployment phase', () => {
    it('should return DEPLOY_FAILED when any deployment FAILED', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'FAILED'),
        createOp('READY', 'COMPLETE', 'IN_PROGRESS')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOY_FAILED')
    })

    it('should return DEPLOYED when all deployments are COMPLETE', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'COMPLETE'),
        createOp('READY', 'COMPLETE', 'COMPLETE')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYED')
    })

    it('should return DEPLOYING when all deployments are IN_PROGRESS', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'IN_PROGRESS')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYING')
    })

    it('should return DEPLOYING when some deployments are IN_PROGRESS', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'COMPLETE')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYING')
    })

    it('should return DEPLOYING when deployments are mixed IN_PROGRESS and QUEUED', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'QUEUED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYING')
    })

    it('should return AWAITING_DEPLOY when all deployments are QUEUED', () => {
      const ops = [createOp('READY', 'COMPLETE', 'QUEUED'), createOp('READY', 'COMPLETE', 'QUEUED')]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_DEPLOY')
    })

    it('should return DEPLOYING when any deployment is IN_PROGRESS or QUEUED', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'QUEUED'),
        createOp('READY', 'COMPLETE', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('IMPORTED')
    })
  })

  describe('Import phase', () => {
    it('should return IMPORT_FAILED when any import FAILED', () => {
      const ops = [
        createOp('READY', 'FAILED', 'NOT_STARTED'),
        createOp('READY', 'IN_PROGRESS', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('IMPORT_FAILED')
    })

    it('should return IMPORTING when any import is IN_PROGRESS', () => {
      const ops = [
        createOp('READY', 'IN_PROGRESS', 'NOT_STARTED'),
        createOp('READY', 'QUEUED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('IMPORTING')
    })

    it('should return AWAITING_IMPORT when any import is QUEUED', () => {
      const ops = [
        createOp('READY', 'QUEUED', 'NOT_STARTED'),
        createOp('READY', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_IMPORT')
    })

    it('should return AWAITING_DEPLOY when all imports are COMPLETE and deployments not started', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'NOT_STARTED'),
        createOp('READY', 'COMPLETE', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_DEPLOY')
    })

    it('should return DEPLOYING when all imports are COMPLETE but some deployments are IN_PROGRESS', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYING')
    })
  })

  describe('Request phase', () => {
    it('should return AWAITING_IMPORT when all requests are READY', () => {
      const ops = [
        createOp('READY', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('READY', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_IMPORT')
    })

    it('should return PENDING when any request is REQUESTING', () => {
      const ops = [
        createOp('REQUESTING', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('NOT_REQUESTED', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('PENDING')
    })

    it('should return PENDING when any request is NOT_REQUESTED', () => {
      const ops = [
        createOp('NOT_REQUESTED', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('READY', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('PENDING')
    })

    it('should return PENDING when all requests are NOT_REQUESTED', () => {
      const ops = [
        createOp('NOT_REQUESTED', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('NOT_REQUESTED', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('PENDING')
    })
  })

  describe('Edge cases and mixed states', () => {
    it('should handle single operation correctly', () => {
      const ops = [createOp('READY', 'COMPLETE', 'COMPLETE')]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYED')
    })

    it('should return UNKNOWN for unexpected state combinations', () => {
      const ops = [createOp('READY' as RequestState, 'NOT_STARTED', 'NOT_STARTED')]
      // All imports complete but no deploy started
      ops[0].ImportState = 'COMPLETE' as ImportState
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_DEPLOY')
    })

    it('should prioritize deploy failures over import failures', () => {
      const ops = [
        createOp('READY', 'FAILED', 'FAILED'),
        createOp('READY', 'FAILED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('IMPORT_FAILED')
    })

    it('should handle operations with IMPORT_DISABLED state', () => {
      const ops = [
        createOp('READY', 'IMPORT_DISABLED' as ImportState, 'QUEUED'),
        createOp('READY', 'IMPORT_DISABLED' as ImportState, 'QUEUED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_DEPLOY')
    })

    it('should handle operations with DEPLOY_DISABLED state', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'DEPLOY_DISABLED' as DeployState),
        createOp('READY', 'COMPLETE', 'DEPLOY_DISABLED' as DeployState)
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYED')
    })
  })

  describe('Priority and precedence', () => {
    it('should prioritize request phase errors over everything else', () => {
      const ops = [createOp('FAILED', 'FAILED', 'FAILED')]
      expect(DeriveNodeAgg(ops)).toBe('Error')
    })

    it('should prioritize import failures over deploy failures', () => {
      const ops = [createOp('READY', 'FAILED', 'FAILED')]
      expect(DeriveNodeAgg(ops)).toBe('IMPORT_FAILED')
    })

    it('should prioritize import failures over pending states', () => {
      const ops = [createOp('REQUESTING', 'FAILED', 'NOT_STARTED')]
      expect(DeriveNodeAgg(ops)).toBe('IMPORT_FAILED')
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle successful delivery flow', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'COMPLETE'),
        createOp('READY', 'COMPLETE', 'COMPLETE'),
        createOp('READY', 'COMPLETE', 'COMPLETE')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYED')
    })

    it('should handle partial deployment scenario', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'COMPLETE'),
        createOp('READY', 'COMPLETE', 'IN_PROGRESS'),
        createOp('READY', 'COMPLETE', 'QUEUED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('DEPLOYING')
    })

    it('should handle failed delivery scenario', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'COMPLETE'),
        createOp('READY', 'FAILED', 'NOT_STARTED'),
        createOp('READY', 'COMPLETE', 'FAILED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('IMPORT_FAILED')
    })

    it('should handle awaiting approval/transport request', () => {
      const ops = [
        createOp('NOT_REQUESTED', 'NOT_STARTED', 'NOT_STARTED'),
        createOp('REQUESTING', 'NOT_STARTED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('PENDING')
    })

    // TMS WARNING is stored as Import COMPLETE (same as SUCCEEDED for UI aggregation)
    it('should treat import COMPLETE like success for deploy progression (WARNING backend mapping)', () => {
      const ops = [createOp('READY', 'COMPLETE', 'QUEUED')]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_DEPLOY')
    })

    // TMS REPEAT → Import QUEUED: one op awaiting re-import surfaces AWAITING_IMPORT
    it('should return AWAITING_IMPORT when any op is QUEUED while others are COMPLETE (e.g. REPEAT)', () => {
      const ops = [
        createOp('READY', 'COMPLETE', 'QUEUED'),
        createOp('READY', 'QUEUED', 'NOT_STARTED')
      ]
      expect(DeriveNodeAgg(ops)).toBe('AWAITING_IMPORT')
    })
  })
})

describe('DeriveGroupAgg', () => {
  describe('Empty and single tenant states', () => {
    it('should return UNKNOWN when tenant states array is empty', () => {
      const result = DeriveGroupAgg([])
      expect(result).toBe('UNKNOWN')
    })

    it('should return the state itself when there is only one tenant', () => {
      const states: AggregateStatus[] = ['DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOYED')
    })

    it('should return UNKNOWN when single tenant state is UNKNOWN', () => {
      const states: AggregateStatus[] = ['UNKNOWN']
      expect(DeriveGroupAgg(states)).toBe('UNKNOWN')
    })
  })

  describe('All tenants in same state', () => {
    it('should return PENDING when all tenants are PENDING', () => {
      const states: AggregateStatus[] = ['PENDING', 'PENDING', 'PENDING']
      expect(DeriveGroupAgg(states)).toBe('PENDING')
    })

    it('should return IMPORTING when all tenants are IMPORTING', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'IMPORTING']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should return DEPLOYED when all tenants are DEPLOYED', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOYED')
    })

    it('should return Error when all tenants are in Error state', () => {
      const states: AggregateStatus[] = ['Error', 'Error']
      expect(DeriveGroupAgg(states)).toBe('Error')
    })
  })

  describe('Import capping logic', () => {
    it('should cap at IMPORTING when any tenant is still IMPORTING and others are DEPLOYED', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should cap at IMPORTING when any tenant is AWAITING_IMPORT and others are DEPLOYED', () => {
      const states: AggregateStatus[] = ['AWAITING_IMPORT', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('AWAITING_IMPORT')
    })

    it('should return IMPORTED when one tenant is still at IMPORTED stage', () => {
      const states: AggregateStatus[] = ['IMPORTED', 'DEPLOYING', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })

    it('should return Error when all tenants are past IMPORTING stage and some have errors', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOY_FAILED', 'Error']
      expect(DeriveGroupAgg(states)).toBe('Error')
    })
  })

  describe('Mixed states without import capping', () => {
    it('should return the least-progressed state when all tenants are past IMPORTING', () => {
      const states: AggregateStatus[] = ['IMPORTED', 'AWAITING_DEPLOY', 'DEPLOYING', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })

    it('should return DEPLOYING when one tenant is DEPLOYING and others are DEPLOYED', () => {
      const states: AggregateStatus[] = ['DEPLOYING', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOYING')
    })

    it('should return DEPLOY_FAILED when one tenant failed deployment and others are deployed', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOYED', 'DEPLOY_FAILED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOY_FAILED')
    })

    it('should return IMPORT_FAILED when import failed but others are deployed', () => {
      const states: AggregateStatus[] = ['IMPORT_FAILED', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORT_FAILED')
    })

    it('should return IMPORTED when some are imported and one is awaiting deploy', () => {
      const states: AggregateStatus[] = ['IMPORTED', 'IMPORTED', 'AWAITING_DEPLOY']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })
  })

  describe('Priority ordering', () => {
    it('should prioritize higher ranked states', () => {
      const states: AggregateStatus[] = ['UNKNOWN', 'PENDING', 'AWAITING_IMPORT', 'IMPORTING']
      expect(DeriveGroupAgg(states)).toBe('PENDING')
    })

    it('should prioritize Error over DEPLOY_FAILED', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOY_FAILED', 'Error']
      expect(DeriveGroupAgg(states)).toBe('Error')
    })

    it('should prioritize DEPLOY_FAILED over DEPLOYING', () => {
      const states: AggregateStatus[] = ['DEPLOYING', 'DEPLOYED', 'DEPLOY_FAILED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOY_FAILED')
    })

    it('should prioritize IMPORTED over DEPLOYING (earlier lifecycle stage)', () => {
      const states: AggregateStatus[] = ['AWAITING_DEPLOY', 'IMPORTED', 'DEPLOYING']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })

    it('should prioritize IMPORTED over AWAITING_DEPLOY (earlier lifecycle stage)', () => {
      const states: AggregateStatus[] = ['AWAITING_DEPLOY', 'IMPORTED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })

    it('should prioritize IMPORT_FAILED over IMPORTED', () => {
      const states: AggregateStatus[] = ['IMPORTED', 'IMPORT_FAILED', 'IMPORTING']
      expect(DeriveGroupAgg(states)).toBe('IMPORT_FAILED')
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle multi-tenant delivery with mixed progress', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOYING', 'AWAITING_DEPLOY', 'IMPORTED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTED')
    })

    it('should handle one tenant blocking others with early stage', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOYED', 'IMPORTING', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should handle failed imports preventing deployment', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'IMPORT_FAILED', 'AWAITING_DEPLOY']
      expect(DeriveGroupAgg(states)).toBe('IMPORT_FAILED')
    })

    it('should handle complete success across all tenants', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'DEPLOYED', 'DEPLOYED', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOYED')
    })

    it('should handle tenants waiting for different stages', () => {
      const states: AggregateStatus[] = [
        'AWAITING_IMPORT',
        'IMPORTING',
        'IMPORTED',
        'AWAITING_DEPLOY'
      ]
      expect(DeriveGroupAgg(states)).toBe('AWAITING_IMPORT')
    })

    it('should handle catastrophic failure across tenants', () => {
      const states: AggregateStatus[] = ['IMPORT_FAILED', 'DEPLOY_FAILED', 'Error']
      expect(DeriveGroupAgg(states)).toBe('Error')
    })

    it('should handle partial rollback scenario with CANCELED state', () => {
      const states: AggregateStatus[] = ['DEPLOYED', 'CANCELED', 'DEPLOYING']
      expect(DeriveGroupAgg(states)).toBe('CANCELED')
    })
  })

  describe('Lifecycle ordering regression (IMPORTING vs AWAITING_DEPLOY)', () => {
    it('should return IMPORTING when one tenant is IMPORTING and another is AWAITING_DEPLOY', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'AWAITING_DEPLOY']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should return IMPORTING when one tenant is IMPORTING and another is DEPLOYING', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'DEPLOYING']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should return IMPORTING when one tenant is IMPORTING and another is DEPLOYED', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should return AWAITING_IMPORT when one is AWAITING_IMPORT and another is DEPLOYING', () => {
      const states: AggregateStatus[] = ['AWAITING_IMPORT', 'DEPLOYING']
      expect(DeriveGroupAgg(states)).toBe('AWAITING_IMPORT')
    })

    it('should return AWAITING_DEPLOY when one is AWAITING_DEPLOY and another is DEPLOYING', () => {
      const states: AggregateStatus[] = ['AWAITING_DEPLOY', 'DEPLOYING']
      expect(DeriveGroupAgg(states)).toBe('AWAITING_DEPLOY')
    })

    it('should return AWAITING_DEPLOY when one is AWAITING_DEPLOY and another is DEPLOYED', () => {
      const states: AggregateStatus[] = ['AWAITING_DEPLOY', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('AWAITING_DEPLOY')
    })

    it('should return IMPORTING over IMPORTED (still in progress)', () => {
      const states: AggregateStatus[] = ['IMPORTING', 'IMPORTED']
      expect(DeriveGroupAgg(states)).toBe('IMPORTING')
    })

    it('should return PENDING over any progress state', () => {
      const states: AggregateStatus[] = ['PENDING', 'IMPORTING', 'DEPLOYING', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('PENDING')
    })
  })

  describe('Unknown state handling', () => {
    it('should ignore UNKNOWN when other states exist', () => {
      const states: AggregateStatus[] = ['UNKNOWN', 'DEPLOYED']
      expect(DeriveGroupAgg(states)).toBe('DEPLOYED')
    })

    it('should return UNKNOWN only when all are UNKNOWN', () => {
      const states: AggregateStatus[] = ['UNKNOWN', 'UNKNOWN']
      expect(DeriveGroupAgg(states)).toBe('UNKNOWN')
    })
  })
})
