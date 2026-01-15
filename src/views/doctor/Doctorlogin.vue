<template>
  <div class="login-page">
    <!-- 背景网格 -->
    <div class="grid-bg"></div>
    
    <!-- ECG 动态画布 -->
    <canvas id="ecg-canvas"></canvas>

    <!-- 登录卡片 -->
    <div class="login-container">
      <div class="medical-icon">✚</div>
      <h1>秧秧小助手</h1>
      <h2>医生后台登录 | Doctor Portal</h2>
      
      <!-- 提示区域 -->
      <el-alert
        v-if="showLoginPrompt"
        title="请先登录"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff;"
        class="login-alert"
      />
      
      <el-form :model="form" @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <el-input 
            v-model="form.account" 
            placeholder="请输入账号" 
            required
            class="custom-input"
            :class="{ 'input-focused': form.account }"
          />
          <label class="input-label">用户名 / Username</label>
        </div>
        
        <div class="input-group">
          <el-input 
            v-model="form.password" 
            type="password" 
            placeholder="请输入密码" 
            required
            class="custom-input"
            :class="{ 'input-focused': form.password }"
          />
          <label class="input-label">密码 / Password</label>
        </div>
        
        <el-form-item class="btn-wrapper">
          <el-button 
            type="primary" 
            @click="handleLogin" 
            class="btn-login"
            :loading="isLoading"
          >
            {{ isLoading ? '身份验证中...' : '立即登录' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="footer-links">
        <a href="#">忘记密码?</a>
        <a href="#">联系IT部门</a>
      </div>
    </div>

    <!-- 动态生成的粒子元素 -->
    <div v-for="i in 15" :key="i" class="data-point" 
      :style="{
        width: (Math.random() * 5 + 2) + 'px',
        height: (Math.random() * 5 + 2) + 'px',
        left: (Math.random() * 100) + 'vw',
        top: (Math.random() * 100) + 'vh',
        background: Math.random() > 0.5 ? '#00f260' : '#0575E6',
        animationDuration: (Math.random() * 10 + 10) + 's'
      }">
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import request from '@/utils/request'
import { doctorWebSocket } from '@/utils/websocket'

const router = useRouter()
const route = useRoute()
const showLoginPrompt = ref(false)
const isLoading = ref(false)
let animationFrameId = null

const form = reactive({
  account: '',
  password: ''
})

// 检查是否是从路由守卫跳转过来的
onMounted(() => {
  // 路由参数判断是否显示提示
  if (route.query.redirect) {
    showLoginPrompt.value = true
  }
  
  // 初始化心电图画布
  initECGCanvas()
})

// 销毁时清除动画帧
onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})

// 登录处理逻辑
const handleLogin = async () => {
  if (!form.account || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  
  isLoading.value = true
  
  try {
    const res = await request.post('/doctor/login', form)
    console.log('登录响应:', res)
    
    if (res.code === 200) {
      ElMessage.success('登录成功')
      // 存储 token + 医生信息
      const doctorInfo = {
        ...res.data.doctor,
        token: res.data.token
      }
      localStorage.setItem('doctor', JSON.stringify(doctorInfo))
      
      // 登录成功后立即连接 WebSocket
      console.log('登录成功，连接 WebSocket，用户ID:', doctorInfo.id)
      doctorWebSocket.connect(String(doctorInfo.id))
      
      // 跳转到仪表盘
      router.push('/doctor/dashboard')
    } else {
      ElMessage.error(res.msg || '登录失败')
    }
  } catch (err) {
    console.error('登录请求失败:', err)
    ElMessage.error('请求失败')
  } finally {
    isLoading.value = false
  }
}

// 初始化心电图画布动画
const initECGCanvas = () => {
  const canvas = document.getElementById('ecg-canvas')
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  let width = window.innerWidth
  let height = window.innerHeight
  
  // 设置画布尺寸
  const resize = () => {
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = width
    canvas.height = height
    
    // 绘制背景
    ctx.fillStyle = '#0f2027'
    ctx.fillRect(0, 0, width, height)
  }
  
  window.addEventListener('resize', resize)
  resize()
  
  // 心电图绘制变量
  let x = 0
  let y = height / 2
  let lastX = 0
  let lastY = height / 2
  const speed = 4
  
  // 绘制心电图
  const drawECG = () => {
    // 淡出效果
    ctx.fillStyle = 'rgba(15, 32, 39, 0.05)'
    ctx.fillRect(0, 0, width, height)
    
    // 设置线条样式
    ctx.strokeStyle = '#00f260'
    ctx.shadowBlur = 10
    ctx.shadowColor = '#00f260'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    
    // 开始绘制路径
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    
    x += speed
    
    // 模拟心电图波形
    if (x > width * 0.2 && x < width * 0.25) {
      y = (height / 2) - Math.random() * 10 // P波
    } else if (x > width * 0.25 && x < width * 0.27) {
      y = (height / 2) + 20 // Q波
    } else if (x > width * 0.27 && x < width * 0.30) {
      y = (height / 2) - 150 // R波（高峰）
    } else if (x > width * 0.30 && x < width * 0.33) {
      y = (height / 2) + 30 // S波
    } else if (x > width * 0.35 && x < width * 0.40) {
      y = (height / 2) - 15 // T波
    } else {
      y = (height / 2) + (Math.random() * 4 - 2) // 静息电位
    }
    
    // 重置画布位置
    if (x > width) {
      x = 0
      lastX = 0
    }
    
    // 绘制线条
    ctx.lineTo(x, y)
    ctx.stroke()
    
    // 更新坐标
    lastX = x
    lastY = y
    
    animationFrameId = requestAnimationFrame(drawECG)
  }
  
  drawECG()
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&display=swap');

.login-page {
  font-family: 'Noto Sans SC', sans-serif;
  overflow: hidden;
  background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  position: relative;
}

/* 背景网格 */
.grid-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(0, 255, 213, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 213, 0.05) 1px, transparent 1px);
  background-size: 50px 50px;
  z-index: 0;
}

