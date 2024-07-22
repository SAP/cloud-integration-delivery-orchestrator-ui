import type { Job, DeployStep, ImportStep, ApiEndpoint } from '@/store/index'

const mockJob: Job = {
  uuid: 1000,
  description: 'Mock job 01',
  status: 'DRAFT',
  createdAt: '2024.11.2 12:02:45',
  createdBy: 'Doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: '',
  steps: []
}

const mockJob1: Job = {
  uuid: 1001,
  description: 'Mock job 02',
  status: 'FATAL',
  createdAt: '',
  createdBy: '',
  modifiedAt: '',
  modifiedBy: '',
  steps: []
}

const mockJob2: Job = {
  uuid: 1002,
  description: 'Mock job 02',
  status: 'FINISHED',
  createdAt: '',
  createdBy: '',
  modifiedAt: '',
  modifiedBy: '',
  steps: []
}

export const mockJobList: Job[] = [mockJob, mockJob1, mockJob2]

const mockSteps: (DeployStep | ImportStep)[] = [
  {
    uuid: 1233,
    job: mockJob,
    status: 'SUBMITTED',
    type: 'Deploy',
    tenant: 'prod01-PPP',
    artifacts: ['e3', 'deas', 'd32w'],
    createdAt: '',
    createdBy: '',
    modifiedAt: '',
    modifiedBy: ''
  },
  {
    uuid: 1233,
    job: mockJob,
    status: 'SUBMITTED',
    type: 'Import',
    tenant: 'prod01-SWM',
    trs: ['e', 'dedas', 'dddddd'],
    createdAt: '',
    createdBy: '',
    modifiedAt: '',
    modifiedBy: ''
  }
]

mockJob.steps = mockSteps
export { mockJob }

const mockCPIEndpoint1: ApiEndpoint = {
  uuid: 20001,
  type: 'CPI',
  status: 'draft',
  description: 'Prod-01 EON',
  tokenUrl: 'http://baidu.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

const mockCPIEndpoint2: ApiEndpoint = {
  uuid: 20002,
  type: 'CPI',
  status: 'fail to connect',
  description: 'Prod-03 SWM',
  tokenUrl: 'http://baidu.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

const mockCPIEndpoint3: ApiEndpoint = {
  uuid: 20003,
  type: 'CPI',
  status: 'reachable',
  description: 'Prod-04 SWESNES',
  tokenUrl: 'http://baidu.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

export const mockCpiEndpoints = [mockCPIEndpoint1, mockCPIEndpoint2, mockCPIEndpoint3]

const mockTMSEndpoint: ApiEndpoint = {
  uuid: 20001,
  type: 'TMS',
  status: 'reachable',
  description: 'Devops TMS',
  tokenUrl: 'http://tms.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

const mockTMSEndpoint1: ApiEndpoint = {
  uuid: 20002,
  type: 'TMS',
  status: 'reachable',
  description: 'TMS Prod',
  tokenUrl: 'http://tms-prod.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

export const mockTMSList: ApiEndpoint[] = [mockTMSEndpoint, mockTMSEndpoint1]
