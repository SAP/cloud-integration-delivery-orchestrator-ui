// Transport (Request) Phase
export type RequestState =
  | 'NOT_REQUESTED'
  | 'REQUESTING'
  | 'READY'
  | 'FAILED'
  | 'TR_GENERATING'  // background TR generation in progress
  | 'TR_FAILED';     // TR generation failed; manual retry available

// Import Phase
export type ImportState =
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'IMPORT_DISABLED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'COMPLETE';        // (You can drop PARTIAL if you remove it in Go)

// Deploy Phase
export type DeployState =
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'DEPLOY_DISABLED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'COMPLETE';

// Aggregate Status (public surface)
export type AggregateStatus =
  | 'UNKNOWN'
  | 'PENDING'
  | 'WAITING_APPROVAL'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'AWAITING_IMPORT' // can import
  | 'IMPORTING'
  | 'IMPORT_FAILED' // can re-import
  | 'IMPORTED'
  | 'AWAITING_DEPLOY' // can deploy
  | 'DEPLOYING'
  | 'DEPLOY_FAILED' // can re-deploy
  | 'DEPLOYED'
  | 'CANCELED'
  | 'Error';  // error status

// Condition Types
export type ConditionType =
  | 'Error'
  | 'Warn'
  | 'Success'

// "Information" | "Positive" | "Negative" | "Critical" | "ColorSet1" | "ColorSet2"
export const conditionTypeToDesign = (type: ConditionType): string => {
  switch (type) {
    case 'Error':
      return 'Negative'
    case 'Warn':
      return 'Critical'
    case 'Success':
      return 'Positive'
    default:
      return 'Neutral'
  }
}

  export type Ui5Design = 
    |"Set1" | "Set2" | "Neutral" | "Information" | "Positive" | "Negative" | "Critical"

// Maps AggregateStatus to a UI5 design (used by ui5-tag, ui5-badge, etc.)
// Data-driven mapping for AggregateStatus → Ui5Design
// Functional helpers
// Minimal, data-driven sets per design
const DESIGN_SETS = {
  Positive: new Set<AggregateStatus>(['DEPLOYED']),
  Negative: new Set<AggregateStatus>(['FAILED', 'IMPORT_FAILED', 'DEPLOY_FAILED', 'Error']),
  Information: new Set<AggregateStatus>(['IN_PROGRESS', 'IMPORTING', 'DEPLOYING']),
  Critical: new Set<AggregateStatus>(['AWAITING_IMPORT', 'AWAITING_DEPLOY', 'WAITING_APPROVAL', 'IMPORTED', 'CANCELED']),
  Neutral: new Set<AggregateStatus>(['UNKNOWN', 'PENDING'])
} as const

export const aggregateStatusToUi5Design = (status: AggregateStatus): Ui5Design =>
  (Object.entries(DESIGN_SETS).find(([, set]) => set.has(status))?.[0] as Ui5Design) ?? 'Neutral'

export const CANCELLABLE_STATUSES = new Set<AggregateStatus>([
  'PENDING', 'WAITING_APPROVAL', 'AWAITING_IMPORT',
  'IMPORT_FAILED', 'AWAITING_DEPLOY', 'DEPLOY_FAILED'
])

export const STATUS_FILTER_GROUPS = {
  All: null,
  Completed: new Set<AggregateStatus>(['DEPLOYED']),
  'In Progress': new Set<AggregateStatus>([
    'PENDING', 'WAITING_APPROVAL', 'AWAITING_IMPORT', 'IMPORTING',
    'AWAITING_DEPLOY', 'DEPLOYING', 'IN_PROGRESS', 'IMPORTED'
  ]),
  Failed: new Set<AggregateStatus>(['IMPORT_FAILED', 'DEPLOY_FAILED', 'FAILED', 'Error']),
  Canceled: new Set<AggregateStatus>(['CANCELED'])
} as const

export type StatusFilterKey = keyof typeof STATUS_FILTER_GROUPS