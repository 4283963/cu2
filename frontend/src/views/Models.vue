<template>
  <div class="models-page page-container">
    <div class="page-header">
      <h2 class="page-title">模型配置</h2>
      <el-button type="primary" :icon="Plus" @click="openDialog()">添加模型</el-button>
    </div>

    <el-table :data="modelList" border stripe>
      <el-table-column prop="name" label="模型名称" width="180" />
      <el-table-column prop="model_name" label="模型标识" width="200" />
      <el-table-column prop="api_base" label="API 地址" show-overflow-tooltip />
      <el-table-column prop="endpoint" label="端点" width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="testConnection(row)">测试</el-button>
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDeleteModel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑模型' : '添加模型'" width="550px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="显示名称" required>
          <el-input v-model="form.name" placeholder="模型的显示名称，如：本地Qwen-7B" />
        </el-form-item>
        <el-form-item label="API 地址" required>
          <el-input v-model="form.api_base" placeholder="http://localhost:8000/v1" />
          <div class="form-tip">支持 OpenAI 兼容的本地模型 API，如 Ollama、vLLM、LM Studio 等</div>
        </el-form-item>
        <el-form-item label="模型名称" required>
          <el-input v-model="form.model_name" placeholder="qwen2.5-7b-instruct" />
          <div class="form-tip">实际调用的模型标识名称</div>
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="form.api_key" type="password" placeholder="可选，本地模型一般不需要" show-password />
        </el-form-item>
        <el-form-item label="端点路径">
          <el-input v-model="form.endpoint" placeholder="/v1/chat/completions" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveModel">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getModelList, createModel, updateModel, deleteModel, testModel
} from '@/api/models'

const modelList = ref([])
const dialogVisible = ref(false)
const form = reactive({
  id: null,
  name: '',
  api_base: '',
  api_key: '',
  model_name: '',
  endpoint: '/v1/chat/completions',
  is_active: 1
})

async function fetchList() {
  try {
    modelList.value = await getModelList()
  } catch (e) {
    console.error(e)
  }
}

function openDialog(row = null) {
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      id: null,
      name: '',
      api_base: '',
      api_key: '',
      model_name: '',
      endpoint: '/v1/chat/completions',
      is_active: 1
    })
  }
  dialogVisible.value = true
}

async function saveModel() {
  if (!form.name || !form.api_base || !form.model_name) {
    ElMessage.warning('请填写名称、API地址和模型名称')
    return
  }

  try {
    if (form.id) {
      await updateModel(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await createModel(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    console.error(e)
  }
}

async function handleDeleteModel(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个模型配置吗？', '提示', {
      type: 'warning'
    })
    await deleteModel(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function testConnection(row) {
  const loading = ElMessage.loading('正在测试连接...')
  try {
    const res = await testModel(row.id)
    loading.close()
    ElMessage.success(`连接成功！响应：${res.response}`)
  } catch (e) {
    loading.close()
    ElMessage.error('连接失败，请检查配置')
  }
}

function formatTime(time) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">
.models-page {
  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
