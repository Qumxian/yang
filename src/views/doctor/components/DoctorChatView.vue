<template>
  <div class="doctor-chat-container">
    <!-- 左侧医生列表 -->
    <div class="doctor-list">
      <div class="list-header">
        <h3>聊天列表</h3>
      </div>
      <div class="doctor-scroll-area">
        <div class="doctor-item" v-for="doctor in doctorList" :key="doctor.id"
          :class="{ active: currentChatId === doctor.id }" @click="switchChat(doctor.id)">
          <div class="avatar-container">
            <el-avatar :size="60" class="avatar">
              <img :src="doctor.avatar" alt="医生头像" :onerror="defaultAvatar" class="avatar-img" />
            </el-avatar>
            <!-- 未读消息红点 -->
            <div class="unread-badge" v-if="getUnreadCount(doctor.id) > 0 && currentChatId !== doctor.id">
              {{ getUnreadCount(doctor.id) > 99 ? '99+' : getUnreadCount(doctor.id) }}
            </div>
          </div>
          <div class="doctor-info">
            <div class="doctor-name">{{ doctor.realName }}</div>
            <div class="doctor-dept">{{ doctor.department }}</div>
            <div class="last-message">{{ getLastMessage(doctor.id) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-area" v-if="currentChatId">
      <div class="chat-header">
        <el-avatar :size="38">
          <img :src="currentDoctor.avatar" alt="医生头像" :onerror="defaultAvatar" class="avatar-img" />
        </el-avatar>
        <div class="header-info">
          <div class="name">{{ currentDoctor.realName }}</div>
          <div class="dept">{{ currentDoctor.department }}</div>
        </div>
      </div>

      <div class="message-container" ref="messageContainer">
        <div 
          v-for="(msg, index) in currentMessages" 
          :key="index"
          class="message-wrapper"
        >
          <!-- 他人消息：头像左 + 气泡左 + 时间左 -->
          <div class="message left-message" v-if="!msg.isSelf">
            <div class="avatar-wrapper">
              <el-avatar :size="32" class="msg-avatar">
                <img :src="msg.avatar" alt="发送者头像" :onerror="defaultAvatar" class="avatar-img" />
              </el-avatar>
            </div>
            <div class="message-content-wrapper">
              <div class="msg-content">
                <div class="content">{{ msg.content }}</div>
              </div>
              <div class="time left-time">{{ formatTime(msg.sendTime) }}</div>
            </div>
          </div>

          <!-- 自己消息：气泡右 + 头像右 + 时间右 -->
          <div class="message right-message" v-else>
            <div class="message-content-wrapper">
              <div class="msg-content">
                <div class="content">{{ msg.content }}</div>
                <!-- 发送状态提示 -->
                <div v-if="msg.isSending" class="send-status sending">
                  <i class="el-icon-loading"></i> 发送中...
                </div>
                <div v-if="msg.sendFailed" class="send-status failed">
                  <i class="el-icon-error"></i> 发送失败
                </div>
              </div>
              <div class="time right-time">{{ formatTime(msg.sendTime) }}</div>
            </div>
            <div class="avatar-wrapper">
              <el-avatar :size="32" class="msg-avatar">
                <img :src="msg.avatar" alt="发送者头像" :onerror="defaultAvatar" class="avatar-img" />
              </el-avatar>
            </div>
          </div>
        </div>

        <div class="empty-message" v-if="currentMessages.length === 0">
          暂无聊天记录，开始对话吧～
        </div>
      </div>

      <div class="input-area">
        <el-input v-model="inputContent" placeholder="输入消息..." @keyup.enter="sendMessage" clearable class="msg-input">
          <template #suffix>
            <el-button type="primary" @click="sendMessage" :disabled="!inputContent.trim()">
             发送
            </el-button>
          </template>
        </el-input>
      </div>
    </div>

    <div class="empty-state" v-else>
      <el-empty description="请选择用户进行聊天" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, onUnmounted, watch, onActivated } from 'vue'
import { ElMessage, ElEmpty, ElAvatar} from 'element-plus'
import request from '@/utils/request'
import { format, parseISO, isToday, isYesterday, differenceInDays } from 'date-fns'
import router from '@/router'
import { doctorWebSocket } from '@/utils/websocket'

// 状态管理（统一ID为字符串类型）
const doctorList = ref([])
const currentChatId = ref('')
const inputContent = ref('')
const chatRecords = ref({})
const currentUser = ref({ id: '', realName: '', avatar: '' })
const messageContainer = ref(null)
const loadingHistory = ref(false)
const unreadCounts = ref({}) // 存储未读消息数量（key: 字符串ID）

// 计算属性（字符串匹配ID）
const currentDoctor = computed(() => {
  return doctorList.value.find(doctor => String(doctor.id) === currentChatId.value) || {}
})

const currentMessages = computed(() => {
  return chatRecords.value[currentChatId.value] || []
})

// 监听当前聊天ID变化，标记已读
watch(currentChatId, (newChatId, oldChatId) => {
  if (newChatId && newChatId !== oldChatId) {
    // 切换聊天时标记之前的聊天为已读
    markAsRead(newChatId)
  }
})

// WebSocket 消息处理器
const handleWebSocketMessage = (type, data) => {
  console.log('收到WebSocket消息类型:', type, '数据:', data)
  
  switch (type) {
    case 'message':
      // 处理聊天消息
      if (data.type) {
        // 标准格式：{ type: 'chatMessage/unreadUpdate', data: {} }
        switch (data.type) {
          case 'chatMessage':
            handleChatMessage(data.data)
            break
          case 'unreadUpdate':
            handleUnreadUpdate(data.data)
            break
          default:
            console.warn('未知消息类型:', data.type)
        }
      } else if (data.senderId && data.content) {
        // 兼容：直接返回聊天消息体
        handleChatMessage(data)
      } else if (data.senderId !== undefined && data.unreadCount !== undefined) {
        // 兼容：直接返回未读更新体
        handleUnreadUpdate(data)
      } else {
        console.warn('无法识别的消息格式:', data)
      }
      break
    case 'connected':
      console.log('WebSocket 已连接')
      // 连接成功后同步未读计数
      refreshUnreadCounts()
      break
    case 'disconnected':
      console.log('WebSocket 已断开')
      ElMessage.info('聊天连接已断开，正在重连...')
      break
    case 'error':
      console.error('WebSocket 错误:', data)
      ElMessage.warning('实时聊天连接异常，正在尝试重连...')
      break
  }
}

// 初始化
onMounted(async () => {
  const doctorStr = localStorage.getItem('doctor')
  if (!doctorStr) {
    router.push('/doctor/login')
    return
  }
  
  await fetchCurrentUser()
  await fetchDoctorList()
  await refreshUnreadCounts() // 先获取未读计数，再加载历史
  await loadAllChatHistories()
  await initUnreadCount()
  
  // 注册 WebSocket 处理器并连接
  doctorWebSocket.addMessageHandler(handleWebSocketMessage)
})

// 组件激活时（切换回来时）刷新数据
onActivated(async () => {
  console.log('聊天模块激活，刷新未读计数')
  await refreshUnreadCounts()
})

onUnmounted(() => {
  // 只移除处理器，不关闭连接
  doctorWebSocket.removeMessageHandler(handleWebSocketMessage)
})

// 刷新未读计数（从服务器获取最新状态）
const refreshUnreadCounts = async () => {
  try {
    const res = await request.get('/doctor/chat/unreadCount')
    if (res.code === 200 && res.data) {
      // 后端返回的key是Long，转为字符串存储
      const stringKeyCounts = {}
      Object.entries(res.data).forEach(([key, value]) => {
        stringKeyCounts[String(key)] = value
      })
      unreadCounts.value = stringKeyCounts
      console.log('刷新未读消息数量：', unreadCounts.value)
    } else {
      console.error('刷新未读消息失败：', res.msg)
    }
  } catch (err) {
    console.error('刷新未读消息失败：', err)
  }
}

// 初始化未读计数（调用后端接口）
const initUnreadCount = async () => {
  try {
    await request.get('/doctor/chat/initUnread')
    console.log('未读计数初始化成功')
  } catch (err) {
    console.error('初始化未读计数失败：', err)
  }
}

// 获取当前登录医生信息（ID转为字符串）
const fetchCurrentUser = async () => {
  try {
    const res = await request.get('/doctor/info')
    if (res.code === 200 && res.data) {
      currentUser.value = {
        id: String(res.data.id), // 强制转为字符串
        realName: res.data.realName,
        avatar: res.data.avatar
      }
    } else {
      ElMessage.error(res.msg || '获取个人信息失败')
    }
  } catch (err) {
    console.error('获取个人信息失败', err)
  }
}

// 获取医生列表（所有ID转为字符串）
const fetchDoctorList = async () => {
  try {
    const res = await request.get('/doctor/chat/doctorList')
    if (res.code === 200 && res.data) {
      // 遍历转为字符串ID（兼容后端返回的数字ID）
      doctorList.value = res.data.map(doctor => ({
        ...doctor,
        id: String(doctor.id)
      }))
    } else {
      ElMessage.error(res.msg || '获取聊天列表失败')
    }
  } catch (err) {
    console.error('获取医生列表失败', err)
    ElMessage.error('获取聊天列表失败')
  }
}

// 加载所有医生的聊天历史（字符串ID）
const loadAllChatHistories = async () => {
  if (loadingHistory.value) return
  loadingHistory.value = true
  
  try {
    const promises = doctorList.value.map(doctor => 
      loadChatHistory(doctor.id) // 字符串ID
    )
    await Promise.all(promises)
    console.log('所有医生的聊天记录加载完成')
  } catch (err) {
    console.error('加载聊天记录失败：', err)
  } finally {
    loadingHistory.value = false
  }
}

// 切换聊天对象（字符串ID传递）
const switchChat = async (doctorId) => {
  currentChatId.value = doctorId // 字符串ID
  // 如果还没有加载过该医生的聊天记录，则加载
  if (!chatRecords.value[doctorId]) {
    await loadChatHistory(doctorId)
  }
  
  // 标记为已读
  await markAsRead(doctorId)
  
  nextTick(() => scrollToBottom())
}

// 标记消息为已读
const markAsRead = async (doctorId) => {
  if (!doctorId) return
  
  try {
    await request.post('/doctor/chat/markAsRead', {}, {
      params: { senderId: doctorId }
    })
    // 本地同步更新未读计数
    unreadCounts.value[doctorId] = 0
    console.log(`标记医生 ${doctorId} 的消息为已读`)
  } catch (err) {
    console.error('标记已读失败:', err)
  }
}

// 加载聊天历史（字符串ID传递）
const loadChatHistory = async (targetDoctorId) => {
  // 避免重复加载
  if (chatRecords.value[targetDoctorId] !== undefined) return
  
  // 临时标记为加载中
  chatRecords.value[targetDoctorId] = null
  
  try {
    const res = await request.get('/doctor/chat/history', {
      params: { targetDoctorId: targetDoctorId } // 字符串ID，后端自动转Long
    })
    
    if (res.code === 200) {
      // 统一消息中的senderId为字符串
      const formattedMessages = (res.data || []).map(msg => ({
        ...msg,
        senderId: String(msg.senderId),
        id: String(msg.id)
      }))
      chatRecords.value[targetDoctorId] = formattedMessages
      console.log(`医生 ${targetDoctorId} 的聊天历史加载成功，共 ${formattedMessages.length} 条`)
    } else {
      chatRecords.value[targetDoctorId] = []
      console.warn(`加载医生 ${targetDoctorId} 的聊天记录失败：`, res.msg)
    }
  } catch (err) {
    chatRecords.value[targetDoctorId] = []
    console.error(`加载医生 ${targetDoctorId} 的聊天历史失败：`, err)
  }
}

// 发送消息（字符串ID传递）
const sendMessage = async (retryCount = 0) => {
  const content = inputContent.value.trim()
  if (!content) return
  if (!currentChatId.value) {
    ElMessage.warning('请先选择聊天对象')
    return
  }

  // 临时添加发送中状态的消息
  const tempMsg = {
    id: String(Date.now()), // 临时ID用字符串
    content,
    isSelf: true,
    avatar: currentUser.value.avatar,
    sendTime: new Date().toISOString(),
    isSending: true, // 发送中标记
    sendFailed: false // 发送失败标记
  }

  // 确保聊天记录数组存在
  if (!chatRecords.value[currentChatId.value]) {
    chatRecords.value[currentChatId.value] = []
  }
  chatRecords.value[currentChatId.value].push(tempMsg)
  inputContent.value = ''
  nextTick(() => scrollToBottom())

  try {
    const res = await request.post('/doctor/chat/send', {
      receiverId: currentChatId.value, // 字符串ID，后端自动转Long
      content: content
    })
    
    if (res.code === 200 && res.data) {
      // 替换临时消息为真实消息（统一ID为字符串）
      const msgList = chatRecords.value[currentChatId.value]
      msgList[msgList.length - 1] = {
        ...res.data,
        senderId: String(res.data.senderId),
        id: String(res.data.id),
        isSelf: true
      }
    } else {
      // 发送失败处理
      const msgList = chatRecords.value[currentChatId.value]
      const lastIdx = msgList.length - 1
      msgList[lastIdx].isSending = false
      msgList[lastIdx].sendFailed = true
      ElMessage.error(res.msg || '发送消息失败')
    }
  } catch (err) {
    // 网络错误处理，支持重试
    const msgList = chatRecords.value[currentChatId.value]
    const lastIdx = msgList.length - 1
    msgList[lastIdx].isSending = false
    
    if (retryCount < 2) {
      // 自动重试2次
      setTimeout(() => {
        msgList[lastIdx].isSending = true
        sendMessage(retryCount + 1)
      }, 1500)
    } else {
      msgList[lastIdx].sendFailed = true
      console.error('发送消息失败：', err)
      ElMessage.error('网络错误，发送失败')
    }
  }
}

// 辅助方法：获取指定医生的未读消息数量（字符串ID）
const getUnreadCount = (doctorId) => {
  const count = unreadCounts.value[String(doctorId)] || 0
  // 如果当前正在查看该医生的聊天，不显示未读计数
  return currentChatId.value === String(doctorId) ? 0 : count
}

// 辅助方法：获取指定医生的最后一条消息（字符串ID）
const getLastMessage = (doctorId) => {
  const messages = chatRecords.value[String(doctorId)]
  
  if (messages === null) return '加载中...'
  if (!messages || messages.length === 0) return ''
  
  const lastMsg = messages[messages.length - 1]
  return lastMsg.content.length > 15 
    ? lastMsg.content.slice(0, 15) + '...'
    : lastMsg.content
}

// 时间格式化
const formatTime = (time) => {
  if (!time) return ''
  const date = typeof time === 'string' ? parseISO(time) : new Date(time)
  
  if (isToday(date)) {
    return format(date, 'HH:mm')
  } else if (isYesterday(date)) {
    return `昨天 ${format(date, 'HH:mm')}`
  } else {
    const daysDiff = differenceInDays(new Date(), date)
    if (daysDiff <= 7) {
      const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekDay = weekMap[date.getDay()]
      return `${weekDay} ${format(date, 'HH:mm')}`
    } else {
      return format(date, 'yyyy-MM-dd HH:mm')
    }
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

// 处理聊天消息（统一ID为字符串，兼容多种消息格式）
const handleChatMessage = (message) => {
  if (!message || !message.senderId) {
    console.warn('无效的聊天消息：', message)
    return
  }
  const targetDoctorId = String(message.senderId) // 转为字符串ID
  if (!chatRecords.value[targetDoctorId]) {
    chatRecords.value[targetDoctorId] = []
  }
  // 统一消息中的ID为字符串
  const formattedMsg = {
    ...message,
    senderId: targetDoctorId,
    id: String(message.id || Date.now()),
    isSelf: false
  }
  chatRecords.value[targetDoctorId].push(formattedMsg)

  // 非当前聊天对象更新未读计数
  if (currentChatId.value !== targetDoctorId) {
    unreadCounts.value[targetDoctorId] = (unreadCounts.value[targetDoctorId] || 0) + 1
    console.log(`收到新消息，更新医生 ${targetDoctorId} 的未读计数为:`, unreadCounts.value[targetDoctorId])
  }

  // 当前聊天对象自动滚动
  if (currentChatId.value === targetDoctorId) {
    nextTick(() => scrollToBottom())
  }
}

// 处理未读更新消息（统一ID为字符串，兼容多种格式）
const handleUnreadUpdate = (updateData) => {
  if (!updateData || updateData.senderId === undefined) {
    console.warn('无效的未读更新消息：', updateData)
    return
  }
  const senderId = String(updateData.senderId) // 转为字符串ID
  const unreadCount = Number(updateData.unreadCount) || 0
  unreadCounts.value[senderId] = unreadCount
  console.log(`未读更新：医生${senderId}，最新未读条数=${unreadCount}`)
}

// 头像加载失败处理
const defaultAvatar = (e) => {
  const img = e.target
  const name = img.alt.includes('医生头像')
    ? currentDoctor.value.realName || '医'
    : currentUser.value.realName || '医'
  img.src = ''
  img.style.backgroundColor = '#409eff'
  img.style.color = '#fff'
  img.style.display = 'flex'
  img.style.alignItems = 'center'
  img.style.justifyContent = 'center'
  img.style.fontSize = '16px'
  img.innerHTML = name.charAt(0)
}

// 暴露刷新方法，可以在需要时手动调用
defineExpose({
  refreshUnreadCounts
})

</script>

<style scoped>
/* 整体容器 */
.doctor-chat-container {
  display: flex;
  height: 700px;
  max-height: calc(100vh - 64px);
  background-color: #f5f7fa;
  position: relative;
  width: 100%;
}

/* 医生列表 */
.doctor-list {
  width: 280px;
  background-color: #fff;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fff;
  flex-shrink: 0;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.doctor-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.doctor-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
}

.doctor-item:hover {
  background-color: #f9fafb;
}

.doctor-item.active {
  background-color: #e6f0ff;
  border-left-color: #409eff;
}

/* 头像容器，用于定位未读消息红点 */
.avatar-container {
  position: relative;
  margin-right: 12px;
}

.avatar {
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 未读消息红点 - 放在左上角 */
.unread-badge {
  position: absolute;
  top: -5px;
  left: -5px;
  background-color: #ff4d4f;
  color: white;
  border-radius: 10px;
  min-width: 20px;
  height: 20px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

/* 核心：头像图片居中裁剪样式 */
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 关键属性：居中裁剪，填充容器 */
  object-position: center; /* 可选：确保裁剪中心在图片正中间（默认就是center） */
}

.doctor-info {
  flex: 1;
  min-width: 0;
}

.doctor-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doctor-dept {
  font-size: 12px;
  color: #00c8ff;
  margin-bottom: 2px;
}

.last-message {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 聊天区域 */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  height: 100%;
  overflow: hidden;
  min-width: 0;
}

.chat-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  background-color: #fff;
  flex-shrink: 0;
}

.header-info {
  margin-left: 12px;
}

.name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.dept {
  font-size: 12px;
  color: #666;
}

/* 消息容器 */
.message-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #f9fafb;
  min-height: 0;
}

.empty-message {
  text-align: center;
  color: #999;
  padding: 50px 0;
  font-size: 14px;
}

.message-wrapper {
  width: 100%;
  margin-bottom: 18px;
  display: flex;
}

.message.left-message {
  display: flex;
  align-items: flex-start;
}

.message.right-message {
  display: flex;
  align-items: flex-start;
  margin-left: auto;
}

.avatar-wrapper {
  width: 45px;
  height: 45px;
  flex-shrink: 0;
  flex-grow: 0;
  margin-top: 2px;
}

.left-message .avatar-wrapper {
  margin-right: 8px;
}

.right-message .avatar-wrapper {
  margin-left: 8px;
}

.msg-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  /* 确保消息头像容器是正方形 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 40px);
}

.msg-content {
  padding: 10px 12px;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  word-wrap: break-word;
  word-break: break-all;
  white-space: normal;
  position: relative;
}

.left-message .msg-content {
  background-color: #e9e9eb;
  color: #333;
  border-top-left-radius: 4px;
}

.right-message .msg-content {
  background-color: #409eff;
  color: #fff;
  border-top-right-radius: 4px;
}

.content {
  line-height: 1.5;
  font-size: 14px;
  overflow: hidden;
}

/* 发送状态样式 */
.send-status {
  position: absolute;
  right: 10px;
  bottom: 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.send-status.sending {
  color: rgba(255, 255, 255, 0.8);
}

.send-status.failed {
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.send-status.failed:hover {
  text-decoration: underline;
}

/* 时间样式 */
.time {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
  height: 15px;
}

.left-time {
  text-align: left;
  padding-left: 4px;
}

.right-time {
  text-align: right;
  padding-right: 4px;
}

.right-message .time {
  color: #8cbfff;
}

/* 输入区域 */
.input-area {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  background-color: #fff;
  flex-shrink: 0;
}

.msg-input {
  width: 100%;
  height: 40px;
  white-space: normal;
  word-wrap: break-word;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  height: 100%;
}

/* 滚动条优化 */
.doctor-scroll-area::-webkit-scrollbar,
.message-container::-webkit-scrollbar {
  width: 6px;
}

.doctor-scroll-area::-webkit-scrollbar-thumb,
.message-container::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}

.doctor-scroll-area::-webkit-scrollbar-track,
.message-container::-webkit-scrollbar-track {
  background-color: #f1f5f9;
}

.doctor-scroll-area::-webkit-scrollbar-thumb:hover,
.message-container::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .doctor-chat-container {
    flex-direction: column;
    height: calc(100vh - 64px);
  }
  
  .doctor-list {
    width: 100%;
    height: 40%;
    max-height: 40%;
  }
  
  .chat-area {
    height: 60%;
    max-height: 60%;
  }
  
  .message-content-wrapper {
    max-width: calc(100% - 30px);
  }
}

@media (max-width: 480px) {
  .doctor-list {
    width: 100%;
    height: 35%;
    max-height: 35%;
  }
  
  .chat-area {
    height: 65%;
    max-height: 65%;
  }
  
  .message-content-wrapper {
    max-width: calc(100% - 20px);
  }
  
  .message-container {
    padding: 12px;
  }
  
  .msg-content {
    padding: 8px 10px;
  }
  
  .message-wrapper {
    margin-bottom: 14px;
  }
}
</style>