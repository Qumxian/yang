<template>
  <div class="app-layout">
    <!-- 背景装饰 (增加氛围感) -->
    <div class="bg-circle circle-1"></div>
    <div class="bg-circle circle-2"></div>

    <!-- 左侧侧边栏 -->
    <div class="sidebar">
      <div class="logo-section">
        <div class="logo-wrapper">
          <img src="@/assets/logo.png" alt="秧秧小助手" />
        </div>
        <span class="logo-text">秧秧小助手</span>
        <span class="logo-sub">协和医院·智能伴诊</span>
      </div>
      <div class="sidebar-footer">
        <button class="doctor-login-btn" @click="goToDoctorLogin">
          医生后台入口
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <div class="chat-container">
        <!-- 消息列表 -->
        <div class="message-list" ref="messageListRef">
          <TransitionGroup name="message-fade">
            <div v-for="(message, index) in messages" :key="index"
              :class="['message-row', message.isUser ? 'user-row' : 'bot-row']">

              <!-- 头像 -->
              <img :src="message.isUser ? userAvatar : botAvatar" class="avatar" />

              <!-- 消息气泡 -->
              <div :class="['bubble', message.isUser ? 'user-bubble' : 'bot-bubble']">
                <!-- 思考/打字动画 -->
                <div v-if="message.isThinking || (message.isTyping && !message.content)" class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>

                <!-- 消息内容 -->
                <div v-else class="content-text" v-html="formatContent(message.content)"></div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- 输入区域 (悬浮胶囊样式) -->
        <div class="input-area">
          <div class="input-wrapper">
            <el-input v-model="inputMessage" placeholder="请描述您的症状或疑问..." @keyup.enter="sendMessage" class="custom-input"
              clearable>
              <template #suffix>
                <el-button type="primary" @click="sendMessage" :disabled="isSending" class="send-btn" round>
                  发送
                </el-button>
              </template>
            </el-input>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import userAvatar from '@/assets/user-avatar.png'
import botAvatar from '@/assets/bot-avatar.png'
import { onMounted, ref, watch, nextTick } from 'vue'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
//import { useRouter } from 'vue-router'

const messageListRef = ref()
const isSending = ref(false)
const uuid = ref()
const inputMessage = ref('')
const messages = ref([])
//const router = useRouter()

const goToDoctorLogin = () => {
  // 根据实际情况选择跳转方式
  // 路由跳转 (推荐)
  //router.push('/doctor/dashboard')
  
  // 新窗口打开
  window.open('/doctor/dashboard', '_blank')
}


