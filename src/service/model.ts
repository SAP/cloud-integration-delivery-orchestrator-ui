import type { RequestState, ImportState, DeployState, AggregateStatus, ConditionType } from "./statuses"

// Represents the per-tenant lifecycle operation of an artifact within a delivery request.
export interface ArtifactTenantOperation {
  ID: number
  CreatedAt: string
  UpdatedAt: string
  DeletedAt?: string | null

  DeliveryRequestID: number

  // Artifact identity fields — flattened (RFC-015). ArtifactID/Artifact kept for
  // backward-compat read of existing responses; new ops must send flat fields.
  ArtifactID?: number
  Artifact?: Artifact

  ArtifactTechID: string
  ArtifactVersion: string
  ArtifactName: string
  ArtifactType: string
  PackageID: string
  PackageName: string
  PackageVersion: string

  TenantID: number
  Tenant: CpiTenant

  TransportRequestNumber: string
  TrError?: string  // non-empty when RequestState = TR_FAILED

  // Lifecycle states (backend enum/string values: RequestState / ImportState / DeployState)
  RequestState: RequestState
  ImportState: ImportState
  DeployState: DeployState

  SkipDeploy: boolean

  LastError: string
  RetryCountImport: number
  RetryCountDeploy: number
  NextRetryAt?: string | null

  // Raw condition/action bytes (backend []byte). Treat as base64 or JSON string.
  Conditions: string

  // CAS cache fields — passed at InsertOps time so backend can skip CAS lookup during TR generation
  CasArtifactGUID?: string
  CasPackageResourceID?: string
  CasArtifactExportable?: boolean
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

export type TenantLifecycleState = 'draft' | 'configured' | 'not_ready' | 'readying' | 'ready'
export type PrerequisiteStatus = 'missing' | 'ready' | 'failed' | 'registering'
export type BootstrapJobState = 'running' | 'waiting_user_action' | 'partially_applied' | 'failed' | 'finished'
export type BootstrapJobType = 'preview' | 'apply' | 'retry'
export type BootstrapFailureType = 'waiting_user_action' | 'permission_blocked' | 'remote_system_error' | 'config_mismatch' | ''

export interface CpiTenant {
  ID: number
  Name: string
  Group: string

  // RFC-013: CF identity fields (required for bootstrap)
  CfApiEndpoint: string
  CfOrg: string
  CfSpace: string

  // RFC-013: Bootstrap lifecycle
  LifecycleState: TenantLifecycleState
  BlockingReason: string

  // RFC-013: Prerequisite status
  PirApiStatus: PrerequisiteStatus
  CasApplicationStatus: PrerequisiteStatus
  CasStandardStatus: PrerequisiteStatus
  CloudIntegrationDestStatus: PrerequisiteStatus
  ContentAssemblyDestStatus: PrerequisiteStatus
  TransportManagementDestStatus: PrerequisiteStatus

  // RFC-013: TMS Node registration
  TmsSourceNodeID: number
  TmsSourceNodeName: string
  TmsNodeRegistrationStatus: PrerequisiteStatus

  // RFC-013: Destination references
  CasEngineDestinationName: string
  PirApiDestinationName: string
  PirApiUrl: string

