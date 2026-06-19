<template>
  <div class="audio-library page-container">
    <div class="page-header">
      <h2 class="page-title">音频资产库</h2>
      <el-button type="primary" :icon="Upload" @click="uploadDialogVisible = true">上传音频</el-button>
    </div>

    <div class="filter-bar mb-20">
      <el-input
        v-model="keyword"
        placeholder="搜索音频名称/描述/转写"
        :prefix-icon="Search"
        clearable
        style="width: 280px"
        @input="fetchList"
      />
      <el-select v-model="filterEmotion" placeholder="情感标签" clearable style="width: 140px" @change="fetchList">
        <el-option v-for="e in emotionTags" :key="e" :label="e" :value="e" />
      </el-select>
      <el-select v-model="filterStyle" placeholder="风格标签" clearable style="width: 140px" @change="fetchList">
        <el-option v-for="s in styleTags" :key="s" :label="s" :value="s" />
      </el-select>
    </div>

    <el-table :data="audioList" border stripe>
      <el-table-column label="预览" width="80">
        <template #default="{ row }">
          <el-button type="primary" link :icon="VideoPlay" @click="playAudio(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="original_name" label="文件名" show-overflow-tooltip />
      <el-table-column prop="emotion_tag" label="情感" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.emotion_tag" size="small" type="warning">{{ row.emotion_tag }}</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="style_tag" label="风格" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.style_tag" size="small" type="success">{{ row.style_tag }}</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.description || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="transcript" label="转写文本" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.transcript || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="上传时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editAudio(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDeleteAudio(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, prev, pager, next"
      class="pagination"
      @current-change="fetchList"
    />

    <el-dialog v-model="uploadDialogVisible" title="上传音频" width="600px">
      <el-upload
        ref="uploadRef"
        :action="uploadUrl"
        :data="uploadData"
        :auto-upload="false"
        :show-file-list="true"
        :limit="1"
        accept="audio/*"
        :on-change="handleFileChange"
      >
        <el-button type="primary" :icon="Upload">选择音频文件</el-button>
        <template #tip>
          <div class="el-upload__tip">
            支持 mp3、wav、ogg、m4a、aac 格式，单个文件不超过 50MB
          </div>
        </template>
      </el-upload>

      <el-form :model="audioForm" label-width="100px" class="mt-20">
        <el-form-item label="情感标签">
          <el-select v-model="audioForm.emotion_tag" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="e in emotionTags" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="风格标签">
          <el-select v-model="audioForm.style_tag" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="s in styleTags" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="audioForm.description" type="textarea" :rows="2" placeholder="音频描述" />
        </el-form-item>
        <el-form-item label="转写文本">
          <el-input v-model="audioForm.transcript" type="textarea" :rows="3" placeholder="音频转写的文字内容" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑音频信息" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="情感标签">
          <el-select v-model="editForm.emotion_tag" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="e in emotionTags" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="风格标签">
          <el-select v-model="editForm.style_tag" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="s in styleTags" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" placeholder="音频描述" />
        </el-form-item>
        <el-form-item label="转写文本">
          <el-input v-model="editForm.transcript" type="textarea" :rows="3" placeholder="音频转写的文字内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="playerVisible" title="音频播放" width="500px">
      <div v-if="currentAudio" class="audio-player">
        <h4>{{ currentAudio.original_name }}</h4>
        <div class="audio-tags">
          <el-tag v-if="currentAudio.emotion_tag" type="warning">{{ currentAudio.emotion_tag }}</el-tag>
          <el-tag v-if="currentAudio.style_tag" type="success" style="margin-left: 8px;">{{ currentAudio.style_tag }}</el-tag>
        </div>
        <audio :src="currentAudio.url" controls style="width: 100%; margin-top: 16px;" />
        <p v-if="currentAudio.description" class="audio-desc">{{ currentAudio.description }}</p>
        <div v-if="currentAudio.transcript" class="audio-transcript">
          <div class="transcript-label">转写文本：</div>
          <div class="transcript-content">{{ currentAudio.transcript }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Search, VideoPlay } from '@element-plus/icons-vue'