onMounted(() => {
  initUUID()
  watch(messages, () => scrollToBottom(), { deep: true })
  sendGreeting()
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      // 使用平滑滚动，体验更好
      messageListRef.value.scrollTo({
        top: messageListRef.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

const initUUID = () => {
  let storedUUID = localStorage.getItem('user_uuid')
  if (!storedUUID) {
    storedUUID = uuidToNumber(uuidv4())
    localStorage.setItem('user_uuid', storedUUID)
  }
  uuid.value = storedUUID
}

const uuidToNumber = (uuid) => {
  let number = 0
  for (let i = 0; i < uuid.length && i < 6; i++) {
    const hexValue = uuid[i]
    number = number * 16 + (parseInt(hexValue, 16) || 0)
  }
  return number % 1000000
}

// 简单格式化换行，保留原本逻辑
const formatContent = (text) => {
  return text ? text.replace(/\n/g, '<br>') : ''
}

const sendGreeting = () => {
  const greetingMsg = {
    isUser: false,
    content: '你好呀！👋 我是秧秧，北京协和医院的智能客服。\n\n我既可以作为你的医疗顾问，提供健康问题的建议，也可以作为你的医疗伴诊助手，帮你解决就诊过程中的问题哦～\n\n你可以问我关于健康咨询、疾病诊断、治疗方案、用药建议等问题！有啥需要帮助的，尽管说哈～🩺😊',
    isTyping: false,
    isThinking: false
  }
  messages.value.push(greetingMsg)
}

// 核心逻辑：完全参照你原来的写法，仅移除了导致报错的配置
const sendMessage = () => {
  if (!inputMessage.value.trim() || isSending.value) return

  const userMsg = {
    isUser: true,
    content: inputMessage.value.trim(),
    isTyping: false,
    isThinking: false
  }
  messages.value.push(userMsg)

  const botMsg = {
    isUser: false,
    content: '',
    isTyping: true,
    isThinking: true
  }
  messages.value.push(botMsg)

  const messageToSend = inputMessage.value.trim()
  inputMessage.value = ''
  isSending.value = true

  // 强制响应式更新 (保留你的原始逻辑)
  const tempMessages = [...messages.value]
  messages.value = tempMessages

  axios.post(
    '/api/xiaozhi/chat',
    { memoryId: uuid.value, message: messageToSend },
    {
      // ★★★ 关键修改：删除了 responseType: 'stream' ★★★
      // 浏览器默认 responseType 就是 text，这样 onDownloadProgress 才能正常工作且不报错
      onDownloadProgress: (e) => {
        try {
          const fullText = e.event.target.responseText
          if (fullText) {
            const lastMsg = messages.value[messages.value.length - 1]
            lastMsg.content = fullText
            lastMsg.isThinking = false
            // 触发更新
            messages.value = [...messages.value]
          }
        } catch (error) {
          console.error('处理流数据错误:', error)
        }
      }
    }
  )
    .then(() => {
      const lastMsg = messages.value[messages.value.length - 1]
      lastMsg.isTyping = false
    })
    .catch((error) => {
      console.error('请求错误:', error)
      const lastMsg = messages.value[messages.value.length - 1]
      lastMsg.content = '请求失败，请重试'
      lastMsg.isTyping = false
      lastMsg.isThinking = false
    })
    .finally(() => {
      isSending.value = false
    })
}
</script>

<style scoped>
/* 引入更现代的字体 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');

/* 全局布局 */
.app-layout {
  position: relative;
  display: flex;
  height: 100vh;
  font-family: 'Noto Sans SC', sans-serif;
  background: #f0f4f8;
  /* 更柔和的蓝灰背景 */
  color: #333;
  overflow: hidden;
}

/* 动效背景圆 */
.bg-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
}

.circle-1 {
  width: 300px;
  height: 300px;
  background: rgba(0, 166, 169, 0.15);
  /* 协和绿 */
  top: -50px;
  left: -50px;
}

.circle-2 {
  width: 250px;
  height: 250px;
  background: rgba(64, 158, 255, 0.15);
  bottom: -50px;
  right: -50px;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 1;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-wrapper {
  padding: 8px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 4px 15px rgba(0, 166, 169, 0.15);
  margin-bottom: 15px;
}

.logo-section img {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  display: block;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #008E91;
  /* 医疗深绿 */
}

.logo-sub {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 24px;
  /* 更大的圆角 */
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  position: relative;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
  display: flex;
  flex-direction: column;
}

.message-row {
  display: flex;
  margin-bottom: 24px;
  align-items: flex-start;
}

.user-row {
  flex-direction: row-reverse;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin: 0 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #fff;
}

/* 气泡样式优化 */
.bubble {
  max-width: 75%;
  padding: 14px 18px;
  border-radius: 18px;
  line-height: 1.6;
  font-size: 15px;
  position: relative;
  word-wrap: break-word;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
}

.user-bubble {
  background: linear-gradient(135deg, #00A6A9 0%, #008E91 100%);
  /* 渐变绿 */
  color: white;
  border-top-right-radius: 4px;
}

.bot-bubble {
  background: #F2F5F7;
  color: #333;
  border-top-left-radius: 4px;
}

/* ---------------- 动画效果 ---------------- */
/* 消息进场动画 */
.message-fade-enter-active {
  transition: all 0.4s ease;
}

.message-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

/* 思考中三个点跳动动画 */
.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #aaa;
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}

/* 输入区优化 */
.input-area {
  padding: 20px 30px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.input-wrapper {
  background: #fff;
  border-radius: 30px;
  /* box-shadow: 0 4px 12px rgba(0,0,0,0.05); */
}

/* 修改 Element Plus 输入框样式 */
.custom-input :deep(.el-input__wrapper) {
  border-radius: 25px;
  padding: 5px 20px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  background-color: #f9fafb;
}

.custom-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(0, 166, 169, 0.3) inset;
  /* 聚焦时的绿色光晕 */
  background-color: #fff;
}

.send-btn {
  background-color: #00A6A9 !important;
  /* 强制主题色 */
  border-color: #00A6A9 !important;
  font-weight: 600;
  padding: 10px 24px;
  height: auto;
}

.send-btn:hover {
  background-color: #008E91 !important;
}

/* 新增：侧边栏底部按钮样式 */
.sidebar {
  /* 确保侧边栏使用flex布局，让底部按钮自动下沉 */
  justify-content: space-between;
}

.sidebar-footer {
  width: 100%;
  padding: 0 20px 20px; /* 与侧边栏padding保持一致 */
  box-sizing: border-box;
}

.doctor-login-btn {
  width: 100%;
  padding: 10px 0;
  background-color: #00A6A9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.doctor-login-btn:hover {
  background-color: #008E91;
}
</style>