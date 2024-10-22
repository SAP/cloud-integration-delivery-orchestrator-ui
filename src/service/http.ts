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
      window.$message.error(`request failed: ${error}`)
      Promise.reject(error)
    }
)

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.msg) window.$message.info(res.msg)
    return res.result
  },
  (error) => {
    window.$message.error(error.response.data.msg)
    return Promise.reject(error.response.data.msg)
  }
)

export default service
