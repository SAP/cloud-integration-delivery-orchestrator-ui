import axios from 'axios'
import { clientId, clientSecret, tokenEndpoint, userInfoEndpoint } from './consts'
import http from './http'
import { defineStore } from 'pinia'
import { ParaglidingSharp } from '@vicons/material'
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
  return http.get('/api/v1/count') as Promise<{ [key: string]: number }>
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

export interface TransportGroup {
  ID: number
  Name: string
  Description: string
  TransportNodes: TransportNode[]
  DeployEndpoints: string[]
  CreatedBy: string
}


export interface TransportPlan {
  ID: number
  Name: string
  Description: string
  CreatedAt: string
  UpdatedAt: string
  CreatedBy: string
  UpdatedBy: string

  TransportGroupName: string
  TransportGroupID: number

  Artifacts: Artifact[]
  TransportRequests: TransportRequest[] // transport request numbers

  ImportJobId: number // import job id in table Job
  DeployJobId: number // deploy job id in table Job

  VerifyTransportRequests: string // verify tr numbers exist in tms nodes. Pass/Fail
  VerifyArtifacts: string // verify artifacts exist in cpi tenant. Pass/Fail

  ImportJobStatus: string // update from import job status
  DeployJobStatus: string // update from deploy job status
}


export interface Job {
  ID: number
  Name: string
  Description: string
  Status: 'Draft' | 'Saved' | 'Running' | 'Success' | 'Error' | 'Unknown'
  Type: string // 'Deploy' | 'Import' | 'Undeploy'
  Steps: Step[] //steps under this job instance
  ExecutionLogs: ExecutionLog[]

  CreatedBy: string
  UpdatedBy: string
  CreatedAt: string
  UpdatedAt: string
}

export interface Step {
  ID: number
  Status: 'Draft' | 'Saved' | 'Running' | 'Success' | 'Error'
  Type: string
  CreatedAt: string
	UpdatedAt: string
  UpdatedBy:   string
  TriggeredBy: string
	TriggeredAt: string
	EndedAt:     string
}

export const DeleteStep = (stepId: number, type: string) => {
  return http.delete(`/api/v1/step/`, {
    params: { id: stepId, type: type }
  })
}

export interface ImportStep extends Step {
  TransportNodeId: number
  TransportNodeName: string
  TransportRequests_V2: TransportRequest[]
  ActionId: number
}

export interface DeployStep extends Step {
  Endpoint: string // cpi tenant name
  PackageId: string
  Artifacts: Artifact[]  // version 2.0.0. as an replacement of ArtifactIds/Types/Versions...
}

export interface UndeployStep extends Step {

}

export interface ExecutionLog {
  CreatedAt: string
  JobId: number
  StepId: number
  Sequence: number
  StepType: string
  Log: string
}

// api endpoints, including tms, cpi
export interface ApiEndpoint {
  name: string
  type: string
  url: string
}
export const GetCPIApiEndpoints = () => {
  return http.get('/api/v1/destinations') as Promise<ApiEndpoint[]>
}

// TMS

export interface TransportNode {
  id: number
  description: string
  name: string
}
export interface TransportRequest {
  ID: number
  Description: string
  Status: string
}

// transport request options with a node
export interface NodeTransportRequest {
  id: number
  description: string
  status: string
  origin: string
  createdAt: string
  createdBy: string
}

export interface TMSRoute {
  id: number
  description: string
  name: string
  sourceNodeId: number
  targetNodeId: number
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
  return http.get('/api/v1/tms/routes') as Promise<TMSRoute[]>
}

// CPI
export interface Package {
  Id: string
  Name: string
  Description: string
  Version: string
  Mode: string
  ModifiedBy: string
  ModifiedAt: string
}

// design time artifact
export interface Artifact {
  Id: string
  Version: string
  Package: string
  Type: string
  TaskId: string
  Status: string
}

export interface RuntimeArtifact {
  Id: string
  Version: string
  Name: string
  Type: string
  DeployedBy: string
  DeployedOn: string
  Status: string
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

export interface UserInfo {
  avatar_url: string
  bio: any
  blog: string
  company: any
  created_at: string
  email: string
  events_url: string
  followers: number
  followers_url: string
  following: number
  following_url: string
  gists_url: string
  gravatar_id: string
  hireable: any
  html_url: string
  id: number
  location: any
  login: string
  name: string
  node_id: string
  organizations_url: string
  public_gists: number
  public_repos: number
  received_events_url: string
  repos_url: string
  site_admin: boolean
  starred_url: string
  subscriptions_url: string
  suspended_at: any
  twitter_username: any
  type: string
  updated_at: string
  url: string
}

export interface CpiTenant {
  ID: number
  Name: string
  TransportNode: TransportNode
  CpiEndpoint: ApiEndpoint

  CreatedAt: string
  UpdatedAt: string
  CreatedBy: string
  UpdatedBy: string
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

export interface DeliveryRule {
  ID: number
  CreatedAt: string
  UpdatedAt: string
  DeletedAt?: string | null
  Name: string
  VersionPattern: string
  IncludedTenants: CpiTenant[]
  ExcludedTenants: CpiTenant[]
  Active: boolean
  CreatedBy: string
  UpdatedBy: string
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

