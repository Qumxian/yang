<template>
  <div class="calendar-wrapper">
    <!-- 顶部控制栏 -->
    <div class="control-header">
      <div class="header-left">
        <div class="title-section">
          <el-icon class="calendar-icon"><Calendar /></el-icon>
          <span class="page-title">我的日程</span>
        </div>
        <el-date-picker 
          v-model="selectedDate" 
          type="date" 
          placeholder="跳转至日期" 
          @change="handleDateChange"
          value-format="YYYY-MM-DD"
          class="custom-date-picker"
          :prefix-icon="Search"
        />
      </div>

      <div class="header-right">
        <el-button-group class="nav-group">
          <el-button @click="navigateWeek(-1)" :disabled="loading">
            <el-icon><ArrowLeft /></el-icon> 上周
          </el-button>
          <el-button @click="backToCurrentWeek" :disabled="loading">
            本周
          </el-button>
          <el-button @click="navigateWeek(1)" :disabled="loading">
            下周 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>
        <div class="date-range-badge">
          {{ weekStart }} <span class="divider">~</span> {{ weekEnd }}
        </div>
      </div>
    </div>

    <!-- 日历主体容器 -->
    <div class="calendar-body">
      <!-- 星期头部 -->
      <div class="week-header">
        <div 
          class="day-column-header" 
          v-for="(day, index) in weekDays" 
          :key="index"
          :class="{ 'is-today': day.isToday }"
        >
          <div class="weekday-label">{{ day.weekday }}</div>
          <div class="date-label">{{ day.dayNum }}</div>
          <div class="today-tag" v-if="day.isToday">Today</div>
        </div>
      </div>

      <!-- 预约内容区 (带滑动动画) -->
      <div class="week-content-viewport">
        <transition :name="slideTransitionName" mode="default">
          <div class="week-grid" :key="weekStart">
            <div 
              class="day-column" 
              v-for="(day, index) in weekDays" 
              :key="index"
              :class="{ 'is-today-bg': day.isToday }"
            >
              <!-- 加载状态 -->
              <div v-if="loading" class="skeleton-loader">
                <el-skeleton animated :rows="3" />
              </div>

              <!-- 空状态 -->
              <div v-else-if="day.appointments.length === 0" class="empty-state">
                <el-icon><Mug /></el-icon>
                <span>无预约</span>
              </div>

              <!-- 预约卡片列表 -->
              <div v-else class="appointments-list">
                <div 
                  class="appointment-card" 
                  v-for="apt in day.appointments" 
                  :key="apt.id"
                >
                  <div class="card-left-border"></div>
                  <div class="card-content">
                    <div class="apt-time">
                      <el-icon><Clock /></el-icon> {{ apt.time }}
                    </div>
                    
                    <div class="apt-patient">
                      <span class="name">{{ apt.username }}</span>
                      <el-tag size="small" effect="plain" class="dept-tag">
                        {{ apt.department }}
                      </el-tag>
                    </div>

                    <div class="apt-details">
                      <div class="detail-row">
                        <el-icon><Postcard /></el-icon> {{ maskIdCard(apt.idCard) }}
                      </div>
                      <div class="detail-row" v-if="apt.contact">
                        <el-icon><Phone /></el-icon> {{ apt.contact }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  ArrowLeft, ArrowRight, Calendar, Search, 
  Clock, Postcard, Phone, Mug 
} from '@element-plus/icons-vue'
import request from '@/utils/request'

// 响应式数据
const selectedDate = ref('')
const weekStart = ref('')
const weekEnd = ref('')
const weekDays = ref([])
const loading = ref(false)
const slideTransitionName = ref('slide-right') // slide-left 或 slide-right

// 初始化
onMounted(() => {
  const today = new Date()
  initCalendar(today)
})

const initCalendar = (date) => {
  selectedDate.value = formatDate(date)
  generateWeekDays(date)
  fetchWeekAppointments()
}

// 生成一周数据
const generateWeekDays = (date) => {
  const days = []
  const currentDay = date.getDay() || 7 
  const monday = new Date(date)
  monday.setDate(date.getDate() - (currentDay - 1))
  
  const todayStr = formatDate(new Date())

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = formatDate(d)
    
    days.push({
      date: dateStr,
      weekday: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
      dayNum: d.getDate(),
      isToday: dateStr === todayStr,
      appointments: []
    })
  }
  
  weekDays.value = days
  weekStart.value = days[0].date
  weekEnd.value = days[6].date
}

// 核心：处理周切换
const handleWeekChange = (newDate, direction) => {
  // 设置动画方向
  if (direction === 'next') {
    slideTransitionName.value = 'slide-left'
  } else if (direction === 'prev') {
    slideTransitionName.value = 'slide-right'
  } else {
    // 日期选择器跳转，根据日期比较判断方向
    slideTransitionName.value = new Date(newDate) > new Date(selectedDate.value) 
      ? 'slide-left' 
      : 'slide-right'
  }

  // 延迟极短时间更新数据，让Vue识别到transition变化
  requestAnimationFrame(() => {
    selectedDate.value = formatDate(newDate)
    generateWeekDays(newDate)
    fetchWeekAppointments()
  })
}