  CreatedAt: string
  UpdatedAt: string
  CreatedBy: string
  UpdatedBy: string
}

// --- Bootstrap types ---

export interface BootstrapInspection {
  spaceAccessible: boolean
  hasSpaceDeveloperRole: boolean
  missingItems: string[]
  permissionIssues: string[]
  waitingUserAction: string[]
}

export interface BootstrapPreview {
  tenantId: number
  inspection: BootstrapInspection
}

export interface BootstrapJob {
  ID: number
  CreatedAt: string
  UpdatedAt: string
  CpiTenantID: number
  JobType: BootstrapJobType
  State: BootstrapJobState
  CurrentStep: string
  FailureType: BootstrapFailureType
  ErrorDetail: string
  MissingPrerequisites: string[] | null
  PermissionFindings: string[] | null
  CredentialActions: { destinationName: string; actionType: string }[] | null
  StartedAt: string
  EndedAt: string | null
}

// --- TMS Node registration types ---

export interface TmsRoutesResponse {
  nodeName: string
  routes: TransportRoute[]
}

export interface TmsNodeConfirmResponse {
  tenantId: number
  tmsNodeRegistrationStatus: PrerequisiteStatus
  routes: TransportRoute[]
}

// --- Central TMS Context ---

export interface CentralTmsContext {
  ID: number
  TmsApiDestinationName: string
  LastValidatedAt: string | null
  TmsApiEndpoint?: string
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
  PackageName: string
  PackageVersion: string
  Name: string
  Type: string
  Description: string
  CreatedBy: string
  CreatedAt: string
  ModifiedBy: string
  ModifiedAt: string
}

export interface RuntimeArtifact {
  Id: string
  Version: string
  Name: string
  Type: string
  DeployedBy: string
  DeployedOn: string
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



// Artifact version history types
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

export interface VersionCompareIncludedPackage {
  ID: number
  PackageID: string
  Description: string
  CreatedBy: string
}

// --- Auto-Create DR from Version Compare Mismatch ---

export interface ExistingDRInfo {
  id: number
  name: string
}

export interface PreviewDRArtifact {
  artifactID: string
  artifactName: string
  packageID: string
  type: string
  sourceVersion: string
  modifiedBy?: string
  modifiedAt?: string
  category: 'includable' | 'draft' | 'versionPattern' | 'duplicate'
  reason?: string
  existingDR?: ExistingDRInfo
}

export interface PreviewDRSummary {
  totalMismatch: number
  includable: number
  draft: number
  versionPattern: number
  duplicate: number
}

export interface PreviewDRResponse {
  snapshotID: number
  snapshotCompletedAt: string
  ruleName: string
  requireJira: boolean
  artifacts: PreviewDRArtifact[]
  summary: PreviewDRSummary
}

export interface ArtifactKey {
  artifactID: string
  packageID: string
  skipDeploy?: boolean
}

export interface CreateDRFromMismatchRequest {
  name: string
  jiraLink: string
  snapshotID: number
  snapshotCompletedAt: string
  artifactKeys: ArtifactKey[]
}

export interface MismatchSkipError {
  artifactID: string
  packageID: string
  reason: string
}

export interface CreateDRFromMismatchSummary {
  requested: number
  created: number
  errors: MismatchSkipError[]
}

export interface CreateDRFromMismatchResponse {
  deliveryRequest: DeliveryRequest
  summary: CreateDRFromMismatchSummary
}

export interface GenerateTRResult {
  transportRequestID: string
  transportRequestURL: string
}

export interface GenerateTRResponse {
  succeeded: { [opID: string]: GenerateTRResult }
  failed: { [opID: string]: string }
}

// --- System Configuration ---

export interface IntegrationConfig {
  type: string
  destinationName: string
  enabled: boolean
  description: string
}

export interface GitRepoConfig {
  ID?: number
  provider: string
  destinationName: string
  owner: string
  repo: string
  enabled: boolean
}

export interface GitOwnerInfo {
  login: string
  type: string // "User" | "Organization"
}

export interface GitRepoInfo {
  name: string
  fullName: string
  private: boolean
}

export interface ConnectivityStatus {
  name: string
  type: string    // "database" | "tms" | "cpi_tenant" | "integration"
  status: string  // "ok" | "error" | "disabled"
  message?: string
}

export interface ConnectivityReport {
  checkedAt: string
  results: ConnectivityStatus[]
}

export interface BackfillOpDetail {
  opID: number
  tenantID: number
  name: string
  version: string
  oldTechID: string
  newTechID?: string
  status: 'fixed' | 'skipped' | 'failed'
  error?: string
}

export interface BackfillTechIDResult {
  total: number
  fixed: number
  skipped: number
  failed: number
  dryRun: boolean
  details: BackfillOpDetail[]
}

// --- Operations History ---

export interface OperationsHistoryItem {
  id: number
  artifactTechID: string
  artifactName: string
  artifactVersion: string
  artifactType: string
  packageID: string
  tenantID: number
  tenantName: string
  deliveryRequestID: number
  deliveryRequestName: string
  deliveryRuleName: string
  transportRequestNumber: string
  requestState: string
  importState: string
  deployState: string
  skipDeploy: boolean
  lastError: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface OperationsHistoryResponse {
  data: OperationsHistoryItem[]
  total: number
  page: number
  pageSize: number
}

export interface HistoryFilterOption {
  id: number
  name: string
}

export interface OperationsHistoryFilters {
  tenants: HistoryFilterOption[]
  artifactTypes: string[]
  deliveryRules: HistoryFilterOption[]
  operators: string[]
}

export interface OperationCondition {
  ID: number
  CreatedAt: string
  DeliveryRequestID: number
  ArtifactTenantOperationID: number
  State: 'Error' | 'Warn' | 'Success'
  Message: string
}