import axios from 'axios'
import { HTTP_ERROR_FALLBACKS, type HttpErrorCode } from './httpErrorMessages'
import { dedupedToastError } from './toastDedupe'

/**
 * Structured error rejected by the HTTP response interceptor.
 * Callers that set `silentError: true` in request config receive this
 * without a global toast, and can handle the error inline (e.g. in a dialog).
 */
export interface HttpError {
  /** Human-readable error message (from backend `message` field, or fallback) */
  message: string
  /** Machine-readable error classification */
  code: HttpErrorCode
  /** Full response body from the backend (preserves structured data like `errors`) */
  data?: any
  /** HTTP status code */
  status?: number
  /** Hint: whether the caller could reasonably retry this request */
  retryable: boolean
}

// Extend Axios request config to support the silentError flag.
// When set to true, the global error toast is suppressed and the caller
// is responsible for displaying the error to the user.
declare module 'axios' {
  export interface AxiosRequestConfig {
    silentError?: boolean
  }
}

const service = axios.create({})

// Check if session is expired and redirect to logout
const checkSessionExpired = (error: any) => {
  if (error?.response?.status === 401) {
    window.$toast?.warning('Session expired. Redirecting to login...')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
    return true
  }
  return false
}

/**
 * Classify an axios error into a machine-readable code + retryable hint.
 * Priority: backend `code` field > HTTP status mapping.
 */
export function classify(error: any): { code: HttpErrorCode; retryable: boolean } {
  if (!error.response) return { code: 'NETWORK', retryable: true }

  const status = error.response.status
  const data = error.response.data

  // Backend may include a machine-readable `code` field (RFC 019 §6)
  const backendCode: string | undefined =
    (typeof data === 'object' && data !== null) ? data.code : undefined
  if (backendCode && backendCode in HTTP_ERROR_FALLBACKS) {
    const code = backendCode as HttpErrorCode
    return {
      code,
      retryable: code === 'GATEWAY_UNAVAILABLE' || code === 'TOO_MANY_REQUESTS',
    }
  }

  // Fallback: classify by HTTP status
  if (status === 401) return { code: 'UNAUTHORIZED', retryable: false }
  if (status === 403) return { code: 'FORBIDDEN', retryable: false }
  if (status === 404) return { code: 'NOT_FOUND', retryable: false }
  if (status === 409) return { code: 'CONFLICT', retryable: false }
  if (status === 429) return { code: 'TOO_MANY_REQUESTS', retryable: true }
  if (status === 400 || status === 422) return { code: 'INVALID_INPUT', retryable: false }

  // Gateway errors: approuter / reverse proxy cannot reach backend
  if (status === 502 || status === 503 || status === 504)
    return { code: 'GATEWAY_UNAVAILABLE', retryable: true }

  // 5xx with JSON body that has `message` → backend business error
  if (status >= 500 && typeof data === 'object' && data?.message)
    return { code: 'BACKEND_ERROR', retryable: false }

  return { code: 'UNKNOWN', retryable: false }
}

/**
 * Pick the best human-readable message.
 * Priority: backend JSON `.message` > fallback table > axios default string.
 */
export function pickMessage(error: any, code: HttpErrorCode): string {
  const data = error.response?.data
  const isJsonBody = data && typeof data === 'object' && typeof data.message === 'string'
  if (isJsonBody) return data.message
  return HTTP_ERROR_FALLBACKS[code]
}

service.interceptors.request.use(
  config => config,
  error => {
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }
    window.$toast?.error(`request failed: ${error}`)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.message) window.$toast?.info(res.message)
    return res.data
  },
  (error) => {
    // Check for session expiry first
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }

    const { code, retryable } = classify(error)
    const message = pickMessage(error, code)

    const httpError: HttpError = {
      message,
      code,
      data: error.response?.data,
      status: error.response?.status,
      retryable,
    }

    // Only show global toast if silentError is not set on the request config
    if (!error.config?.silentError) {
      dedupedToastError(`${code}:${message}`, message)
    }

    return Promise.reject(httpError)
  }
)

export default service