// 日期选择器
const handleDateChange = (val) => {
  if(!val) return
  handleWeekChange(new Date(val), 'jump')
}

// 按钮切换
const navigateWeek = (step) => {
  const current = new Date(selectedDate.value)
  current.setDate(current.getDate() + step * 7)
  handleWeekChange(current, step > 0 ? 'next' : 'prev')
}

// 回到本周
const backToCurrentWeek = () => {
  const today = new Date()
  handleWeekChange(today, 'jump')
  ElMessage.success('已回到本周')
}

// 获取数据
const fetchWeekAppointments = async () => {
  loading.value = true
  try {
    const res = await request.get('/doctor/calendar/week', {
      params: { weekStart: weekStart.value, weekEnd: weekEnd.value }
    })

    // 先清空
    weekDays.value.forEach(d => d.appointments = [])

    if (res.code === 200 && res.data) {
      res.data.forEach(apt => {
        const day = weekDays.value.find(d => d.date === apt.date)
        if (day) day.appointments.push(apt)
      })
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('日程同步失败')
  } finally {
    // 保持loading一小会儿，避免闪烁过快
    setTimeout(() => { loading.value = false }, 300)
  }
}

const formatDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const maskIdCard = (str) => {
  if (!str) return ''
  return str.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2')
}
</script>

<style scoped>
/* 全局变量定义 */
:root {
  --primary-blue: #1a73e8;
  --bg-gray: #f5f7fa;
  --border-light: #e4e7ed;
  --text-main: #303133;
  --text-light: #909399;
}

.calendar-wrapper {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px); /* 适应页面高度 */
  overflow: hidden;
  max-width: 1600px;
  margin: 0 auto;
}

/* --- 顶部控制栏 --- */
.control-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
  font-weight: 600;
  font-size: 18px;
}

.calendar-icon {
  color: var(--primary-blue);
  font-size: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.date-range-badge {
  background-color: #ecf5ff;
  color: var(--primary-blue);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.divider {
  margin: 0 5px;
  color: #a0cfff;
}

/* --- 日历主体 --- */
.calendar-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止滑动时溢出 */
  position: relative;
}

/* 表头 */
.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--border-light);
  background-color: #fff;
}

.day-column-header {
  padding: 12px 0;
  text-align: center;
  border-right: 1px solid transparent; /* 占位 */
  position: relative;
  transition: all 0.3s;
}

.day-column-header.is-today {
  color: var(--primary-blue);
}

.day-column-header.is-today .date-label {
  background-color: transparent; /* 去掉背景色 */
  color: #f56c6c !important;     /* 字体变红 (Element UI 的 Danger 色) */
  border-color: #f56c6c;         /* 边框变红 */
  box-shadow: none;              /* 去掉阴影 */
}

.weekday-label {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 4px;
}

.date-label {
display: flex;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 600;
  margin: 0 auto;
  color: var(--text-main); 
  border: 2px solid transparent; 
  box-sizing: border-box; 
}

.today-tag {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  background: #fdf6ec;
  color: #e6a23c;
  padding: 1px 4px;
  border-radius: 4px;
  transform: scale(0.8);
}

/* --- 核心内容视口 --- */
.week-content-viewport {
  flex: 1;
  position: relative; /* 为绝对定位的过渡元素提供锚点 */
  overflow: hidden;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  height: 100%;
  width: 100%;
  position: absolute; /* 绝对定位以支持重叠过渡 */
  top: 0;
  left: 0;
}

.day-column {
  border-right: 1px solid var(--border-light);
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  background-color: #fff;
  transition: background-color 0.3s;
}

.day-column:last-child {
  border-right: none;
}

.day-column.is-today-bg {
  background-color: rgba(236, 245, 255, 0.3); /* 极淡的蓝色背景 */
}

/* 滚动条美化 */
.day-column::-webkit-scrollbar {
  width: 4px;
}
.day-column::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 4px;
}
.day-column::-webkit-scrollbar-track {
  background: transparent;
}

/* --- 预约卡片样式 --- */
.appointments-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.appointment-card {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid #ebeef5;
  cursor: pointer;
}

/* 左侧彩色装饰条 */
.card-left-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--primary-blue);
}

.appointment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: #c6e2ff;
}

.card-content {
  padding-left: 8px;
}

.apt-time {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.apt-time .el-icon {
  color: var(--primary-blue);
}

.apt-patient {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.apt-patient .name {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.dept-tag {
  border: none;
  background-color: #f0f9eb;
  color: #67c23a;
}

.apt-details {
  font-size: 12px;
  color: var(--text-light);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #c0c4cc;
  font-size: 13px;
  gap: 10px;
}
.empty-state .el-icon {
  font-size: 32px;
  opacity: 0.5;
}

/* 骨架屏 */
.skeleton-loader {
  padding: 10px;
}

/* --- 动画类定义 (滑动效果) --- */
/* 向左滑动 (Next Week) */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease-out;
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* 向右滑动 (Prev Week) */
.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>