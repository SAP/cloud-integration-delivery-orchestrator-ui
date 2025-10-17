import axios from 'axios'
import { clientId, clientSecret, tokenEndpoint, userInfoEndpoint } from './consts'
import http from './http'
import { defineStore } from 'pinia'
import type { ApiEndpoint, Artifact, ArtifactTenantOperation, ArtifactVersionHistoryItem, CpiTenant, CpiTenantNodeData, DeliverOpRequest, DeliveryRequest, DeliveryRule, Job, NodeTransportRequest, Package, RuntimeArtifact, Step, TransportGroup, TransportNode, TransportPlan, TransportRoute, UserInfo } from './model'
import type { AggregateStatus, DeployState, ImportState, RequestState } from './statuses'
// validate if a step can be modified
export const validate = (step: Step) => {
  if (
    step.Status === 'Running' ||
    step.Status === 'Success' ||
    step.Status === 'Error'
  ) {
    window.$message.warning(`Do not modify step with status ${step.Status}`)
    return false
  }
  return true
}
export const Login = (code: string, state: string, redirectUri: string) => {
  const instance = axios.create({headers: {'Accept': 'application/json'}})
  instance.defaults.headers['Content-Type'] = 'application/x-www-form-urlencoded'
  return instance.post(tokenEndpoint, {
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri
  }, {
    auth: {
      username: clientId,
      password: clientSecret
    }
  }).then((res) => {
    const token = res.data.access_token
    instance.defaults.headers['Authorization'] = `Bearer ${token}`
    return instance.get(userInfoEndpoint)
  }).then(res => {
    return res.data
  }).catch((err) => {
    window.$message.error(`Login failed: ${err.response}`)
  })
}

// returns Job instance
export const FetchJob = (jobId: number | string) => {
  return http.get(`/api/v1/job/${jobId}`) as Promise<Job>
}

// type: 'Import'|'Deploy'|'Undeploy'
export const GetJobs = (type: string) => {
  return http.get('/api/v1/job', {
    params: { type: type }
  }) as Promise<Job[]>
}

export const GetJobCounts = () => {
  return http.get('/api/v1/count') as Promise<{ [key: string]: number }[]>
}
export const SaveJob = (job: Job) => http.put(`/api/v1/job`, job)

export const ExecuteJob = (job: Job) => {
  return http.post(`/api/v1/job/${job.ID}`)
}

export const DeleteJob = (job: Job) => {
  return http.delete(`/api/v1/job/${job.ID}`)
}

export const NewJob = (job: Job) => {
  return http.post('/api/v1/job', job) as Promise<Job>
}

export const CopyJob = (job: Job) => {
  return http.post('/api/v1/job/copy/'+job.ID) as Promise<Job>
}

// transport group API
export const GetTransportGroups = () => {
  return http.get('/api/v1/transportGroup') as Promise<TransportGroup[]>
}

export const CreateTransportGroup = (group: TransportGroup) => {
  return http.post('/api/v1/transportGroup', group) as Promise<TransportGroup>
}

export const DeleteTransportGroup = (groupId: number) => {
  return http.delete('/api/v1/transportGroup', {
    params: { id: groupId }
  })
}

// transport plan API
export const GetTransportPlan = async (planId: number) => {
  return http.get(`/api/v1/transportplan/${planId}`) as Promise<TransportPlan>
}

export const GetTransportPlans = () => {
  return http.get('/api/v1/transportplan') as Promise<TransportPlan[]>
}

export const SaveTransportPlan = (plan: TransportPlan) => {
  return http.post(`/api/v1/transportplan`, plan)
}
// no need to use async here. This function directly returns a premise, and the promise result is not used inner function.
export const DeleteTransportPlan = (planId: number) => {
  return http.delete(`/api/v1/transportplan/${planId}`)
}

export const ParseTransportPlan = (yaml: string, transportGroupId: number, transportPlanId: number, transportGroupName: string) => {
  return http.post('/api/v1/parse', 
    {
      transportGroupId: transportGroupId,
      transportPlanId: transportPlanId,
      yamlContent: yaml,
      transportGroupName: transportGroupName
    }
  ) as Promise<TransportPlan>
}

export const GenImportJob = (planId: number) => {
  return http.post(`/api/v1/transportplan/generate/import?transportPlanId=${planId}`)
}

export const GenDeployJob = (planId: number) => {
  return http.post(`/api/v1/transportplan/generate/deploy?transportPlanId=${planId}`)
}


