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

  createdBy?: string
  modifiedBy?: string
  createdAt?: string
  modifiedAt?: string
}

export interface ImportStep extends Step {
  tenant: string
  trs: string[]
}

export interface DeployStep extends Step {
  tenant: string
  artifacts: string[] //types might be scriptCollections, iflows, packages
}

export interface ApiEndpoint {
  uuid: number
  type: 'TMS' | 'CPI'
  status: 'reachable' | 'fail to connect' | 'draft'
  description: string
  tokenUrl: string
  credentialId: string
  credentialSecret: string
  endpointUrl: string

  createdBy: string
  modifiedBy: string
  createdAt: string
  modifiedAt: string
}
