<template>
  <div>
    <el-card style="max-width: 500px; margin-top: 20px;">
      <!-- 头像展示区域 -->
      <div style="text-align: center; margin-bottom: 20px;">
        <el-avatar :size="100" class="avatar">
          <img 
            :src="doctor.avatar" 
            alt="医生头像" 
            style="width: 100%; height: 100%; object-fit: cover;"
            v-if="doctor.avatar"
          >
          <span v-else style="font-size: 30px;">
            {{ doctor.realName ? doctor.realName.charAt(0) : '医' }}
          </span>
        </el-avatar>
        <el-button 
          link 
          @click="handleAvatarUpload" 
          style="margin-top: 10px; color: #409eff;"
        >
          更换头像
        </el-button>
        <input 
          type="file" 
          ref="fileInput" 
          accept="image/*" 
          @change="uploadAvatar" 
          style="display: none;"
        >
      </div>

      <!-- 医生信息展示 -->
      <el-descriptions title="医生信息" :column="1" border>
        <el-descriptions-item label="用户名">{{ doctor.username }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ doctor.realName }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ doctor.department }}</el-descriptions-item>
        <el-descriptions-item label="入职时间">
          {{ formatDateTime(doctor.createTime) }}
        </el-descriptions-item>
      </el-descriptions>

      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <el-button type="primary" @click="openEditUsername">修改用户名</el-button>
        <el-button type="warning" @click="openChangePassword">修改密码</el-button>
      </div>
    </el-card>

    <!-- 修改用户名弹窗 -->
    <el-dialog v-model="usernameDialogVisible" title="修改用户名" width="400px">
      <el-form label-width="100px">
        <el-form-item label="原用户名">
          <el-input v-model="doctor.username" disabled></el-input>
        </el-form-item>
        <el-form-item label="新用户名">
          <el-input v-model="newUsername" placeholder="请输入新用户名"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="usernameDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateUsername">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form label-width="100px">
        <el-form-item label="原密码">
          <el-input type="password" v-model="oldPassword" placeholder="请输入原密码"></el-input>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input type="password" v-model="newPassword" placeholder="请输入新密码"></el-input>
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input type="password" v-model="confirmPassword" placeholder="请再次输入新密码"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import request from '@/utils/request'
import router from '@/router'

// 医生信息响应式对象（字段与后端返回保持一致）
const doctor = reactive({
  id: '',
  username: '',       // 后端返回的username（原account）
  realName: '',       // 后端返回的realName（姓名）
  department: '',
  avatar: '',
  createTime: ''
})

// 弹窗控制变量
const usernameDialogVisible = ref(false)
const passwordDialogVisible = ref(false)

// 表单数据
const newUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const fileInput = ref(null)

// 初始化获取医生信息
onMounted(() => {
  const doctorStr = localStorage.getItem('doctor')
  if (!doctorStr) {
    router.push('/doctor/login')
    return
  }
  fetchDoctorInfo()
})

// 获取医生信息（适配后端字段）
const fetchDoctorInfo = async () => {
  try {
    const res = await request.get('/doctor/info')
    if (res.code === 200 && res.data) {
      // 后端返回字段：id, username, realName, department
      Object.assign(doctor, res.data)
      // 如果后端返回头像和创建时间，这里会自动接收
    } else {
      ElMessage.error(res.msg || '获取信息失败')
    }
  } catch (err) {
    console.error('获取医生信息失败:', err)
    ElMessage.error('加载失败，请刷新页面重试')
  }
}

// 格式化日期时间
const formatDateTime = (dateTime) => {
  if (!dateTime) return ''
  const formatted = dateTime.replace('T', ' ')
  return formatted.substring(0, 19)
}

// 打开文件选择器
const handleAvatarUpload = () => {
  fileInput.value.click()
}

// 上传头像并更新
const uploadAvatar = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    return ElMessage.error('请选择图片文件（支持jpg、png等格式）')
  }
  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.error('图片大小不能超过5MB')
  }

  const formData = new FormData()
  formData.append('file', file)
  
  const loading = ElLoading.service({ text: '头像上传中...' })
  
  try {
    // 1. 上传图片到OSS
    const uploadRes = await request.post('/yangyang/upload/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (uploadRes.code === 200 && uploadRes.data) {
      const avatarUrl = uploadRes.data
      // 2. 调用后端接口更新头像
      const updateRes = await request.put('/doctor/updateAvatar', null, {
        params: { avatarUrl }
      })
      
      if (updateRes.code === 200) {
        doctor.avatar = avatarUrl // 更新前端显示
        ElMessage.success('头像更新成功')
      } else {
        ElMessage.error(updateRes.msg || '更新头像失败')
      }
    } else {
      ElMessage.error(uploadRes.msg || '上传图片失败')
    }
  } catch (err) {
    console.error('头像操作失败:', err)
    ElMessage.error('操作失败，请重试')
  } finally {
    loading.close()
    e.target.value = ''
  }
}

// 打开修改用户名弹窗
const openEditUsername = () => {
  newUsername.value = ''
  usernameDialogVisible.value = true
}

// 更新用户名（适配后端参数格式）
const updateUsername = async () => {
  if (!newUsername.value.trim()) {
    return ElMessage.warning('请输入新用户名')
  }
  if (newUsername.value === doctor.username) {
    return ElMessage.warning('新用户名不能与原用户名相同')
  }

  try {
    // 后端需要的参数是username（对应UpdateUsernameRequest）
    const res = await request.put('/doctor/updateUsername', {
      username: newUsername.value
    })
    if (res.code === 200) {
      ElMessage.success('用户名修改成功，请重新登录')
      usernameDialogVisible.value = false
      logout()
    } else {
      ElMessage.error(res.msg || '修改失败')
    }
  } catch (err) {
    console.error('修改用户名失败:', err)
    ElMessage.error('请求失败，请重试')
  }
}

// 打开修改密码弹窗
const openChangePassword = () => {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordDialogVisible.value = true
}

// 修改密码（适配后端参数格式）
const changePassword = async () => {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    return ElMessage.warning('请填写完整信息')
  }
  if (newPassword.value === oldPassword.value) {
    return ElMessage.warning('新密码不能与原密码相同')
  }
  if (newPassword.value.length < 6) {
    return ElMessage.warning('密码不能少于6位')
  }
  if (newPassword.value !== confirmPassword.value) {
    return ElMessage.warning('两次输入的新密码不一致')
  }

  try {
    // 后端需要的参数是oldPassword和newPassword（对应ChangePasswordRequest）
    const res = await request.put('/doctor/changePassword', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    })
    if (res.code === 200) {
      ElMessage.success('密码修改成功，请重新登录')
      passwordDialogVisible.value = false
      logout()
    } else {
      ElMessage.error(res.msg || '修改失败')
    }
  } catch (err) {
    console.error('修改密码失败:', err)
    ElMessage.error('请求失败，请重试')
  }
}

// 退出登录
const logout = () => {
  ElMessageBox.alert('请重新登录以继续操作', '提示', {
    confirmButtonText: '确定',
    callback: () => {
      localStorage.removeItem('doctor')
      localStorage.removeItem('doctor_token')
      localStorage.removeItem('doctor_info')
      router.push('/doctor/login')
    }
  })
}
</script>

<style scoped>
.el-descriptions {
  margin-top: 10px;
}

.avatar {
  border: 2px solid #f0f0f0;
  transition: transform 0.3s ease;
}

.avatar:hover {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .el-card {
    max-width: 100%;
    margin: 10px;
  }
  
  .el-descriptions {
    font-size: 14px;
  }
}
</style>