import axios from 'axios'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
})

// 请求拦截器 — 自动附加 JWT token
request.interceptors.request.use(
  (config) => {
    // 钉钉免登后 token 存入 localStorage，拦截器自动附加 Authorization 头
    const token = localStorage.getItem('workLoad_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器 — 统一错误处理
request.interceptors.response.use(
  (response) => {
    const data = response.data
    // 钉钉 JSAPI 验证相关接口不走 code 判断
    if (data.code !== undefined && data.code !== 200) {
      // token 过期或无效时清除本地缓存
      if (data.code === 401) {
        localStorage.removeItem('workLoad_token')
        console.warn('登录已过期，请重新登录')
      }
      return Promise.reject(new Error(data.msg || '请求失败'))
    }
    return data
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('workLoad_token')
          console.warn('登录已过期')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`请求错误: ${error.response.status}`)
      }
    }
    return Promise.reject(error)
  },
)

export default request
