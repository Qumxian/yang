// 10.9 add
import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const service = axios.create({
  baseURL: '/api',
  timeout: 5000,
})

// 清理登录数据的函数
const clearAuthData = () => {
  localStorage.removeItem('doctor')
  localStorage.removeItem('doctor_token')
  localStorage.removeItem('doctor_info')
  sessionStorage.removeItem('doctor')
  sessionStorage.removeItem('doctor_token')
  sessionStorage.removeItem('doctor_info')
}

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    const doctorStr = localStorage.getItem('doctor')
    if (doctorStr) {
      try {
        const doctor = JSON.parse(doctorStr)
        if (doctor && doctor.token) {
          config.headers.Authorization = `Bearer ${doctor.token}`
        }
      } catch (e) {
        console.error('解析用户信息失败', e)
        clearAuthData()
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    const res = response.data
    return res
  },
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData()
      ElMessage.error('登录已过期，请重新登录')
      router.push('/doctor/login')
    }
    return Promise.reject(error)
  }
)

export default service