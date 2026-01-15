<template>
  <div class="schedule-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="title-section">
        <div class="decor-line"></div>
        <span class="page-title">排班管理中心</span>
        <span class="sub-title">管理您的出诊时间与号源分配</span>
      </div>
      <el-button type="primary" size="large" class="add-btn" @click="openDialog">
        <el-icon class="el-icon--left"><Plus /></el-icon>
        新增排班
      </el-button>
    </div>

    <!-- 排班表格区域 -->
    <el-card shadow="never" class="table-card">
      <el-table 
        :data="scheduleList" 
        style="width: 100%" 
        :header-cell-style="headerStyle"
        :row-class-name="tableRowClassName"
        v-loading="loading"
        element-loading-text="正在加载排班数据..."
      >
        <!-- 科室 & 医生 (合并展示) -->
        <el-table-column label="医生信息" min-width="160">
          <template #default="scope">
            <div class="doctor-info-cell">
              <el-avatar :size="32" class="doctor-avatar">
                {{ scope.row.doctorName ? scope.row.doctorName.charAt(0) : '医' }}
              </el-avatar>
              <div class="info-text">
                <span class="name">{{ scope.row.doctorName }}</span>
                <el-tag size="small" effect="plain" class="dept-tag">{{ scope.row.department }}</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 日期 -->
        <el-table-column prop="date" label="出诊日期" min-width="140">
          <template #default="scope">
            <div class="date-cell">
              <el-icon><Calendar /></el-icon>
              <span>{{ scope.row.date }}</span>
            </div>
          </template>
        </el-table-column>

        <!-- 时间段 -->
        <el-table-column prop="time" label="时段" min-width="120">
          <template #default="scope">
            <el-tag 
              :type="scope.row.time === '上午' ? 'warning' : 'primary'"
              effect="light"
              round
              class="time-tag"
            >
              <el-icon v-if="scope.row.time === '上午'"><Sunny /></el-icon>
              <el-icon v-else><Moon /></el-icon>
              {{ scope.row.time }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 号源进度条 -->
        <el-table-column label="号源状态" min-width="200">
          <template #default="scope">
            <div class="capacity-cell">
              <div class="capacity-text">
                <span>余 {{ scope.row.remaining }}</span>
                <span class="total">/ 总 {{ scope.row.total }}</span>
              </div>
              <el-progress 
                :percentage="calculatePercentage(scope.row)" 
                :status="getProgressStatus(scope.row)"
                :stroke-width="8"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-tooltip content="编辑" placement="top">
                <el-button type="primary" link @click="editSchedule(scope.row)">
                  <el-icon size="18"><Edit /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button type="danger" link @click="confirmDelete(scope.row.id)">
                  <el-icon size="18"><Delete /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 弹窗：新增/编辑排班 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑排班' : '新增排班'" 
      width="500px"
      class="custom-dialog"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" class="schedule-form">
        <el-form-item label="所属科室">
          <el-input v-model="form.department" disabled readonly>
            <template #prefix><el-icon><OfficeBuilding /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="医生姓名">
          <el-input v-model="form.doctorName" disabled readonly>
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="出诊日期">
          <el-date-picker 
            v-model="form.date" 
            type="date" 
            placeholder="选择日期" 
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </el-form-item>
        <el-form-item label="出诊时段">
          <el-select v-model="form.time" placeholder="选择时段" style="width: 100%">
            <el-option label="上午 (08:00 - 12:00)" value="上午">
              <span style="float: left">上午</span>
              <span style="float: right; color: #8492a6; font-size: 13px"><el-icon><Sunny /></el-icon></span>
            </el-option>
            <el-option label="下午 (14:00 - 18:00)" value="下午">
              <span style="float: left">下午</span>
              <span style="float: right; color: #8492a6; font-size: 13px"><el-icon><Moon /></el-icon></span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="号源配置">
          <div class="number-input-group">
            <el-input-number v-model="form.total" :min="1" :max="100" label="总号源" />
            <span class="hint-text">个号源</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveSchedule">确认保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  Plus, Calendar, Sunny, Moon, Edit, Delete, 
  OfficeBuilding, User 
} from '@element-plus/icons-vue'
import request from '@/utils/request'

// 状态定义
const scheduleList = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const loading = ref(false)

const currentDoctor = reactive({
  department: '',
  realName: ''
})

const form = reactive({
  id: null,
  department: '',
  doctorName: '',
  date: '',
  time: '',
  total: 1,
  remaining: 1
})

// 表头样式定义
const headerStyle = {
  background: '#f5f7fa',
  color: '#606266',
  fontWeight: '600',
  height: '50px'
}

// 禁止选择今天之前的日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() - 8.64e7
}

