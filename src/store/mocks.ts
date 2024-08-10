import type { Job, DeployStep, ImportStep, ApiEndpoint, TransportRequest } from '@/store/index'

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
  id: 20001,
  type: 'TMS',
  status: 'reachable',
  description: 'Devops TMS',
  authUrl: 'http://tms.com/oauth/token',
  credentialId: 'xxxxxxxx',
  credentialSecret: 'SECRETxxxxxxxxx',
  endpointUrl: 'http://baidu.com/api/v1',
  createdAt: '',
  createdBy: 'doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: 'jennings.liu@sap.com'
}

const mockTMSEndpoint1: ApiEndpoint = {
  id: 20002,
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

const mockTr: TransportRequest = {
  uuid: 204945,
  description: 'SAPMaCoforUtilitiesInboundProcessingV4 - MACOMMT-18045',
  createdAt: 'Friday, Jul 12, 2024, 5:41:50 PM GMT+8',
  createdBy: '27a0e8e8-078a-4ccc-8802-67cc3c3b17fe',
  status: 'Initial',
  entryNode: 'NODE_MMT_CF_HOTFIX'
}

const mockTr1: TransportRequest = {
  uuid: 207892,
  description: 'SAPMaCoforUtilitiesEmailProcessingV4 - MACOMMT-18109',
  createdAt: 'Friday, Jul 12, 2024, 5:41:50 PM GMT+8',
  createdBy: '27a0e8e8-078a-4ccc-8802-67cc3c3b17fe',
  status: 'Initial',
  entryNode: 'NODE_MMT_CF_CTEST'
}

export const mockTrList: TransportRequest[] = [mockTr, mockTr1]

const mockJob: Job = {
  uuid: 1000,
  name: 'Mock job 01',
  description: 'JRIA task: XXX',
  status: 'FATAL',
  createdAt: '2024.11.2 12:02:45',
  createdBy: 'Doug.liu@sap.com',
  modifiedAt: '',
  modifiedBy: '',
  steps: []
}

const mockJob1: Job = {
  uuid: 1001,
  name: 'Mock job 02',
  description: 'JRIA task: XXX',
  status: 'FATAL',
  createdAt: '',
  createdBy: '',
  modifiedAt: '',
  modifiedBy: '',
  steps: []
}

const mockJob2: Job = {
  uuid: 1002,
  name: 'Mock job 02',
  description: 'JRIA task: XXX',
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
    status: 'DRAFT',
    type: 'Import',
    tenant: mockTMSEndpoint,
    trs: [],
    createdAt: '',
    createdBy: '',
    modifiedAt: '',
    modifiedBy: ''
  }
]

// mockJob.steps = mockSteps
export { mockJob }
