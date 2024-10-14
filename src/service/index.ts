import type { DataTableColumns } from 'naive-ui'
import http from './http'
import { defineStore } from 'pinia'

export const Login = (code: string, state: string, callbackUrl: string) => {
  return http.get(`/api/v1/userInfo?code=${code}&state=${state}`)
}

// returns Job instance
export const FetchJob = (jobId: number | string) => {
  return http.get(`/api/v1/job/${jobId}`)
}

// type: 'Import'|'Deploy'|'Undeploy'
export const GetJobs = (type: string) => {
  return http.get('/api/v1/job', {
    params: { type: type }
  })
}

export const SaveJob = (job: Job) => http.put(`/api/v1/job`, job)

export const ExecuteJob = (job: Job) => {
  return http.post(`/api/v1/job/${job.ID}`)
}

export const DeleteJob = (job: Job) => {
  return http.delete(`/api/v1/job/${job.ID}`)
}

export const NewJob = (type: string) => {
  const job: Job = {
    Name: '',
    Description: '',
    Status: 'Draft',
    Steps: [],
    Type: type,
    ID: 0
  }
  return http.post('/api/v1/job', job)
}
export interface Job {
  ID: number
  Name: string
  Description: string
  Status: 'Draft' | 'Saved' | 'Running' | 'Finished' | 'Error'
  Type: string // 'Deploy' | 'Import' | 'Undeploy'
  Steps: Step[] //steps under this job instance
  ExecutionLogs: ExecutionLog[]

  CreatedBy: string
  Updatedby: string
  CreatedAt: string
  UpdatedAt: string
}

export interface Step {
  ID: number
  Status: 'Draft' | 'Saved' | 'Running' | 'Finished' | 'Error'
  Type: string
}

export const DeleteStep = (stepId: number, type: string) => {
  return http.delete(`/api/v1/step/`, {
    params: { id: stepId, type: type }
  })
}

export interface ImportStep extends Step {
  TransportNodeId: number
  TransportNodeName: string
  TransportRequests: number[] // transport requests
  ActionId: number
}

export interface DeployStep extends Step {
  Endpoint: string // cpi tenant name
  PackageId: string
  ArtifactIds: string[]
  ArtifactTypes: string[]
  ArtifactVersions: string[]
  TaskIds: string[]
  TaskStatuses: string[]
}

export interface UndeployStep extends Step {
  targets: object[]
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
export const GetApiEndpointsByType = () => {
  return http.get('/api/v1/destinations')
}

// TMS

export interface TransportNode {
  id: number
  description: string
  name: string
}

export interface TransportRequest {
  id: number
  description: string
  status: string
  origin: string
  createdAt: string
  createdBy: string
}
export const GetTransportNodes = () => {
  return http.get('/api/v1/tms/nodes')
}
export const GetTransportRequests = (node_id: number | string) => {
  return http.get('/api/v1/tms/trs', {
    params: { transportNode: node_id }
  })
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

export interface Artifact {
  Id: string
  Version: string
  Name: string
  Type: string
}

export const GetPackages = (tenantId: number | string) => {
  return http.get('/api/v1/tanant/packages', {
    params: { tenant: tenantId }
  })
}

export const GetArtifacts = (tenantId: string, packageId: string) => {
  return http.get('/api/v1/tenant/packages/artifacts', {
    params: { tenant: tenantId, package: packageId }
  })
}

export const useUserInfoStore = defineStore('userInfo', {
  state: () => ({
    userInfo: null as UserInfo | null
  }),
  actions: {
    isLogged() {
      return this.user !== null
    }
  },
  getters: {
    user: (state) => {
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