onMounted(async () => {
  loading.value = true
  await getDoctorInfo()
  await loadSchedule()
  loading.value = false
})

// 计算百分比（用于进度条）
const calculatePercentage = (row) => {
  if (!row.total || row.total === 0) return 0
  return Math.floor(((row.total - row.remaining) / row.total) * 100)
}

// 获取进度条颜色状态
const getProgressStatus = (row) => {
  const percentage = calculatePercentage(row)
  if (percentage >= 90) return 'exception' // 红色（快满了）
  if (percentage >= 70) return 'warning'   // 黄色
  return 'success'                         // 绿色（空闲）
}

const getDoctorInfo = async () => {
  try {
    const res = await request.get('/doctor/info')
    if (res.code === 200 && res.data) {
      currentDoctor.department = res.data.department || ''
      currentDoctor.realName = res.data.realName || ''
    }
  } catch (error) {
    ElMessage.error('获取医生信息失败')
  }
}

const loadSchedule = async () => {
  try {
    const res = await request.get('/doctor/schedule')
    if (Array.isArray(res)) {
      scheduleList.value = res
    } else {
      scheduleList.value = []
    }
  } catch (error) {
    ElMessage.error('加载排班数据失败')
  }
}

const openDialog = () => {
  isEdit.value = false
  Object.assign(form, { 
    id: null, 
    department: currentDoctor.department,
    doctorName: currentDoctor.realName,
    date: '', 
    time: '', 
    total: 30, // 默认给30个
    remaining: 30 
  })
  dialogVisible.value = true
}

const editSchedule = (row) => {
  isEdit.value = true
  Object.assign(form, row)
  dialogVisible.value = true
}

const saveSchedule = async () => {
  try {
    if (!form.date || !form.time) {
      return ElMessage.warning('请填写完整的排班信息')
    }

    const formattedForm = {
      ...form,
      date: formatDate(form.date)
    }
    
    // 如果是新增，默认剩余号源等于总号源
    // 如果是编辑，保持原逻辑或根据需求调整（这里简单处理：如果是新增则相等）
    if(!isEdit.value) {
        formattedForm.remaining = formattedForm.total
    }

    let res
    if (isEdit.value) {
      res = await request.put(`/doctor/schedule/${form.id}`, formattedForm)
    } else {
      res = await request.post('/doctor/schedule', formattedForm)
    }

    if (res) {
      dialogVisible.value = false
      loadSchedule()
      ElMessage.success(isEdit.value ? '排班已更新' : '排班创建成功')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  if (typeof date === 'string') return date
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const confirmDelete = (id) => {
  ElMessageBox.confirm(
    '删除后患者将无法预约该时段，确定继续吗？',
    '警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      icon: Delete
    }
  ).then(async () => {
    try {
      const res = await request.delete(`/doctor/schedule/${id}`)
      if (res !== undefined) {
        ElMessage.success('已删除')
        loadSchedule()
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 表格行进入动画类名
const tableRowClassName = ({ rowIndex }) => {
  return 'animate-row'
}
</script>

<style scoped>
/* 容器 */
.schedule-container {
  padding: 10px;
  background-color: transparent;
  animation: fade-up 0.5s ease-out;
}

/* 顶部工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: white;
  padding: 20px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.decor-line {
  width: 4px;
  height: 24px;
  background: #1a73e8;
  border-radius: 2px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.sub-title {
  font-size: 13px;
  color: #909399;
  margin-left: 8px;
  margin-top: 4px;
}

.add-btn {
  background-color: #1a73e8;
  border-color: #1a73e8;
  padding: 12px 24px;
  box-shadow: 0 4px 10px rgba(26, 115, 232, 0.3);
  transition: transform 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
}

/* 表格卡片 */
.table-card {
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

/* 自定义表格内容样式 */
.doctor-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doctor-avatar {
  background-color: #e6f7ff;
  color: #1a73e8;
  font-weight: bold;
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
}

.dept-tag {
  border: none;
  background-color: #f2f6fc;
  color: #606266;
  font-size: 12px;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
}

.date-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
  font-family: 'Roboto', sans-serif;
}

.time-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  height: 28px;
}

/* 进度条单元格 */
.capacity-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 20px;
}

.capacity-text {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.capacity-text .total {
  color: #909399;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

/* 弹窗表单 */
.schedule-form {
  padding: 10px 20px 0 10px;
}

.number-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hint-text {
  color: #909399;
  font-size: 13px;
}

/* 动画 */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.el-table .animate-row) {
  animation: fade-up 0.4s ease-out forwards;
}

/* 调整表格行高 */
:deep(.el-table__row) {
  height: 70px; /* 增加行高，减少密集感 */
}
</style>