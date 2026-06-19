<template>
  <div class="prompt-editor page-container">
    <div class="page-header">
      <h2 class="page-title">模板编辑器</h2>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新建模板</el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <div class="template-list">
          <div class="section-title">模板列表</div>
          
          <div class="search-bar mb-16">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索模板名称"
              :prefix-icon="Search"
              clearable
              @input="fetchList"
            />
          </div>

          <div class="template-items">
            <div
              v-for="item in templateList"
              :key="item.id"
              class="template-item"
              :class="{ active: currentTemplate?.id === item.id }"
              @click="selectTemplate(item)"
            >
              <div class="item-header">
                <span class="item-name">{{ item.name }}</span>
                <el-tag v-if="item.category" size="small" type="info">{{ item.category }}</el-tag>
              </div>
              <p class="item-desc">{{ item.description || '暂无描述' }}</p>
              <div class="item-footer">
                <span class="item-time">{{ formatTime(item.updated_at) }}</span>
                <div class="item-actions">
                  <el-button size="small" :icon="Edit" @click.stop="handleEdit(item)" />
                  <el-button size="small" type="danger" :icon="Delete" @click.stop="handleDelete(item)" />
                </div>
              </div>
            </div>
          </div>

          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            layout="total, prev, next"
            @current-change="fetchList"
            class="pagination"
          />
        </div>
      </el-col>

      <el-col :span="16">
        <div class="editor-panel">
          <template v-if="currentTemplate">
            <div class="section-title">模板详情</div>
            
            <el-form :model="formData" label-width="100px">
              <el-form-item label="模板名称">
                <el-input v-model="formData.name" placeholder="请输入模板名称" />
              </el-form-item>

              <el-form-item label="分类">
                <el-input v-model="formData.category" placeholder="如：情感分析、风格识别" />
              </el-form-item>

              <el-form-item label="描述">
                <el-input v-model="formData.description" type="textarea" :rows="2" placeholder="描述这个模板的用途" />
              </el-form-item>

              <el-form-item label="系统提示词">
                <el-input
                v-model="formData.system_prompt"
                type="textarea"
                :rows="6"
                placeholder="系统角色设定，定义AI的角色和行为"
              />
              </el-form-item>

              <el-form-item label="用户提示词">
                <el-input
                v-model="formData.user_prompt_template"
                type="textarea"
                :rows="10"
                placeholder="用户提示词模板，使用 {{变量名}} 作为占位符"
              />
                <div class="hint">
                  <span class="hint-title">可用变量：</span>
                  <el-tag size="small" v-for="v in defaultVariables" :key="v" class="var-tag">{{ formatVarName(v) }}</el-tag>
                </div>
              </el-form-item>

              <el-form-item label="变量列表">
                <el-select
                  v-model="selectedVariables"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或创建变量"
                  @change="handleVariablesChange"
                >
                  <el-option v-for="v in allVariables" :key="v" :label="v" :value="v" />
                </el-select>
              </el-form-item>
            </el-form>

            <div class="form-actions">
              <el-button @click="resetForm">重置</el-button>
              <el-button type="primary" :icon="View" @click="handlePreview">预览</el-button>
              <el-button type="success" :icon="Check" @click="handleSave">保存</el-button>
            </div>
          </template>

          <div v-else class="empty-state">
            <el-empty description="请选择或创建一个模板" />
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="previewVisible" title="提示词预览" width="700px">
      <div class="preview-content">
        <div class="preview-section">
          <h4>系统提示词</h4>
          <div class="preview-text">{{ previewResult.system_prompt }}</div>
        </div>
        <div class="preview-section">
          <h4>用户提示词</h4>
          <div class="preview-text">{{ previewResult.user_prompt }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Edit, Delete, View, Check } from '@element-plus/icons-vue'
import {
  getPromptList,
  createPrompt,
  updatePrompt,
  deletePrompt,
  previewPrompt
} from '@/api/prompts'

const searchKeyword = ref('')
const templateList = ref([])
const currentTemplate = ref(null)
const previewVisible = ref(false)
const previewResult = ref({ system_prompt: '', user_prompt: '' })
const selectedVariables = ref([])

const defaultVariables = ['script_text', 'expected_emotion', 'expected_style']
const allVariables = ref(['script_text', 'expected_emotion', 'expected_style'])

