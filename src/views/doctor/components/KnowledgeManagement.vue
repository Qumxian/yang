<template>
  <div class="knowledge-management">
    <!-- 上传区域 -->
    <div class="upload-section">
      <el-card class="upload-card">
        <template #header>
          <div class="card-header">
            <span>上传知识库文件</span>
          </div>
        </template>

        <!-- 拖拽上传区域 -->
        <div 
          class="upload-drag-area"
          @click="showFileInput"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          :class="{ 'drag-over': isDragOver }"
        >
          <div class="upload-content">
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">
              <p>将文件拖到此处，或<em>点击上传</em></p>
              <p class="upload-tips">支持 .txt, .md, .docx, .pdf 格式文件</p>
            </div>
          </div>
        </div>

        <input 
          type="file" 
          ref="fileInput"
          @change="handleFileSelect"
          accept=".txt,.md,.docx,.pdf"
          style="display: none"
        />

        <!-- 上传进度条 -->
        <div v-if="uploadProgress > 0" class="progress-section">
          <el-progress 
            :percentage="uploadProgress" 
            :text-inside="true" 
            :stroke-width="20"
            :status="progressStatus"
          />
          <div class="upload-status" :class="statusClass">
            {{ uploadStatusText }}
          </div>
        </div>
      </el-card>
    </div>

    <!-- 知识库列表区域 -->
    <div class="list-section">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>已发布的知识库</span>
            <el-button type="primary" link @click="fetchList" :loading="listLoading">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </template>

        <el-table :data="knowledgeList" v-loading="listLoading" stripe style="width: 100%">
          <el-table-column prop="documentName" label="文件名" min-width="200">
            <template #default="scope">
              <div class="file-info">
                <el-icon><Document /></el-icon>
                <span class="filename">{{ scope.row.documentName }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="uploadTime" label="上传时间" width="180">
            <template #default="scope">
              {{ formatDateTime(scope.row.uploadTime) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120" fixed="right">
            <template #default="scope">
              <el-popconfirm 
                title="确定删除该文档及其向量数据吗？" 
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleDelete(scope.row.id)"
              >
                <template #reference>
                  <el-button link type="danger" size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
          
          <template #empty>
            <el-empty description="暂无知识库文件" />
          </template>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document, Refresh } from '@element-plus/icons-vue'
import { uploadChunk, mergeChunks, getKnowledgeList, deleteKnowledge } from '@/api/knowledge'

// --- 状态定义 ---
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatusText = ref('')
const fileInput = ref(null)
const knowledgeList = ref([])
const listLoading = ref(false)

// 进度条状态样式
const progressStatus = computed(() => {
  if (uploadStatusText.value.includes('失败')) return 'exception'
  if (uploadStatusText.value.includes('成功')) return 'success'
  return ''
})

const statusClass = computed(() => {
  if (uploadStatusText.value.includes('失败')) return 'error'
  if (uploadStatusText.value.includes('成功')) return 'success'
  return ''
})

// --- 文件选择与拖拽逻辑 ---
const showFileInput = () => {
  if (isUploading.value) return ElMessage.warning('正在上传中...')
  fileInput.value.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) startUpload(file)
  event.target.value = '' // 重置input
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  if (isUploading.value) return
  const files = event.dataTransfer.files
  if (files.length > 0) startUpload(files[0])
}

const handleDragOver = (event) => {
  event.preventDefault()
  if (!isUploading.value) isDragOver.value = true
}

const handleDragLeave = (event) => {
  event.preventDefault()
  isDragOver.value = false
}

// --- 核心上传逻辑 ---
const startUpload = async (file) => {
  if (!file) return

  // 1. 初始化参数
  const safeFileName = file.name.replace(/[^\p{L}\p{N}_.-]/gu, "_")
  const tempDirName = `${safeFileName.replace(/\.[^/.]+$/, "")}_${Date.now()}`
  const chunkSize = 5 * 1024 * 1024 // 5MB
  const totalChunks = Math.ceil(file.size / chunkSize)
  const concurrency = 3 // 并发数

  // 重置UI
  uploadProgress.value = 0
  uploadStatusText.value = '准备上传...'
  isUploading.value = true
  
  let uploadedChunksCount = 0

  try {
    // 2. 定义分片上传任务
    const uploadSingleChunk = async (index) => {
      const start = index * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      const formData = new FormData()
      formData.append('file', chunk)
      formData.append('chunkIndex', index)
      formData.append('totalChunks', totalChunks)
      formData.append('fileName', safeFileName)
      formData.append('tempDirName', tempDirName)

      // 调用API上传分片
      await uploadChunk(formData)
      
      // 更新进度
      uploadedChunksCount++
      // 这里的进度只是上传进度，保留最后5%给合并阶段
      uploadProgress.value = Math.floor((uploadedChunksCount / totalChunks) * 95)
    }

    // 3. 并发控制执行
    const pool = new Set()
    for (let i = 0; i < totalChunks; i++) {
      const promise = uploadSingleChunk(i).then(() => pool.delete(promise))
      pool.add(promise)
      if (pool.size >= concurrency) {
        await Promise.race(pool)
      }
    }
    await Promise.all(pool) // 等待所有分片完成

    // 4. 合并请求
    uploadStatusText.value = '正在服务器端合并并处理向量化...'
    
    const res = await mergeChunks({
      fileName: safeFileName,
      tempDirName: tempDirName
    })

    // 5. 处理结果
    // 根据 Result 结构判断：通常 code === 1 或 code === 200 为成功
    // 你的后端返回 Result.success()，假设 code 为 1 或 200，或者 success 为 true
    // 这里假设 code为1代表成功，如果不确定，可以打印 console.log(res) 观察
    if (res.code === 1 || res.code === 200) { 
        uploadProgress.value = 100
        uploadStatusText.value = '上传成功！'
        ElMessage.success(res.data || '上传成功')
        fetchList() // 刷新列表
        
        // 延迟重置
        setTimeout(() => {
            isUploading.value = false
            uploadProgress.value = 0
            uploadStatusText.value = ''
        }, 3000)
    } else {
        throw new Error(res.msg || '合并失败')
    }

  } catch (error) {
    console.error('上传流程错误:', error)
    uploadStatusText.value = '上传失败，请重试'
    isUploading.value = false
    ElMessage.error(error.message || '上传失败')
  }
}

// --- 列表与删除逻辑 ---
const fetchList = async () => {
  listLoading.value = true
  try {
    const res = await getKnowledgeList()
    // 假设后端 Result.data 是 List<DoctorKnowledge>
    if (res.code === 1 || res.code === 200) {
      knowledgeList.value = res.data || []
    } else {
      ElMessage.error(res.msg || '获取列表失败')
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('网络错误，获取列表失败')
  } finally {
    listLoading.value = false
  }
}

const handleDelete = async (id) => {
  try {
    const res = await deleteKnowledge(id)
    if (res.code === 1 || res.code === 200) {
      ElMessage.success('删除成功')
      fetchList()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (error) {
    ElMessage.error('删除请求失败')
  }
}

// --- 工具函数 ---
const formatDateTime = (str) => {
  if (!str) return '-'
  return new Date(str).toLocaleString('zh-CN', { hour12: false })
}

// 初始化
onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.knowledge-management { padding: 0; }
.upload-section { margin-bottom: 20px; }
.list-section { margin-top: 20px; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 拖拽区域 */
.upload-drag-area {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s;
  background-color: #fafafa;
  cursor: pointer;
}
.upload-drag-area:hover, .upload-drag-area.drag-over {
  border-color: #409eff;
  background-color: #ecf5ff;
}
.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.upload-icon {
  font-size: 40px;
  color: #909399;
}
.upload-text em {
  color: #409eff;
  font-style: normal;
}
.upload-tips {
  font-size: 12px;
  color: #909399;
}

/* 进度条 */
.progress-section { margin-top: 20px; }
.upload-status {
  margin-top: 5px;
  text-align: center;
  font-size: 13px;
}
.upload-status.success { color: #67c23a; }
.upload-status.error { color: #f56c6c; }

/* 列表样式 */
.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filename {
  font-weight: 500;
}
</style>