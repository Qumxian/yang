class DoctorWebSocket {
  constructor() {
    this.ws = null
    this.reconnectTimer = null
    this.messageHandlers = new Set()
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.userId = null
  }

  connect(userId) {
    console.log('=== WebSocket 连接开始 ===')
    console.log('传入的用户ID:', userId)
    console.log('当前连接状态:', this.getConnectionStatus())

    if (this.ws && this.isConnected && this.userId === userId) {
      console.log('WebSocket 已连接，跳过重复连接')
      return
    }

    if (!userId) {
      console.warn('未提供用户ID，无法建立WebSocket连接')
      return
    }

    this.userId = userId

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (!window.WebSocket) {
      console.warn('浏览器不支持 WebSocket')
      return
    }

    // 如果已有连接但用户ID不同，先关闭
    if (this.ws && this.userId !== userId) {
      console.log('用户ID变化，关闭旧连接')
      this.ws.close()
      this.ws = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = 'localhost:8080'
    const wsUrl = `${protocol}//${host}/ws/doctor/chat/${userId}`

    console.log('WebSocket 连接URL:', wsUrl)

    try {
      console.log('正在创建 WebSocket 连接...')
      this.ws = new WebSocket(wsUrl)
      this.setupEventHandlers()
      console.log('WebSocket 对象创建成功')
    } catch (err) {
      console.error('WebSocket 连接创建失败:', err)
      this.scheduleReconnect()
    }
  }

  setupEventHandlers() {
    if (!this.ws) {
      console.error('WebSocket 对象不存在，无法设置事件处理器')
      return
    }

    this.ws.onopen = () => {
      console.log('🎉 WebSocket 连接成功！')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.notifyHandlers('connected', null)
    }

    this.ws.onmessage = (event) => {
      console.log('📨 收到 WebSocket 消息:', event.data)
      try {
        const data = JSON.parse(event.data)
        this.notifyHandlers('message', data)
      } catch (err) {
        console.error('解析 WebSocket 消息失败:', err)
      }
    }

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket 连接关闭', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      this.isConnected = false
      this.notifyHandlers('disconnected', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      })
      
      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log('准备自动重连...')
        this.scheduleReconnect()
      } else {
        console.log('已达到最大重连次数，停止重连')
      }
    }

    this.ws.onerror = (err) => {
      console.error('❌ WebSocket 连接错误:', err)
      console.error('错误详情:', err.event)
      this.notifyHandlers('error', err)
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    console.log(`将在 ${delay}ms 后尝试重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.userId) {
        this.connect(this.userId)
      }
    }, delay)
  }

  // 主动登出时断开连接
  logout() {
    console.log('用户登出，断开 WebSocket 连接')
    this.disconnect()
  }

  disconnect() {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 关闭连接
    if (this.ws) {
      this.ws.close(1000, '用户主动断开')
      this.ws = null
    }

    this.isConnected = false
    this.reconnectAttempts = 0
    this.userId = null
    console.log('WebSocket 已断开连接')
  }

  addMessageHandler(handler) {
    this.messageHandlers.add(handler)
  }

  removeMessageHandler(handler) {
    this.messageHandlers.delete(handler)
  }

  notifyHandlers(type, data) {
    this.messageHandlers.forEach(handler => {
      try {
        if (typeof handler === 'function') {
          handler(type, data)
        }
      } catch (err) {
        console.error('WebSocket 处理器执行错误:', err)
      }
    })
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message))
        return true
      } catch (err) {
        console.error('发送 WebSocket 消息失败:', err)
        return false
      }
    } else {
      console.warn('WebSocket 未连接，无法发送消息')
      return false
    }
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      reconnectAttempts: this.reconnectAttempts
    }
  }
}

// 创建全局单例
export const doctorWebSocket = new DoctorWebSocket()