<template>
  <div>
    <!-- 查询条件 -->
    <el-form :inline="true" :model="filters" style="margin: 10px 0;">
      <el-form-item label="医生姓名">
        <el-input v-model="filters.doctorName" placeholder="请输入医生姓名" clearable />
      </el-form-item>

      <el-form-item label="科室">
        <el-select v-model="filters.department" placeholder="请选择科室" clearable class="wide-select">
          <el-option v-for="item in departments" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>

      <el-form-item label="日期">
        <el-date-picker v-model="filters.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" clearable />
      </el-form-item>

      <el-form-item label="时间段">
        <el-select v-model="filters.time" placeholder="请选择" clearable class="wide-select">
          <el-option label="上午" value="上午" />
          <el-option label="下午" value="下午" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="fetchAppointments">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 表格 -->
    <el-table :data="appointments.records || []" border style="margin-top: 10px;">
      <el-table-column prop="username" label="患者姓名" />
      <el-table-column prop="contact" label="联系方式" />
      <el-table-column prop="department" label="科室" />
      <el-table-column prop="doctorName" label="医生姓名" />
      <el-table-column prop="date" label="日期" />
      <el-table-column prop="time" label="时间段" />
    </el-table>

    <!-- 分页 -->
    <div style="margin-top: 15px; text-align: right;">
      <el-pagination :current-page="page" :page-size="size" :total="appointments.total"
        layout="prev, pager, next, sizes, total" @current-change="handlePageChange" @size-change="handleSizeChange" />

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const appointments = ref({ records: [], total: 0 })
const page = ref(1)
const size = ref(10)

const filters = ref({
  doctorName: '',
  department: '',
  date: '',
  time: ''
})

const departments = ref([])

// 获取科室列表
const fetchDepartments = async () => {
  try {
    const res = await request.get('/doctor/schedule/list')
    console.log('科室列表响应:', res)
    departments.value = res || []  // 直接使用 res，因为后端返回的是数组
  } catch (error) {
    console.error('获取科室列表失败:', error)
    ElMessage.error('获取科室列表失败')
  }
}

// 查询挂号记录 - 修正：直接使用响应数据
const fetchAppointments = async () => {
  try {
    console.log('开始请求挂号记录...')
    const res = await request.get('/doctor/appointment/list', {
      params: {
        doctorName: filters.value.doctorName,
        department: filters.value.department,
        date: filters.value.date,
        time: filters.value.time,
        page: page.value,
        size: size.value
      }
    })
    
    console.log('挂号记录完整响应:', res)
    
    // 重要：直接使用 res，因为后端返回的就是分页数据
    if (res && res.records !== undefined) {
      appointments.value = res
      console.log('设置后的appointments:', appointments.value)
    } else {
      console.warn('响应数据格式不正确:', res)
      appointments.value = { records: [], total: 0 }
      ElMessage.error('数据格式错误')
    }
  } catch (error) {
    console.error('请求挂号记录异常:', error)
    ElMessage.error('获取数据失败')
    appointments.value = { records: [], total: 0 }
  }
}

const handleSizeChange = (newSize) => {
  size.value = newSize
  page.value = 1
  fetchAppointments()
}

const handlePageChange = (newPage) => {
  page.value = newPage
  fetchAppointments()
}

// 重置查询条件
const resetFilters = () => {
  filters.value = { doctorName: '', department: '', date: '', time: '' }
  page.value = 1
  fetchAppointments()
}

onMounted(() => {
  console.log('组件挂载，开始初始化数据...')
  fetchDepartments()
  fetchAppointments()
})
</script>

<style scoped>
.wide-select {
  width: 150px;
}
</style>