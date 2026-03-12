import type { RequestState, ImportState, DeployState, AggregateStatus, ConditionType } from "./statuses"

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
  AggregateStatus: AggregateStatus;  // overall status
  ArtifactTenantOperations:ArtifactTenantOperation[];
  SourceTenant:   CpiTenant;   // mandatory
  DeliveryRule:   DeliveryRule;
  Approvers:      string[]; // user_ids
  ApprovedBy:     string; // 
  ApprovedAt:     string;
  CreatedBy:      string;
  UpdatedBy:      string;
  CreatedAt:      string;
  UpdatedAt:      string;
  Conditions:     Condition[];
}

export interface Condition {
  ID: number
  CreatedAt: string
  DeliveryRequestID: number
  ArtifactTenantOperationID: number
  State: ConditionType
  Message: string
  Timestamp: string
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
  SourceTenantID: CpiTenant
  SourceTenant:   CpiTenant
  SkipApprove: boolean
  RequireJira: boolean

  TargetNodes: TransportNode[]
  TargetRoutes: TransportRoute[]
  
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
  deliveryRequestID: number
}
export interface UserInfo {
  id: string
  userName: string
  email: string
  origin: string
  groups: {
    value: string
    display: string
    type: string
  }[]
}


export interface AppCount {
  Total: number
  StatusCounts: {[key: string]: number}
}


// --- Version Compare ---

export type SnapshotStatus = 'running' | 'completed' | 'failed' | 'none'
export type TriggerStatus = 'running' | 'rate_limited' | 'conflict'

export interface TriggerResult {
  status: TriggerStatus
}

export interface VersionCompareTenantInfo {
  id: number
  name: string
  isSource: boolean
}

export interface VersionCompareArtifactTenantInfo {
  designTimeVersion?: string
  designTimeMatch?: boolean | null
  designTimeDraft?: boolean
  modifiedBy?: string
  modifiedAt?: string
  runtimeVersion?: string
  runtimeMatch?: boolean | null
  runtimeStatus?: string
  error?: string
}

export interface VersionCompareArtifact {
  id: string
  name: string
  type: string
  versions: Record<number, VersionCompareArtifactTenantInfo>
}

export interface VersionComparePackage {
  packageID: string
  artifacts: VersionCompareArtifact[]
}

export interface VersionCompareResponse {
  status: SnapshotStatus
  triggeredAt?: string
  completedAt?: string
  triggeredBy?: string
  error?: string
  tenants?: VersionCompareTenantInfo[]
  packages?: VersionComparePackage[]
}

export interface VersionCompareSummaryItem {
  deliveryRuleID: number
  deliveryRuleName: string
  sourceTenantName: string
  tenantCount: number
  status: SnapshotStatus
  triggeredAt?: string
  completedAt?: string
  matchedCount: number
  mismatchedCount: number
  totalArtifacts: number
}