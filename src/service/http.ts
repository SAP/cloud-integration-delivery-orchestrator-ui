import axios from 'axios'

const service = axios.create({})

// service.interceptors.request.use(
//     config => {
//         if (config.method === 'post' || config.method === 'put' || config.method === 'delete') {
//             config.headers['Content-Type'] = 'application/json'
//             // 序列化
//             config.data = JSON.stringify(config.data)
//             if (config.type === 'form') {
//                 config.headers['Content-Type'] = 'multipart/form-data'
//             }
//         }
//         return config
//     },
//     error => {
//         Promise.reject(error)
//     }
// )

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
