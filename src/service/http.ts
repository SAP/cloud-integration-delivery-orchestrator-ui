import axios from 'axios'

/**
 * Structured error rejected by the HTTP response interceptor.
 * Callers that set `silentError: true` in request config receive this
 * without a global toast, and can handle the error inline (e.g. in a dialog).
 */
export interface HttpError {
  /** Human-readable error message (from backend `error` or `msg` field, or Axios default) */
  message: string
  /** Full response body from the backend (preserves structured data like `result`) */
  data?: any
  /** HTTP status code */
  status?: number
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
    window.$message.warning(
      'Session expired. Redirecting to login...',
      {
        closable: true,
        duration: 3000
      }
    )
    // Reload page to trigger re-login
    setTimeout(() => {
      window.location.reload()
    }, 1000)
    return true
  }
  return false
}

service.interceptors.request.use(
  config => {
    return config
  },
  error => {
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }
    window.$message.error(`request failed: ${error}`,
      {
        closable: true,
        duration: 1000*30
      }
    )
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.msg) window.$message.info(res.msg)
    return res.result
  },
  (error) => {
    // Check for session expiry first
    if (checkSessionExpired(error)) {
      return Promise.reject(error)
    }

    const message = error.response?.data?.msg ?? error.response?.data?.error ?? error.message
    const httpError: HttpError = {
      message,
      data: error.response?.data,
      status: error.response?.status,
    }

    // Only show global toast if silentError is not set on the request config
    if (!error.config?.silentError) {
      window.$message.error(
        message,
        {
          closable: true,
          duration: 1000*30
        }
      )
    }

    return Promise.reject(httpError)
  }
)

export default service