export const DeleteStep = (stepId: number, type: string) => {
  return http.delete(`/api/v1/step/`, {
    params: { id: stepId, type: type }
  })
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
export const useUserInfoStore = defineStore('userInfo', {
  state: () => ({
    userInfo: null as UserInfo | null
  }),
  actions: {
    isLogged() {
      return this.user !== null
    },
    setUser(user: UserInfo) {
      this.userInfo = user
      window.localStorage.setItem('userInfo', JSON.stringify(user))
    }
  },
  getters: {
    user: (state) => { // return a UserInfo object from this store or localsotrage
      if (state.userInfo) {
        return state.userInfo
      }
      const item = window.localStorage.getItem('userInfo')
      if (item) {
        return JSON.parse(item) as UserInfo
      }
      return null
    }
  }
})


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

export const SyncStatus = (drID: number) => {
  return http.post(`/api/v1/deliveryRequest/syncState/${drID}`)
}


// Cpi tenant operations mapping
export const TenantOps = (dr: DeliveryRequest) => {
  const tenantToOps: Record<number, Record<string, ArtifactTenantOperation>> = {}  // cpi tenant ID - map[trNumber]ArtifactTenantOperation
  dr.ArtifactTenantOperations.forEach(op => {
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



export const NodePosition = (
  sourceNodeID: number,
  nodesData: CpiTenantNodeData[],
  routes: TransportRoute[],
  options?: { horizontalSpacing?: number; verticalSpacing?: number; layerCenterX?: number }
): {id: string, data: CpiTenantNodeData, position:{x: number, y: number}, type: string}[] => {
  // Layout algorithm:
  // 1. Build adjacency map from routes (directed edges sourceNodeId -> targetNodeId).
  // 2. BFS from sourceNodeID to assign each reachable node a layer (source = 0).
  // 3. Any nodes not reached by BFS are placed after the deepest layer (maintaining stable order).
  // 4. For each layer, distribute nodes horizontally with constant spacing.
  // 5. Return array in layer order (ascending layer then NodeID) with the shape expected by Vue Flow.

  const { horizontalSpacing = 240, verticalSpacing = 220, layerCenterX = 0 } = options || {}
  const baseX = 80
  const baseY = 40

  if (!nodesData || nodesData.length === 0) return []

  // Map NodeID -> data for quick lookup.
  const nodeMap: Record<number, CpiTenantNodeData> = {}
  nodesData.forEach(nd => { nodeMap[nd.NodeID] = nd })

  // If source node is not part of nodesData, just fall back to simple grid.
  if (!nodeMap[sourceNodeID]) {
    return nodesData.map((entry, idx) => {
      const col = idx % 3
      const row = Math.floor(idx / 3)
      return {
        id: String(entry.NodeID),
        data: entry,
        position: { x: baseX + col * horizontalSpacing, y: baseY + row * verticalSpacing },
        type: 'cpi-transport'
      }
    })
  }

  // Build adjacency list.
  const adj: Record<number, number[]> = {}
  routes.forEach(r => {
    if (!adj[r.sourceNodeId]) adj[r.sourceNodeId] = []
    adj[r.sourceNodeId].push(r.targetNodeId)
  })

  // BFS to assign layers.
  const layer: Record<number, number> = {}
  const visited: Set<number> = new Set()
  const queue: number[] = []
  layer[sourceNodeID] = 0
  visited.add(sourceNodeID)
  queue.push(sourceNodeID)

  while (queue.length) {
    const current = queue.shift()!
    const nexts = adj[current] || []
    nexts.forEach(nid => {
      if (!visited.has(nid) && nodeMap[nid]) { // only consider nodes we actually render
        visited.add(nid)
        layer[nid] = layer[current] + 1
        queue.push(nid)
      }
    })
  }

  // Collect unreached nodes (present in nodesData but not visited)
  const reachedNodeIDs = new Set(Object.keys(layer).map(k => Number(k)))
  const unreached: number[] = nodesData
    .map(nd => nd.NodeID)
    .filter(id => !reachedNodeIDs.has(id))

  // Assign unreached nodes layers after the max layer.
  const maxLayer = Object.values(layer).reduce((m, v) => Math.max(m, v), 0)
  unreached.forEach((nid, idx) => { layer[nid] = maxLayer + 1 + idx })

  // Group nodes by layer.
  const layerGroups: Record<number, number[]> = {}
  Object.entries(layer).forEach(([nidStr, lyr]) => {
    const nid = Number(nidStr)
    layerGroups[lyr] = layerGroups[lyr] || []
    layerGroups[lyr].push(nid)
  })

  // Sort node IDs in each layer for deterministic output.
  Object.values(layerGroups).forEach(arr => arr.sort((a, b) => a - b))

  // Determine positions.
  const result: {id: string, data: CpiTenantNodeData, position:{x: number, y: number}, type: string}[] = []
  const sortedLayers = Object.keys(layerGroups).map(n => Number(n)).sort((a, b) => a - b)
  sortedLayers.forEach(lyr => {
    const ids = layerGroups[lyr]
    ids.forEach((nid, idx) => {
      const x = baseX + idx * horizontalSpacing + layerCenterX
      const y = baseY + lyr * verticalSpacing
      result.push({
        id: String(nid),
        data: nodeMap[nid],
        position: { x, y },
        type: 'cpi-transport'
      })
    })
  })

  return result

}