import axios from 'axios'
import type { DataTableColumns } from 'naive-ui'
import { defineStore } from 'pinia'

export function FetchJob(jobId: number|string): Promise<Job> {
  return axios.get(`/api/v1/job/${jobId}`).then((resp) => resp.data.result)
}

export function SaveJob(job: Job): Promise<Job> {
  return axios.put(`/api/v1/job`, job)
    .then((resp) => 
      resp.data.result)
}

export function ExecuteJob(job: Job) {

}

export function DeleteJob(job: Job): Promise<Job>{
  return axios
  .delete(`/api/v1/job/${job.id}`)
  .then(resp => 
    resp.data.result
  )
}

export function NewJob(): Job{
  return {
    name: '',
    description: '',
    status: 'DRAFT',
    steps: [],
    id: -1,
  }
}
export interface Job {
  id: number
  name: string
  description: string
  status: 'DRAFT' | 'SUBMITTED' | 'RUNNING' | 'FINISHED' | 'FATAL'
  steps: Step[] //steps under this job instance

  createdBy?: string
  modifiedBy?: string
  createdAt?: string
  modifiedAt?: string
}

export interface Step {
  id: number
  status: 'DRAFT' | 'SUBMITTED' | 'RUNNING' | 'FINISHED' | 'FATAL'
  type: string

  endpoint_id: number

  createdBy?: string
  modifiedBy?: string
  createdAt?: string
  modifiedAt?: string
}

export interface ImportStep extends Step {
  transport_node_id: number
  transport_node_name: string
  transport_requests: number[] // transport requests
}

export interface DeployStep extends Step {
  endpoint_name: string // cpi tenant name
  package_id: string
  artifact_ids: string[]
}

export interface UndeployStep extends Step {
  targets: object[]
}

// api endpoints, including tms, cpi
export interface ApiEndpoint {
  id: number
  name: string
  type: 'TMS' | 'CPI'
  status: 'reachable' | 'fail to connect' | 'draft'
  description: string
  authUrl: string
  clientId: string
  clientSecret: string
  apiUrl: string

  createdBy: string
  modifiedBy: string
  createdAt: string
  modifiedAt: string
}
export function GetApiEndpointsByType(type: 'CPI'|'TMS'): Promise<ApiEndpoint[]> {
  return axios
  .get('/api/v1/apiEndpoints', {
    params: { type: type }
  })
  .then(resp => resp.data.result)
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
export function GetTransportNodes(): Promise<TransportNode[]> {
  return axios.get('/api/v1/tms/nodes')
    .then(resp => resp.data.result)
}
export function GetTransportRequests(node_id: number|string): Promise<TransportRequest[]>{
  return axios
  .get('/api/v1/tms/trs', {
    params: { transportNode: node_id }
  }).then((response) =>  response.data.result)
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
}



export function GetPackages(tenantId:number|string): Promise<Package[]> {
  return axios.get('/api/v1/tanant/packages', {
    params: {tenant: tenantId}
  })
  .then(resp => resp.data.result)
}

export function GetArtifacts(tenantId: number, packageId:string): Promise<Artifact[]> {
  return axios
    .get('/api/v1/tenant/packages/iflows', {
    params: {tenant: tenantId, package: packageId}
  })
    .then(resp => 
      resp.data.result)
}

export interface ToolBar {
  text: String
  func(rows: DataTableColumns): void
}
