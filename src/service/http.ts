import axios from 'axios'
import { useUserInfoStore } from './api'

const service = axios.create({})

service.interceptors.request.use(
    config => {
      const userInfo = useUserInfoStore().user
      if (!userInfo) throw new Error('User not logged in')
      config.headers['X-User-Email'] = userInfo.email
      return config
    },
    error => {
      window.$message.error(`request failed: ${error}`,
        {
          closable: true,
          duration: 1000*30
        }
      )
      Promise.reject(error)
    }
)

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.msg) window.$message.info(res.msg)
    if (res.status) window.$message.info(res.status)
    return res.result
  },
  (error) => {
    const content = error.response.data.msg ? error.response.data.msg : error.response.data.error
    window.$message.error(
      content,
      {
        closable: true,
        duration: 1000*30
      }
    )
    return Promise.reject(error.response.data.msg)
  }
)

export default service