import {
  getAudioList, uploadAudio, updateAudio, deleteAudio,
  getEmotionTags, getStyleTags
} from '@/api/audio'

const keyword = ref('')
const filterEmotion = ref('')
const filterStyle = ref('')
const audioList = ref([])
const emotionTags = ref([])
const styleTags = ref([])
const uploadRef = ref(null)
const uploadDialogVisible = ref(false)
const editDialogVisible = ref(false)
const playerVisible = ref(false)
const currentAudio = ref(null)
const uploading = ref(false)

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const audioForm = reactive({
  emotion_tag: '',
  style_tag: '',
  description: '',
  transcript: ''
})

const editForm = reactive({
  id: null,
  emotion_tag: '',
  style_tag: '',
  description: '',
  transcript: ''
})

const uploadUrl = '/api/audio/upload'

const uploadData = computed(() => ({
  emotion_tag: audioForm.emotion_tag,
  style_tag: audioForm.style_tag,
  description: audioForm.description,
  transcript: audioForm.transcript
}))

async function fetchList() {
  try {
    const res = await getAudioList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      emotion: filterEmotion.value,
      style: filterStyle.value,
      keyword: keyword.value
    })
    audioList.value = res.list
    pagination.total = res.total
  } catch (e) {
    console.error(e)
  }
}

async function fetchTags() {
  try {
    emotionTags.value = await getEmotionTags()
    styleTags.value = await getStyleTags()
  } catch (e) {
    console.error(e)
  }
}

function handleFileChange(file) {
  // 文件选择变化
}

async function submitUpload() {
  if (!uploadRef.value || !uploadRef.value.uploadFiles.length) {
    ElMessage.warning('请先选择音频文件')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('audio', uploadRef.value.uploadFiles[0].raw)
    formData.append('emotion_tag', audioForm.emotion_tag)
    formData.append('style_tag', audioForm.style_tag)
    formData.append('description', audioForm.description)
    formData.append('transcript', audioForm.transcript)

    await uploadAudio(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    uploadRef.value?.clearFiles()
    Object.assign(audioForm, { emotion_tag: '', style_tag: '', description: '', transcript: '' })
    fetchList()
    fetchTags()
  } catch (e) {
    console.error(e)
  } finally {
    uploading.value = false
  }
}

function editAudio(row) {
  Object.assign(editForm, {
    id: row.id,
    emotion_tag: row.emotion_tag || '',
    style_tag: row.style_tag || '',
    description: row.description || '',
    transcript: row.transcript || ''
  })
  editDialogVisible.value = true
}

async function saveEdit() {
  try {
    await updateAudio(editForm.id, editForm)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    fetchList()
    fetchTags()
  } catch (e) {
    console.error(e)
  }
}

async function handleDeleteAudio(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个音频文件吗？此操作不可恢复。', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await deleteAudio(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

function playAudio(row) {
  currentAudio.value = row
  playerVisible.value = true
}

function formatTime(time) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchList()
  fetchTags()
})
</script>

<style scoped lang="scss">
.audio-library {
  .filter-bar {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .text-muted {
    color: #c0c4cc;
  }

  .pagination {
    justify-content: flex-end;
    margin-top: 16px;
  }

  .mt-20 {
    margin-top: 20px;
  }

  .audio-player {
    h4 {
      margin: 0 0 12px 0;
      color: #303133;
    }

    .audio-tags {
      margin-bottom: 8px;
    }

    .audio-desc {
      margin-top: 12px;
      color: #606266;
      font-size: 13px;
    }

    .audio-transcript {
      margin-top: 16px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;

      .transcript-label {
        font-size: 12px;
        color: #909399;
        margin-bottom: 6px;
      }

      .transcript-content {
        font-size: 13px;
        color: #606266;
        line-height: 1.6;
      }
    }
  }
}
</style>
