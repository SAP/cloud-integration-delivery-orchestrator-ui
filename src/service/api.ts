import axios from 'axios'
import http from './http'
import type { ApiEndpoint, Artifact, ArtifactTenantOperation, ArtifactVersionHistoryItem, CpiTenant, CpiTenantNodeData, DeliverOpRequest, DeliveryRequest, DeliveryRule, NodeTransportRequest, Package, RuntimeArtifact, TransportGroup, TransportNode, TransportRoute, UserInfo } from './model'
import type { AggregateStatus, DeployState, ImportState, RequestState } from './statuses'

export const GetDrCounts = () => {
  const drCounts = http.get('/api/v1/deliveryRequest/counts') as Promise<{ [key: string]: number }[]>
  return drCounts
}

let currentUser: UserInfo | null = null
export const CurrentUser = async () => {
  if (currentUser) return currentUser
  const { data } = await axios.get('/user-api/currentUser')  
  return currentUser = data
}

export const GetCPIApiEndpoints = () => {
  return http.get('/api/v1/destinations') as Promise<ApiEndpoint[]>
}

export const GetTransportNodes = () => {
  return http.get('/api/v1/tms/nodes') as Promise<TransportNode[]>
}
export const GetTransportRequests = (node_id: number | string) => {
  return http.get('/api/v1/tms/trs', {
    params: { transportNode: node_id }
  }) as Promise<NodeTransportRequest[]>
}

export const GetTransportRoutes = () => {
  return http.get('/api/v1/tms/routes') as Promise<TransportRoute[]>
}


export const GetPackages = (tenantId: number | string) => {
  return http.get('/api/v1/tanant/packages', {
    params: { tenant: tenantId }
  }) as Promise<Package[]>
}

export const GetPackageArtifacts = (tenantId: string, packageId: string) => {
  return http.get('/api/v1/tenant/packages/artifacts', {
    params: { tenant: tenantId, package: packageId }
  }) as Promise<Artifact[]>
}

export const GetRuntimeArtifacts = (tenantId: string) => {
  return http.get('/api/v1/tenant/runtime', {
    params: { tenant: tenantId }
  }) as Promise<RuntimeArtifact[]>
}

export const GetCpiTenants = () => {
  return http.get('/api/v1/cpiTenant') as Promise<CpiTenant[]>
}

export const GetCpiTenant = (id: number) => {
  return http.get(`/api/v1/cpiTenant/${id}`) as Promise<CpiTenant>
}


export const UpsertCpiTenant = (tenant: CpiTenant) => {
  // if backend treats ID=0 (or absence) as create
  return http.post('/api/v1/cpiTenant', tenant) as Promise<CpiTenant>
}

export const DeleteCpiTenant = (id: number) => {
  return http.delete(`/api/v1/cpiTenant/${id}`)
}

export const GetDeliveryRules = () => {
  return http.get('/api/v1/deliveryRule') as Promise<DeliveryRule[]>
}
export const GetDeliveryRule = (id: number) => {
  return http.get(`/api/v1/deliveryRule/${id}`) as Promise<DeliveryRule>
}
export const UpsertDeliveryRule = (rule: DeliveryRule) => {
  // will create a new rule if ID is 0
  return http.post('/api/v1/deliveryRule', rule) as Promise<DeliveryRule>
}

export const DeleteDeliveryRule = (id: number) => {
  return http.delete(`/api/v1/deliveryRule/${id}`)
}


// DeliveryRequest CRUD
export const GetDeliveryRequests = () => {
  return http.get('/api/v1/deliveryRequest') as Promise<DeliveryRequest[]>
}

export const GetDeliveryRequest = (id: Number) => {
  return http.get(`/api/v1/deliveryRequest/${id}`) as Promise<DeliveryRequest>
}

export const CreateDeliveryRequest = (req: DeliveryRequest) => {
  return http.post('/api/v1/deliveryRequest', req) as Promise<DeliveryRequest>
}

export const UpdateDeliveryRequest = (req: DeliveryRequest) => {
  return http.put(`/api/v1/deliveryRequest`, req) as Promise<DeliveryRequest>
}

export const DeleteDeliveryRequest = (id: number) => {
  return http.delete(`/api/v1/deliveryRequest/${id}`)
}

// Placeholder endpoints for artifact import / deploy operations.
// Adjust paths & payloads once backend contract is finalized.
export const ImportArtifactsToNode = (
  deliveryRequestId: number,
  nodeId: number,
  artifacts: { id: string; version: string }[]
) => {
  return http.post(`/api/v1/deliveryRequest/${deliveryRequestId}/import`, {
    nodeId,
    artifacts
  })
}

export const DeployArtifactsToNode = (
  deliveryRequestId: number,
  nodeId: number,
  artifacts: { id: string; version: string }[]
) => {
  return http.post(`/api/v1/deliveryRequest/${deliveryRequestId}/deploy`, {
    nodeId,
    artifacts
  })
}

