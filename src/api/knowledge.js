import request from '@/utils/request'

// 上传分片
export function uploadChunk(formData) {
  return request({
    url: '/doctor/knowledge/upload-chunk',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000 // 覆盖默认5s超时，设置为60s
  })
}

// 合并分片并保存 (耗时操作)
export function mergeChunks(data) {
  return request({
    url: '/doctor/knowledge/merge',
    method: 'post',
    data: data,
    timeout: 120000 // 向量化可能很慢，设置为 120s
  })
}

// 获取列表
export function getKnowledgeList() {
  return request({
    url: '/doctor/knowledge/list',
    method: 'get'
  })
}

// 删除文档
export function deleteKnowledge(id) {
  return request({
    url: `/doctor/knowledge/${id}`,
    method: 'delete'
  })
}