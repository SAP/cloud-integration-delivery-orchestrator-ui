import type { RequestState, ImportState, DeployState, AggregateStatus } from "./statuses"

// Represents the per-tenant lifecycle operation of an artifact within a delivery request.
export interface ArtifactTenantOperation {
  ID: number
  CreatedAt: string
  UpdatedAt: string
  DeletedAt?: string | null

  DeliveryRequestID: number

  ArtifactID: number
  Artifact: Artifact

  ArtifactTechID: string
  ArtifactVersion: string

  TenantID: number
  Tenant: CpiTenant

  TransportRequestNumber: string

  // Lifecycle states (backend enum/string values: RequestState / ImportState / DeployState)
  RequestState: RequestState
  ImportState: ImportState
  DeployState: DeployState

  LastError: string
  RetryCountImport: number
  RetryCountDeploy: number
  NextRetryAt?: string | null

  // Raw condition/action bytes (backend []byte). Treat as base64 or JSON string.
  Conditions: string
}

export interface DeliveryRequest {
  ID:             number;
  Name:           string;
  Description:    string;
  JiraLink:       string;
  AggregateStatus:         AggregateStatus;  // overall status
  ArtifactTenantOperations:      ArtifactTenantOperation[];
  SourceTenant:   CpiTenant;   // mandatory
  DeliveryRule:   DeliveryRule;
  TargetNodes:    TransportNode[];
  TargetRoutes:   TransportRoute[];
  DeliveredTo:    CpiTenant[]; 
  CreatedBy:      string;
  UpdatedBy:      string;
  CreatedAt:      string;      // ISO 字符串
  UpdatedAt:      string;
}


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
  TransportNodeID: number
  TransportNodeName: string
  TransportNodeDescription: string
  CpiEndpoint: ApiEndpoint
  Group: string

  CreatedAt: string
  UpdatedAt: string
  CreatedBy: string
  UpdatedBy: string
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

export interface TransportRoute {
  id: number
  description: string
  name: string
  sourceNodeId: number
  targetNodeId: number
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
  TechID: string
  Version: string
  PackageID: string
  Name: string
  Type: string
  Description: string
  CreatedBy: string
  CreatedAt: string
  ModifiedBy: string
  ModifiedAt: string
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



// Version history (CPI cookie service) types & helpers
export interface ArtifactVersionHistoryItem {
  comment: string
  semanticVersion: string
  technicalVersion: number
  createdDate: string        // epoch milliseconds in string form
  createdBy: string
  state: string
}

export interface CpiTenantNodeData {
  NodeID: number, // equal to TransportNode.ID
  TenantID: number,
  TrToOp: Record<string, ArtifactTenantOperation>, // map[trNumber]ArtifactTenantOperation
  IsSource: boolean,
  Tenant: CpiTenant
}

export interface DeliverOpRequest {
  opIDs: number[]
  targetTenant: number // target tenant ID
}