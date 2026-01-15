// App.vue
<script setup>
import { onMounted, onUnmounted } from 'vue'
import { doctorWebSocket } from '@/utils/websocket'

// 页面加载时检查登录状态并连接 WebSocket
onMounted(() => {
  const doctorInfo = localStorage.getItem('doctor')
  if (doctorInfo) {
    try {
      const user = JSON.parse(doctorInfo)
      console.log('应用启动，自动连接 WebSocket，用户ID:', user.id)
      doctorWebSocket.connect(String(user.id))
    } catch (err) {
      console.error('解析用户信息失败:', err)
    }
  }
})

// 监听页面可见性变化（标签页切换时尝试重连）
onMounted(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // 页面重新可见时，如果未连接则尝试重连
      const doctorInfo = localStorage.getItem('doctor')
      if (doctorInfo && !doctorWebSocket.isConnected) {
        const user = JSON.parse(doctorInfo)
        console.log('页面重新可见，重新连接 WebSocket')
        doctorWebSocket.connect(String(user.id))
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
})
</script>

<template>
  <router-view />
</template>

<style>
html,
body {
  overflow: hidden;
}
</style>