import axios from 'axios'

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
    const content = error.response?.data?.msg ?? error.response?.data?.error ?? error.message
    window.$message.error(
      content,
      {
        closable: true,
        duration: 1000*30
      }
    )
    return Promise.reject(content)
  }
)

export default service
