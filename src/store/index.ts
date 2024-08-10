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
  uuid: number
  name: string
  description: string
  steps: Step[] //steps under this job instance
  status: 'DRAFT' | 'SUBMITTED' | 'RUNNING' | 'FINISHED' | 'FATAL'

  createdBy: string
  modifiedBy: string
  createdAt: string
  modifiedAt: string
}

export interface Step {
  uuid?: number
  job: Job // A job which this step belongs to
  status: 'DRAFT' | 'SUBMITTED' | 'RUNNING' | 'FINISHED' | 'FATAL'
  type: string

  tenant: ApiEndpoint
  targets: object[]

  createdBy?: string
  modifiedBy?: string
  createdAt?: string
  modifiedAt?: string
}

export interface ImportStep extends Step {
  targets: TransportRequest[] // transport requests
}

export interface DeployStep extends Step {
  targets: object[] // types might be scriptCollections, iflows, packages
}

export interface UndeployStep extends Step {
  targets: object[]
}

export interface ApiEndpoint {
  id: number
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

export interface TransportRequest {
  uuid: number
  description: string
  status: string
  entryNode: string
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