export const CheckArtifactNodeStatus = (artifacts: Artifact[]) => {
  return http.post('/api/v1/tms/artifactStatus', { artifacts }) as Promise<Artifact[]>;
}

export const CheckTenantStatus = async (cpi_tenant: string) => {
  const {data} = await axios.get(
    '/cpi-cookie-service/api/check_tenant_status',
    {
      params: {
        cpi_tenant: cpi_tenant,
      },
      timeout: 8*1000
    }
  )
  return data
}

// NOTE: cpi cookie service
export const InitCpiTenant = async (cpi_tenant: string) => {
  const {data} = await axios.post(
    '/cpi-cookie-service/api/init_tenant',
    {
      cpi_tenant: cpi_tenant
    },
    { timeout: 60 * 1000 }
  )
  return data
}

export const GenTransportRequest = async (
  cpi_tenant_url: string,
  target_package_tech_name: string,
  target_artifact_id: string,
  comment: string
) => {
  const { data } = await axios.post(
    '/cpi-cookie-service/api/transport_request',
    {
      target_package_tech_name,
      target_artifact_name: target_artifact_id, // actually is artifact id, but in cpi native API context it's 'Name'
      cpi_tenant: cpi_tenant_url,
      comment
    },
    { timeout: 60 * 1000 }
  )
  return data
}

// version history
export const GetArtifactVersionHistory = async (
  cpiTenant: string,
  targetPackageTechName: string,
  targetArtifactName: string
): Promise<ArtifactVersionHistoryItem[]> => {
  const { data } = await axios.get<ArtifactVersionHistoryItem[]>(
    '/cpi-cookie-service/api/version_history',
    {
      params: {
        cpi_tenant: cpiTenant,
        target_package_tech_name: targetPackageTechName,
        target_artifact_name: targetArtifactName
      },
      timeout: 8*1000
    }
  )
  return data
}

export const ImportOps = (opIDs: number[], tenant: number, drID: number) => {
  const req: DeliverOpRequest ={
    opIDs: opIDs,
    targetTenant: tenant,
    deliveryRequestID: drID
  }
  return http.post(`/api/v1/deliveryRequest/import`, req)
}

export const DeployOps = (opIDs: number[], tenant: number, drID: number) => {
  const req: DeliverOpRequest ={
    opIDs: opIDs,
    targetTenant: tenant,
    deliveryRequestID: drID
  }
  return http.post(`/api/v1/deliveryRequest/deploy`, req)
}

// batch delete, avoid to use delete method, since there is no body support in delete method
export const DeleteOps = (opIDs: number[]) => {
  if (opIDs.length === 0) return
  return http.post(`/api/v1/deliveryRequest/deleteOps`, {opIDs: opIDs})
}

export const InsertOps = (drID: number, ops: ArtifactTenantOperation[]): Promise<ArtifactTenantOperation[]> => {
  if (ops.length === 0) return Promise.resolve([])
  return http.post(`/api/v1/deliveryRequest/insertOps`, {ops: ops, deliveryRequestID: drID})
}
export const UpdateOps = (drID: number, ops: ArtifactTenantOperation[]): Promise<ArtifactTenantOperation[]> => {
  if (ops.length === 0) return Promise.resolve([])
  return http.put(`/api/v1/deliveryRequest/updateOps`, {ops: ops, deliveryRequestID: drID})
}
export const SyncStatus = (drID: number) => {
  return http.post(`/api/v1/deliveryRequest/syncState/${drID}`)
}
// UAA user search by email
export const UaaEmailSearch = (query: string) => {
  return http.get(`/api/v1/uaa/search/${query}`) as Promise<UserInfo[]>
}

export const UaaUserInfo = (userId: string) => {
  return http.get(`/api/v1/uaa/id/${userId}`) as Promise<UserInfo>
}

export const CheckTrExistence = (op: ArtifactTenantOperation, deliveryRequestID: number) => {
  return http.post(`/api/v1/deliveryRequest/checkTr`, {op: op, deliveryRequestID: deliveryRequestID}) as Promise<{[key: string]: boolean}>
}
// approve delivery request
export const RequestApprove = (drID: number, approvers: string[], comment: string|'') => {
  return http.post(`/api/v1/deliveryRequest/requestApproval`, 
    {approvers: approvers, deliveryRequestID: drID, comment: comment})
}

export const Approve = (drID: number, comment: string | []): Promise<DeliveryRequest> => {
  return http.post('/api/v1/deliveryRequest/approve', 
    {deliveryRequestID: drID, comment: comment})
}

// Cpi tenant operations mapping
export const TenantOps = (ops: ArtifactTenantOperation[]) => {
  const tenantToOps: {[key: number] : {[key: string]: ArtifactTenantOperation}} = {}  // cpi tenant ID - map[trNumber]ArtifactTenantOperation
  ops.forEach(op => {
    const tenantId = op.Tenant!.ID
    tenantToOps[tenantId] = tenantToOps[tenantId] || {}
    const trNumber = (op.TransportRequestNumber ?? 0) as string
    tenantToOps[tenantId][trNumber] = op
  })

  return tenantToOps
}

