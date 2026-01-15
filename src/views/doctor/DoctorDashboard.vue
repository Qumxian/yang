<template>
  <div class="layout-container">
    <el-container style="height: 100vh; overflow: hidden;">
      
      <!-- 左侧菜单 -->
      <el-aside width="240px" class="aside-container">
        <!-- 系统标题 -->
        <div class="system-brand">
          <div class="logo-wrapper">
            <div class="logo-icon">✚</div>
          </div>
          <span class="brand-text">医生工作台</span>
        </div>

        <!-- 菜单 -->
        <el-menu
          :default-active="activeMenu"
          class="medical-menu"
          router
          :unique-opened="true"
        >
          <!-- 菜单项遍历 -->
          <el-menu-item index="/doctor/dashboard/calendar">
            <el-icon class="menu-icon"><Calendar /></el-icon>
            <span>我的日程</span>
          </el-menu-item>
          <el-menu-item index="/doctor/dashboard/schedule">
            <el-icon class="menu-icon"><Timer /></el-icon>
            <span>排班管理</span>
          </el-menu-item>
          <el-menu-item index="/doctor/dashboard/appointments">
            <el-icon class="menu-icon"><List /></el-icon>
            <span>预约管理</span>
          </el-menu-item>
          <el-menu-item index="/doctor/dashboard/chat">
            <el-icon class="menu-icon"><ChatDotRound /></el-icon>
            <span>医患沟通</span>
          </el-menu-item>
          <el-menu-item index="/doctor/dashboard/knowledge">
            <el-icon class="menu-icon"><Reading /></el-icon>
            <span>知识库管理</span>
          </el-menu-item>
          
          <div class="menu-divider"></div>
          
          <el-menu-item index="/doctor/dashboard/settings">
            <el-icon class="menu-icon"><Setting /></el-icon>
            <span>个人设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主体内容 -->
      <el-container class="main-wrapper">
        <!-- 顶部导航栏 -->
        <el-header class="medical-header">
          <div class="header-content">
            <div class="header-left">
              <span class="welcome-text">
                <span class="indicator"></span> 
                在线
              </span>
            </div>

            <div class="user-info">
              <el-button 
                link 
                type="danger" 
                @click="logout" 
                class="logout-link"
              >
                退出登录
              </el-button>
            </div>
          </div>
        </el-header>

        <!-- 主内容区 -->
        <el-main class="medical-main">
          <!-- 路由视图 + 动效 -->
          <router-view v-slot="{ Component }">
            <transition name="fade-slide" mode="out-in">
              <keep-alive>
                <component :is="Component" />
              </keep-alive>
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Calendar, Timer, List, ChatDotRound, Reading, Setting, UserFilled 
} from '@element-plus/icons-vue'
import { doctorWebSocket } from '@/utils/websocket'

const router = useRouter()
const route = useRoute()
const activeMenu = ref(route.path)

watch(route, (newRoute) => {
  activeMenu.value = newRoute.path
})

const clearAuthData = () => {
  localStorage.removeItem('doctor')
  localStorage.removeItem('doctor_token')
  localStorage.removeItem('doctor_info')
  sessionStorage.removeItem('doctor')
  sessionStorage.removeItem('doctor_token')
  sessionStorage.removeItem('doctor_info')
}

const logout = () => {
  ElMessageBox.confirm(
    '确定要退出医生工作台吗？',
    '安全提示',
    {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    doctorWebSocket.logout()
    clearAuthData()
    ElMessage.success('已安全退出')
    router.push('/doctor/login')
  }).catch(() => {})
}

onMounted(() => {
  const doctorInfo = localStorage.getItem('doctor')
  if (doctorInfo) {
    try {
      const user = JSON.parse(doctorInfo)
      const status = doctorWebSocket.getConnectionStatus()
      if (!status.isConnected || status.userId !== String(user.id)) {
        doctorWebSocket.connect(String(user.id))
      }
    } catch (err) {
      console.error('解析用户信息失败:', err)
    }
  }
})
</script>

<style scoped>
/* 定义变量与动画曲线 */
:root {
  --primary-color: #1a73e8;
  --menu-bg: #2b3648;
  --hover-bg: rgba(255, 255, 255, 0.08);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性曲线 */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);     /* 平滑曲线 */
}

.layout-container {
  height: 100vh;
  width: 100%;
  background-color: #f5f7fa;
}

/* ================= 左侧菜单动画 ================= */
.aside-container {
  background-color: #2b3648;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  transition: width 0.3s var(--ease-smooth);
}

.system-brand {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #202936;
  color: white;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;
}

/* Logo 呼吸动效 */
.logo-icon {
  width: 28px;
  height: 28px;
  background: #1a73e8;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-size: 16px;
  font-weight: bold;
  animation: pulse-glow 3s infinite ease-in-out;
}

@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(26, 115, 232, 0); }
  100% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0); }
}

/* 菜单项动效 */
.medical-menu {
  border-right: none;
  background-color: transparent;
  padding-top: 10px;
}

:deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
  margin: 4px 12px;
  border-radius: 8px;
  color: #b7bdc9;
  font-size: 14px;
  transition: all 0.3s var(--ease-smooth); /* 关键：平滑过渡 */
  position: relative;
  overflow: hidden;
}

/* 悬停微位移 */
:deep(.el-menu-item:hover) {
  background-color: var(--hover-bg);
  color: #ffffff;
  transform: translateX(4px); /* 向右轻微移动 */
}

/* 选中项动效 */
:deep(.el-menu-item.is-active) {
  background-color: #1a73e8;
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
  transform: scale(1.02); /* 极轻微放大 */
}

/* 图标动效 */
:deep(.menu-icon) {
  transition: transform 0.3s var(--ease-spring);
}
:deep(.el-menu-item:hover .menu-icon) {
  transform: scale(1.2); /* 图标悬停放大 */
}

.menu-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  margin: 10px 0;
}

/* ================= 头部动效 ================= */
.medical-header {
  background-color: #ffffff;
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.05);
  z-index: 9;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 状态指示灯闪烁 */
.indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #52c41a; /* 在线绿 */
  margin-right: 6px;
  box-shadow: 0 0 8px rgba(82, 196, 26, 0.6);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-avatar {
  background-color: #e6f7ff;
  color: #1a73e8;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.user-avatar:hover {
  transform: rotate(15deg); /* 头像俏皮旋转 */
}

/* 退出按钮物理按压感 */
.logout-link {
  font-size: 14px;
  transition: transform 0.1s, color 0.2s;
}
.logout-link:active {
  transform: scale(0.95); /* 点击下压 */
}

/* ================= 主内容切换动效 ================= */
.medical-main {
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 64px);
  background-color: #f5f7fa;
  position: relative;
}

/* 页面切换动画：上浮淡入 (Fade Slide Up) */
/* 这种动画比左右滑动更适合桌面端后台 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px); /* 从下方10px处进入 */
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px); /* 向上方10px处消失 */
}

</style>