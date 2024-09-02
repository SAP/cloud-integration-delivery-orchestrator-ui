import type { DataTableColumns } from 'naive-ui'
import { defineStore } from 'pinia'

export const statusDict = {
  DRAFT: 'wait',
  SUBMITTED: 'wait',
  RUNNING: 'process',
  FINISHED: 'finish',
  FATAL: 'error'
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
export function validate(job: Job) {

  for (const step of job.steps) {
    if (step.type === 'Import') {
      const importStep = step as ImportStep
      if (!(importStep.endpoint_id>0 && importStep.transport_node_id>0 && importStep.transport_node_name.length && importStep.transport_requests.length)) 
        return false
    }else if (step.type === 'Deploy') {
      const deployStep = step as DeployStep
      if(!(deployStep.endpoint_id>0 && deployStep.package_id>0 && deployStep.artifacts_ids.length)) return false
    }
  }
  return true
}
export interface DeployStep extends Step {
  package_id: number
  artifacts_ids: number[]
}

export interface UndeployStep extends Step {
  targets: object[]
}

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

export interface Package {
  Id: string
  Name: string
  Description: string
  Version: string
}

export interface ToolBar {
  text: String
  func(rows: DataTableColumns): void
}
