import axios from 'axios'
import http from './http'
import type { ApiEndpoint, Artifact, ArtifactTenantOperation, ArtifactVersionHistoryItem, CpiTenant, CpiTenantNodeData, DeliverOpRequest, DeliveryRequest, DeliveryRule, NodeTransportRequest, Package, RuntimeArtifact, TransportGroup, TransportNode, TransportRoute, UserInfo } from './model'
import type { AggregateStatus, DeployState, ImportState, RequestState } from './statuses'

export const CurrentUser = async () => {
  const { data } = await axios.get('/user-api/currentUser')
  return data
}

export const GetJobCounts = () => {
  return http.get('/api/v1/count') as Promise<{ [key: string]: number }[]>
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


// cpi cookie service
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
      }
    }
  )
  return data
}

export const ImportOps = (opIDs: number[], tenant: number) => {
  const req: DeliverOpRequest ={
    opIDs: opIDs,
    targetTenant: tenant
  }
  return http.post(`/api/v1/deliveryRequest/import`, req)
}

export const DeployOps = (opIDs: number[], tenant: number) => {
  const req: DeliverOpRequest ={
    opIDs: opIDs,
    targetTenant: tenant
  }
  return http.post(`/api/v1/deliveryRequest/deploy`, req)
}

// batch delete, avoid to use delete method, since there is no body support in delete method
export const DeleteOps = (opIDs: number[]) => {
  if (opIDs.length === 0) return
  return http.post(`/api/v1/deliveryRequest/deleteOps`, {opIDs: opIDs})
}

export const InsertOps = (drID: number, ops: ArtifactTenantOperation[]) => {
  if (ops.length === 0) return
  return http.post(`/api/v1/deliveryRequest/insertOps`, {ops: ops, deliveryRequestID: drID})
}
export const UpdateOp = (drID: number, ops: ArtifactTenantOperation[]) => {
  return http.put(`/api/v1/deliveryRequest/updateOps`, {ops: ops, deliveryRequestID: drID})
}
export const SyncStatus = (drID: number) => {
  return http.post(`/api/v1/deliveryRequest/syncState/${drID}`)
}

export const UaaUser = (query: string) => {
  return http.get(`/api/v1/uaa/search/${query}`) as Promise<UserInfo[]>
}

// approve delivery request
export const RequestApprove = (drID: number, approvers: string[], comment: string|'') => {
  return http.post(`/api/v1/deliveryRequest/requestApproval`, 
    {approvers: approvers, deliveryRequestID: drID, comment: comment})
}

export const Approve = (drID: number, comment: string | []) => {
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

export const DeriveNodeAgg = (nodedata: CpiTenantNodeData): AggregateStatus => {
  const ops = Object.values(nodedata.TrToOp || {})
  if (ops.length === 0) return 'UNKNOWN'

  // Collect state sets
  const requestStates = ops.map(op => op.RequestState).filter(Boolean) as RequestState[]
  const importStates = ops.map(op => op.ImportState).filter(Boolean) as ImportState[]
  const deployStates = ops.map(op => op.DeployState).filter(Boolean) as DeployState[]

  const any = <T>(arr: T[], v: T[]) => arr.some(s => v.includes(s))
  const all = <T>(arr: T[], v: T[]) => arr.length > 0 && arr.every(s => v.includes(s))

  // 1. Request phase error overrides others
  if (any(requestStates, ['FAILED'])) return 'Error'

  // 2. Rollback scenarios
  if (any(deployStates, ['ROLLBACKING'])) return 'ROLLBACKING'
  if (all(deployStates, ['ROLLED_BACK'])) return 'ROLLED_BACK'

  // 3. Deployment failures / progress / completion
  if (any(deployStates, ['FAILED'])) return 'DEPLOY_FAILED'
  if (all(deployStates, ['COMPLETE'])) return 'DEPLOYED'
  if (all(deployStates, ['IN_PROGRESS'])) return 'DEPLOYING'
  if (all(deployStates, ['QUEUED'])) return 'AWAITING_DEPLOY'
  if (any(deployStates, ['IN_PROGRESS', 'QUEUED'])) return 'DEPLOYING'

  // 4. Import failures / progress / completion leading to deploy waiting
  if (any(importStates, ['FAILED'])) return 'IMPORT_FAILED'
  if (all(importStates, ['COMPLETE'])) {
    // All imports done; if no deploy has started yet -> awaiting deploy
    if (all(deployStates, ['NOT_STARTED'])) return 'AWAITING_DEPLOY'
    return 'IMPORTED' // Fallback if mixed states not covered
  }
  if (any(importStates, ['IN_PROGRESS'])) return 'IMPORTING'
  if (any(importStates, ['QUEUED'])) return 'AWAITING_IMPORT'

  // 5. Awaiting import / pending transport request readiness
  const allRequestsReady = requestStates.length > 0 && all(requestStates, ['READY'])
  if (allRequestsReady) return 'AWAITING_IMPORT'
  if (any(requestStates, ['REQUESTING', 'NOT_REQUESTED'])) return 'PENDING'

  return 'UNKNOWN'
}

import dagre from '@dagrejs/dagre'
import {type Edge, type Node } from '@vue-flow/core'


export function layoutNodes(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB' = 'LR'): {nodes: Node[], edges: Edge[], height: number, width: number} {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((node) => {g.setNode(node.id, { width: 600, height: 100 })})

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
