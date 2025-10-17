// Transport (Request) Phase
export type RequestState =
  | 'NOT_REQUESTED'
  | 'REQUESTING'
  | 'READY'
  | 'FAILED';

// Import Phase
export type ImportState =
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'COMPLETE';        // (You can drop PARTIAL if you remove it in Go)

// Deploy Phase
export type DeployState =
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'COMPLETE'
  | 'ROLLBACKING'
  | 'ROLLED_BACK';

// Aggregate Status (public surface)
export type AggregateStatus =
  | 'UNKNOWN'
  | 'PENDING'
  | 'WAITING_APPROVAL'
  | 'AWAITING_IMPORT' // can import
  | 'IMPORTING'
  | 'IMPORT_FAILED' // can re-import
  | 'IMPORTED'
  | 'AWAITING_DEPLOY' // can deploy
  | 'DEPLOYING'
  | 'DEPLOY_FAILED' // can re-deploy
  | 'DEPLOYED'
  | 'ROLLBACKING'
  | 'ROLLED_BACK'
  | 'CANCELED'
  | 'Error';  // error status

// Condition Types
export type ConditionType =
  | 'TransportReady'
  | 'ImportComplete'
  | 'DeployComplete'
  | 'PartialProgress'
  | 'RetryScheduled'
  | 'RollbackInProgress'
  | 'Canceled'
  | 'LastFailurePhase'
  | 'LastFailureReason';