export const DeriveArtifactOpAgg = (op: ArtifactTenantOperation) => {
  if (op.DeployState !== 'NOT_STARTED') return op.DeployState
  if (op.ImportState !== 'NOT_STARTED') return op.ImportState
  if (op.RequestState !== 'NOT_REQUESTED') return op.RequestState
  return 'NOT_REQUESTED'
}

// derive aggregate status of a cpi tenant based on its artifact operations
export const DeriveNodeAgg = (ops: ArtifactTenantOperation[]): AggregateStatus => {
  if (ops.length === 0) return 'UNKNOWN'

  // Collect state sets
  const requestStates = ops.map(op => op.RequestState).filter(Boolean) as RequestState[]
  const importStates = ops.map(op => op.ImportState).filter(Boolean) as ImportState[]
  const deployStates = ops.map(op => op.DeployState).filter(Boolean) as DeployState[]

  const any = <T>(arr: T[], v: T[]) => arr.some(s => v.includes(s))
  const all = <T>(arr: T[], v: T[]) => arr.length > 0 && arr.every(s => v.includes(s))

  // 1. Request phase error overrides others
  if (any(requestStates, ['FAILED'])) return 'Error'

  // 2. Import failures / progress / completion (import failure has higher priority than deploy failure)
  if (any(importStates, ['FAILED'])) return 'IMPORT_FAILED'
  if (any(importStates, ['IN_PROGRESS'])) return 'IMPORTING'
  if (any(importStates, ['QUEUED'])) return 'AWAITING_IMPORT'

  // 3. Deployment failures / progress / completion
  if (any(deployStates, ['FAILED'])) return 'DEPLOY_FAILED'
  if (all(deployStates, ['COMPLETE'])) return 'DEPLOYED'
  if (any(deployStates, ['IN_PROGRESS'])) return 'DEPLOYING'
  if (all(deployStates, ['QUEUED'])) return 'AWAITING_DEPLOY'

  // 4. Import completed, but deploy not started yet
  if (all(importStates, ['COMPLETE']) && all(deployStates, ['NOT_STARTED'])) {
    return 'AWAITING_DEPLOY'
  }
  // 5. Import completed with mixed deploy states (QUEUED mixed with other states)
  if (all(importStates, ['COMPLETE']) && deployStates.length > 0) {
    return 'IMPORTED'
  }

  // 6. Awaiting import / pending transport request readiness
  const allRequestsReady = requestStates.length > 0 && all(requestStates, ['READY'])
  if (allRequestsReady) return 'AWAITING_IMPORT'
  if (any(requestStates, ['REQUESTING', 'NOT_REQUESTED'])) return 'PENDING'

  return 'UNKNOWN'
}

// Aggregate multiple tenant states into a single group state
// This is used to calculate the overall status of a delivery group with multiple tenants
// Priority: Failed/InProgress states > Normal states (earliest stage)
export const DeriveGroupAgg = (tenantStates: AggregateStatus[]): AggregateStatus => {
  if (tenantStates.length === 0) return 'UNKNOWN'

  // Define priority order: states earlier in array have higher priority
  // Error states have highest priority, then in-progress, then earliest stage
  const order: AggregateStatus[] = [
    'Error',              // Highest priority - critical error
    'DEPLOY_FAILED',      // Deployment failure
    'IMPORT_FAILED',      // Import failure
    'CANCELED',           // Canceled operation
    'PENDING',            // Earliest stage - pending
    'WAITING_APPROVAL',   // Waiting for approval
    'AWAITING_IMPORT',    // Waiting to import
    'AWAITING_DEPLOY',    // Waiting to deploy
    'DEPLOYING',          // In progress - deployment
    'IMPORTING',          // In progress - import
    'IMPORTED',           // Imported, ready for deploy
    'DEPLOYED',           // Successfully deployed
    'UNKNOWN',            // Lowest priority
  ]
  const rank = (s: AggregateStatus) => order.indexOf(s)

  // Reduce by taking the state with higher priority (lower index = higher priority)
  const overall = tenantStates.reduce((acc, cur) => {
    const accRank = rank(acc)
    const curRank = rank(cur)
    return curRank < accRank ? cur : acc
  })

  return overall
}

import dagre from '@dagrejs/dagre'
import {type Edge, type Node } from '@vue-flow/core'


export function layoutNodes(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB' = 'LR'): {nodes: Node[], edges: Edge[], height: number, width: number} {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((node) => {g.setNode(node.id, { width: Number(node?.width ?? 0), height: Number(node?.height ?? 0) })})

  edges.forEach((edge) => {g.setEdge(edge.source, edge.target)})

  dagre.layout(g)
  return {
    nodes: nodes.map(n => ({
      ...n,
      position: { x: g.node(n.id).x, y: g.node(n.id).y }
    })),
    edges: edges,
    height: g.graph().height ?? 0,
    width: g.graph().width ?? 0,
  }
}