function formatVarName(v) {
  return '{' + '{' + v + '}' + '}'
}

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const defaultForm = {
  id: null,
  name: '',
  description: '',
  system_prompt: '',
  user_prompt_template: '',
  variables: [],
  category: ''
}

const formData = reactive({ ...defaultForm })

async function fetchList() {
  try {
    const res = await getPromptList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value
    })
    templateList.value = res.list
    pagination.total = res.total
  } catch (e) {
    console.error(e)
  }
}

function selectTemplate(item) {
  currentTemplate.value = item
  Object.assign(formData, {
    id: item.id,
    name: item.name,
    description: item.description || '',
    system_prompt: item.system_prompt,
    user_prompt_template: item.user_prompt_template,
    variables: item.variables || [],
    category: item.category || ''
  })
  selectedVariables.value = item.variables || []
}

function handleCreate() {
  currentTemplate.value = null
  Object.assign(formData, defaultForm)
  selectedVariables.value = []
}

function handleEdit(item) {
  selectTemplate(item)
}

async function handleSave() {
  if (!formData.name) {
    ElMessage.warning('请输入模板名称')
    return
  }
  if (!formData.system_prompt) {
    ElMessage.warning('请输入系统提示词')
    return
  }
  if (!formData.user_prompt_template) {
    ElMessage.warning('请输入用户提示词模板')
    return
  }

  try {
    const data = {
      name: formData.name,
      description: formData.description,
      system_prompt: formData.system_prompt,
      user_prompt_template: formData.user_prompt_template,
      variables: selectedVariables.value,
      category: formData.category
    }

    if (formData.id) {
      await updatePrompt(formData.id, data)
      ElMessage.success('更新成功')
    } else {
      const res = await createPrompt(data)
      formData.id = res.id
      currentTemplate.value = { ...currentTemplate.value, ...res }
      ElMessage.success('创建成功')
    }
    fetchList()
  } catch (e) {
    console.error(e)
  }
}

async function handleDelete(item) {
  try {
    await ElMessageBox.confirm('确定要删除这个模板吗？', '提示', {
      type: 'warning'
    })
    await deletePrompt(item.id)
    ElMessage.success('删除成功')
    if (currentTemplate.value?.id === item.id) {
      currentTemplate.value = null
      Object.assign(formData, defaultForm)
    }
    fetchList()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

function resetForm() {
  if (currentTemplate.value) {
    selectTemplate(currentTemplate.value)
  } else {
    Object.assign(formData, defaultForm)
    selectedVariables.value = []
  }
}

function handleVariablesChange(val) {
  formData.variables = val
}

async function handlePreview() {
  if (formData.id) {
    try {
      const variables = {}
      selectedVariables.value.forEach(v => {
        variables[v] = `[${v}示例值]`
      })
      const res = await previewPrompt(formData.id, variables)
      previewResult.value = res
      previewVisible.value = true
    } catch (e) {
      console.error(e)
    }
  } else {
    ElMessage.warning('请先保存模板再预览')
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
.prompt-editor {
  .template-list {
    background: #f5f7fa;
    border-radius: 8px;
    padding: 16px;
    min-height: 600px;
  }

  .template-items {
    min-height: 450px;
  }

  .template-item {
    background: #fff;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 10px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
    }

    &.active {
      border-color: #409eff;
      background: #ecf5ff;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .item-name {
      font-weight: 600;
      color: #303133;
      font-size: 14px;
    }

    .item-desc {
      color: #909399;
      font-size: 12px;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .item-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .item-time {
        font-size: 12px;
        color: #c0c4cc;
      }

      .item-actions {
        opacity: 0;
        transition: opacity 0.2s;
      }
    }

    &:hover .item-actions {
      opacity: 1;
    }
  }

  .pagination {
    justify-content: center;
    margin-top: 16px;
  }

  .editor-panel {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    min-height: 600px;
  }

  .hint {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;

    .hint-title {
      margin-right: 8px;
    }

    .var-tag {
      margin-right: 6px;
      cursor: pointer;
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;
  }

  .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;
  }

  .preview-content {
    .preview-section {
      margin-bottom: 20px;

      h4 {
        margin-bottom: 8px;
        color: #303133;
        font-size: 14px;
      }

      .preview-text {
        background: #f5f7fa;
        padding: 12px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }
}
</style>
