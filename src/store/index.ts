import axios from 'axios'
import type { DataTableColumns } from 'naive-ui'
import { defineStore } from 'pinia'

export function FetchJob(jobId: number|string): Promise<Job> {
  return axios.get(`/api/v1/job/${jobId}`).then((resp) => resp.data.result)
}
// type: 'Import'|'Deploy'|'Undeploy'
export function GetJobs(type: string): Promise<Job[]> {
  return axios.get('/api/v1/job', {
    params:{type: type}
  }).then(resp => resp.data.result)
}

export function SaveJob(job: Job): Promise<Job> {
  return axios.put(`/api/v1/job`, job)
    .then((resp) => 
      resp.data.result)
}

export function ExecuteJob(job: Job): Promise<Job>{
  return axios.post(`/api/v1/job/${job.ID}`).then(resp => resp.data.result)
}

export function DeleteJob(job: Job): Promise<Job>{
  return axios
  .delete(`/api/v1/job/${job.ID}`)
  .then(resp => 
    resp.data.result
  )
}

export function NewJob(type: string): Promise<Job>{
  const job: Job = {
    Name: '',
    Description: '',
    Status: 'Draft',
    Steps: [],
    Type: type,
    ID: 0
  }
  return axios
    .post('/api/v1/job', job)
    .then(resp => 
      resp.data.result
    )
}
export interface Job {
  ID: number
  Name: string
  Description: string
  Status: 'Draft' | 'Saved' | 'Running' | 'Finished' | 'Error'
  Type: string // 'Deploy' | 'Import' | 'Undeploy'
  Steps: Step[] //steps under this job instance

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

export function DeleteStep(stepId: number, type: string): Promise<number> {
  return axios.delete(`/api/v1/step/`, {
    params: {id: stepId, type: type}
  })
    .then(resp => resp.data.result)
}

export interface ImportStep extends Step {
  TransportNodeId: number
  TransportNodeName: string
  TransportRequests: number[] // transport requests
}

export interface DeployStep extends Step {
  Endpoint: string // cpi tenant name
  PackageId: string
  ArtifactIds: string[]
  ArtifactTypes: string[]
  ArtifactVersions: string[]
}

export interface UndeployStep extends Step {
  targets: object[]
}

// api endpoints, including tms, cpi
export interface ApiEndpoint {
  name: string
  type: string
  url: string
}
export function GetApiEndpointsByType(): Promise<ApiEndpoint[]> {
  return axios
  .get('/api/v1/destinations')
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
  Type: string
}



export function GetPackages(tenantId:number|string): Promise<Package[]> {
  return axios.get('/api/v1/tanant/packages', {
    params: {tenant: tenantId}
  })
  .then(resp => resp.data.result)
}

export function GetArtifacts(tenantId: string, packageId:string): Promise<Artifact[]> {
  return axios
    .get('/api/v1/tenant/packages/artifacts', {
    params: {tenant: tenantId, package: packageId}
  })
    .then(resp => 
      resp.data.result)
}

export interface ToolBar {
  text: String
  func(rows: DataTableColumns): void
}
