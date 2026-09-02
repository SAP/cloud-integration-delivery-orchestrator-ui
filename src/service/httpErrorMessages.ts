export type HttpErrorCode =
  | 'NETWORK'
  | 'GATEWAY_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_INPUT'
  | 'TOO_MANY_REQUESTS'
  | 'BACKEND_ERROR'
  | 'SNAPSHOT_ORPHANED'
  | 'UNKNOWN'

export const HTTP_ERROR_FALLBACKS: Record<HttpErrorCode, string> = {
  NETWORK: 'Network unreachable. Please check your connection.',
  GATEWAY_UNAVAILABLE: 'Service is temporarily unavailable. Please retry in a moment.',
  UNAUTHORIZED: 'Session expired. Redirecting to login...',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The operation conflicts with the current state.',
  INVALID_INPUT: 'Invalid request.',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down.',
  BACKEND_ERROR: 'An internal server error occurred.',
  SNAPSHOT_ORPHANED: 'This version is no longer available in the current repository. Re-sync to rebuild it.',
  UNKNOWN: 'An unexpected error occurred.',
}