/* ECG画布 */
#ecg-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  opacity: 0.4;
}

/* 登录容器 */
.login-container {
  position: relative;
  z-index: 10;
  width: 400px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
  text-align: center;
  transition: transform 0.3s ease;
}

.login-container:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0, 255, 213, 0.1);
}

/* 医疗十字图标 */
.medical-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #00f260, #0575E6);
  border-radius: 15px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 30px;
  color: white;
  box-shadow: 0 0 20px rgba(5, 117, 230, 0.4);
  position: relative;
}

.medical-icon::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 15px;
  border: 2px solid rgba(255,255,255,0.5);
  animation: pulse-border 2s infinite;
}

h1 {
  font-size: 24px;
  margin-bottom: 5px;
  letter-spacing: 2px;
  font-weight: 700;
}

h2 {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 30px;
  font-weight: 300;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* 输入框组 */
.input-group {
  position: relative;
  margin-bottom: 25px;
  text-align: left;
}

.input-label {
  position: absolute;
  top: 15px;
  left: 15px;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  pointer-events: none;
  transition: 0.3s ease;
  z-index: 10;
}

.custom-input {
  width: 100%;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 8px !important;
  color: #fff !important;
  outline: none !important;
  font-size: 16px !important;
  transition: 0.3s !important;
  --el-input-text-color: #fff !important;
  --el-input-bg-color: transparent !important;
  --el-input-border-color: rgba(255, 255, 255, 0.1) !important;
  --el-input-hover-border-color: #00f260 !important;
  --el-input-focus-border-color: #00f260 !important;
}

.custom-input.input-focused,
.custom-input:not(:placeholder-shown) {
  border-color: #00f260 !important;
  background: rgba(0, 0, 0, 0.4) !important;
  box-shadow: 0 0 10px rgba(0, 242, 96, 0.2) !important;
}

.custom-input.input-focused ~ .input-label,
.custom-input:not(:placeholder-shown) ~ .input-label {
  top: -10px;
  left: 5px;
  font-size: 12px;
  color: #00f260;
  background: #1b2e36;
  padding: 0 5px;
  border-radius: 3px;
}

/* 登录按钮 */
.btn-wrapper {
  margin-bottom: 0;
}

.btn-login {
  width: 100%;
  padding: 15px !important;
  background: linear-gradient(90deg, #0575E6, #00f260) !important;
  border: none !important;
  border-radius: 8px !important;
  color: white !important;
  font-size: 16px !important;
  font-weight: bold !important;
  letter-spacing: 2px !important;
  transition: 0.3s !important;
  position: relative !important;
  overflow: hidden !important;
  height: auto !important;
}

.btn-login:hover {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(0, 242, 96, 0.4);
}

/* 底部链接 */
.footer-links {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.footer-links a {
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  transition: 0.3s;
}

.footer-links a:hover {
  color: #00f260;
}

/* 漂浮粒子 */
.data-point {
  position: absolute;
  background: #00f260;
  border-radius: 50%;
  opacity: 0.6;
  animation: float 10s infinite;
  z-index: 0;
}

/* 登录提示框样式覆盖 */
.login-alert {
  --el-alert-bg-color: rgba(0,0,0,0.2) !important;
  --el-alert-border-color: rgba(255,255,255,0.1) !important;
  --el-alert-title-color: #fff !important;
}

/* 动画定义 */
@keyframes pulse-border {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.4); opacity: 0; }
}

@keyframes float {
  0% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-20px) translateX(10px);
  }
  100% {
    transform: translateY(0) translateX(0);
  }
}

/* 适配移动端 */
@media (max-width: 480px) {
  .login-container {
    width: 90%;
    padding: 30px 20px;
  }
}
</style>