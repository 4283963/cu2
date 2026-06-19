<template>
  <div class="test-config page-container">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="测试用例" name="cases">
        <div class="tab-header">
          <div class="search-bar">
            <el-input
              v-model="caseSearch"
              placeholder="搜索用例名称或脚本内容"
              :prefix-icon="Search"
              clearable
              style="width: 300px"
              @input="fetchCaseList"
            />
          </div>
          <el-button type="primary" :icon="Plus" @click="openCaseDialog()">新建用例</el-button>
        </div>

        <el-table :data="caseList" border stripe>
          <el-table-column prop="name" label="用例名称" width="180" />
          <el-table-column prop="script_text" label="脚本内容" show-overflow-tooltip />
          <el-table-column prop="expected_emotion" label="预期情感" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.expected_emotion" size="small" type="warning">{{ row.expected_emotion }}</el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="expected_style" label="预期风格" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.expected_style" size="small" type="success">{{ row.expected_style }}</el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="180">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openCaseDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDeleteCase(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="casePagination.page"
          v-model:page-size="casePagination.pageSize"
          :total="casePagination.total"
          layout="total, prev, pager, next"
          class="pagination"
          @current-change="fetchCaseList"
        />
      </el-tab-pane>

      <el-tab-pane label="测试集" name="sets">
        <div class="tab-header">
          <span class="section-title" style="border: none; padding: 0; margin: 0;">测试集列表</span>
          <el-button type="primary" :icon="Plus" @click="openSetDialog()">新建测试集</el-button>
        </div>

        <el-row :gutter="16">
          <el-col :span="8" v-for="set in testSetList" :key="set.id">
            <el-card class="set-card" shadow="hover">
              <template #header>
                <div class="card-header">
                  <span class="set-name">{{ set.name }}</span>
                  <el-dropdown>
                    <el-button type="primary" link :icon="MoreFilled" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="openSetDialog(set)">编辑</el-dropdown-item>
                        <el-dropdown-item @click="manageSetCases(set)">管理用例</el-dropdown-item>
                        <el-dropdown-item divided @click="deleteSet(set)">删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
              <p class="set-desc">{{ set.description || '暂无描述' }}</p>
              <div class="set-footer">
                <el-tag size="small">{{ set.case_count }} 个用例</el-tag>
                <span class="set-time">{{ formatTime(set.created_at) }}</span>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-pagination
          v-model:current-page="setPagination.page"
          v-model:page-size="setPagination.pageSize"
          :total="setPagination.total"
          layout="total, prev, pager, next"
          class="pagination"
          @current-change="fetchSetList"
        />
      </el-tab-pane>

      <el-tab-pane label="运行测试" name="run">
        <div class="run-test-panel">
          <div class="section-title">启动测试任务</div>
          
          <el-form :model="runForm" label-width="120px" style="max-width: 600px;">
            <el-form-item label="选择测试集" required>
              <el-select v-model="runForm.test_set_id" placeholder="请选择测试集" style="width: 100%;">
                <el-option
                  v-for="set in testSetList"
                  :key="set.id"
                  :label="`${set.name} (${set.case_count}个用例)`"
                  :value="set.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="选择提示词模板" required>
              <el-select v-model="runForm.prompt_template_id" placeholder="请选择提示词模板" style="width: 100%;">
                <el-option
                  v-for="tpl in promptList"
                  :key="tpl.id"
                  :label="tpl.name"
                  :value="tpl.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="选择模型" required>
              <el-select v-model="runForm.model_id" placeholder="请选择模型" style="width: 100%;">
                <el-option
                  v-for="m in modelList"
                  :key="m.id"
                  :label="`${m.name} (${m.model_name})`"
                  :value="m.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :icon="VideoPlay" @click="startRun" :loading="running">
                开始测试
              </el-button>
              <el-button @click="goToResults">查看结果</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="recent-runs mt-20">
          <div class="section-title">最近运行</div>
          <el-table :data="recentRuns" border>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="test_set_name" label="测试集" width="150" />
            <el-table-column prop="prompt_template_name" label="提示词模板" width="150" />
            <el-table-column prop="model_name" label="模型" width="150" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结果" width="150">
              <template #default="{ row }">
                <span v-if="row.status === 'completed'">
                  {{ row.passed_cases }}/{{ row.total_cases }} 通过
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="viewRunDetail(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="caseDialogVisible" :title="caseForm.id ? '编辑用例' : '新建用例'" width="600px">
      <el-form :model="caseForm" label-width="100px">
        <el-form-item label="用例名称" required>
          <el-input v-model="caseForm.name" placeholder="请输入用例名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="caseForm.description" type="textarea" :rows="2" placeholder="用例描述" />
        </el-form-item>
        <el-form-item label="脚本内容" required>
          <el-input v-model="caseForm.script_text" type="textarea" :rows="4" placeholder="配音脚本内容" />
        </el-form-item>
        <el-form-item label="预期情感">
          <el-select v-model="caseForm.expected_emotion" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="e in emotionOptions" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="预期风格">
          <el-select v-model="caseForm.expected_style" filterable allow-create default-first-option placeholder="选择或输入" style="width: 100%;">
            <el-option v-for="s in styleOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="caseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCase">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="setDialogVisible" :title="setForm.id ? '编辑测试集' : '新建测试集'" width="500px">
      <el-form :model="setForm" label-width="100px">
        <el-form-item label="测试集名称" required>
          <el-input v-model="setForm.name" placeholder="请输入测试集名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="setForm.description" type="textarea" :rows="3" placeholder="测试集描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="setDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSet">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="caseManagerVisible" title="管理测试集用例" width="800px">
      <div v-if="currentSet">
        <div class="mb-16">
          <span style="margin-right: 10px;">测试集：</span>
          <el-tag type="primary">{{ currentSet.name }}</el-tag>
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="panel-title">可用用例</div>
            <div class="case-list-panel">
              <div
                v-for="c in availableCases"
                :key="c.id"
                class="case-item"
                @click="addCaseToSet(c)"
              >
                <span class="case-name">{{ c.name }}</span>
                <el-button size="small" :icon="Plus" circle />
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="panel-title">已选用例 ({{ selectedCases.length }})</div>
            <div class="case-list-panel">
              <div
                v-for="c in selectedCases"
                :key="c.id"
                class="case-item selected"
              >
                <span class="case-name">{{ c.name }}</span>
                <el-button size="small" type="danger" :icon="Close" circle @click="handleRemoveCaseFromSet(c)" />
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button @click="caseManagerVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Search, VideoPlay, MoreFilled, Close
} from '@element-plus/icons-vue'
import {
  getCaseList, createCase, updateCase, deleteCase,
  getTestSetList, getTestSetDetail, createTestSet, updateTestSet, deleteTestSet,
  addCasesToSet, removeCaseFromSet,
  startTestRun, getTestRunList
} from '@/api/tests'
import { getPromptList } from '@/api/prompts'
import { getModelList } from '@/api/models'
import { getEmotionTags, getStyleTags } from '@/api/audio'

const router = useRouter()
const activeTab = ref('cases')

const caseSearch = ref('')
const caseList = ref([])
const casePagination = reactive({ page: 1, pageSize: 10, total: 0 })

const testSetList = ref([])
const setPagination = reactive({ page: 1, pageSize: 12, total: 0 })

const promptList = ref([])
const modelList = ref([])

const emotionOptions = ref([])
const styleOptions = ref([])

const caseDialogVisible = ref(false)
const caseForm = reactive({ id: null, name: '', description: '', script_text: '', expected_emotion: '', expected_style: '' })

const setDialogVisible = ref(false)
const setForm = reactive({ id: null, name: '', description: '' })

const caseManagerVisible = ref(false)
const currentSet = ref(null)
const selectedCases = ref([])
const availableCases = ref([])

const runForm = reactive({
  test_set_id: null,
  prompt_template_id: null,
  model_id: null
})
const running = ref(false)
const recentRuns = ref([])

async function fetchCaseList() {
  try {
    const res = await getCaseList({
      page: casePagination.page,
      pageSize: casePagination.pageSize,
      keyword: caseSearch.value
    })
    caseList.value = res.list
    casePagination.total = res.total
  } catch (e) {
    console.error(e)
  }
}

async function fetchSetList() {
  try {
    const res = await getTestSetList({
      page: setPagination.page,
      pageSize: setPagination.pageSize
    })
    testSetList.value = res.list
    setPagination.total = res.total
  } catch (e) {
    console.error(e)
  }
}

async function fetchPromptList() {
  try {
    const res = await getPromptList({ pageSize: 100 })
    promptList.value = res.list
  } catch (e) {
    console.error(e)
  }
}

async function fetchModelList() {
  try {
    modelList.value = await getModelList()
  } catch (e) {
    console.error(e)
  }
}

async function fetchTags() {
  try {
    emotionOptions.value = await getEmotionTags()
    styleOptions.value = await getStyleTags()
  } catch (e) {
    console.error(e)
  }
}

async function fetchRecentRuns() {
  try {
    const res = await getTestRunList({ pageSize: 10 })
    recentRuns.value = res.list
  } catch (e) {
    console.error(e)
  }
}

function openCaseDialog(row = null) {
  if (row) {
    Object.assign(caseForm, row)
  } else {
    Object.assign(caseForm, { id: null, name: '', description: '', script_text: '', expected_emotion: '', expected_style: '' })
  }
  caseDialogVisible.value = true
}

async function saveCase() {
  if (!caseForm.name || !caseForm.script_text) {
    ElMessage.warning('请填写用例名称和脚本内容')
    return
  }
  try {
    if (caseForm.id) {
      await updateCase(caseForm.id, caseForm)
      ElMessage.success('更新成功')
    } else {
      await createCase(caseForm)
      ElMessage.success('创建成功')
    }
    caseDialogVisible.value = false
    fetchCaseList()
  } catch (e) {
    console.error(e)
  }
}

async function handleDeleteCase(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个用例吗？', '提示', { type: 'warning' })
    await deleteCase(row.id)
    ElMessage.success('删除成功')
    fetchCaseList()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

function openSetDialog(row = null) {
  if (row) {
    Object.assign(setForm, row)
  } else {
    Object.assign(setForm, { id: null, name: '', description: '' })
  }
  setDialogVisible.value = true
}

async function saveSet() {
  if (!setForm.name) {
    ElMessage.warning('请输入测试集名称')
    return
  }
  try {
    if (setForm.id) {
      await updateTestSet(setForm.id, setForm)
      ElMessage.success('更新成功')
    } else {
      await createTestSet(setForm)
      ElMessage.success('创建成功')
    }
    setDialogVisible.value = false
    fetchSetList()
  } catch (e) {
    console.error(e)
  }
}

async function deleteSet(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个测试集吗？', '提示', { type: 'warning' })
    await deleteTestSet(row.id)
    ElMessage.success('删除成功')
    fetchSetList()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function manageSetCases(set) {
  currentSet.value = set
  caseManagerVisible.value = true
  
  try {
    const [detail, allCases] = await Promise.all([
      getTestSetDetail(set.id),
      getCaseList({ pageSize: 100 })
    ])
    
    selectedCases.value = detail.cases || []
    
    const selectedIds = new Set(selectedCases.value.map(c => c.id))
    availableCases.value = allCases.list.filter(c => !selectedIds.has(c.id))
  } catch (e) {
    console.error(e)
  }
}

async function addCaseToSet(c) {
  try {
    await addCasesToSet(currentSet.value.id, [c.id])
    selectedCases.value.push(c)
    availableCases.value = availableCases.value.filter(item => item.id !== c.id)
    ElMessage.success('添加成功')
  } catch (e) {
    console.error(e)
  }
}

async function handleRemoveCaseFromSet(c) {
  try {
    await removeCaseFromSet(currentSet.value.id, c.id)
    availableCases.value.push(c)
    selectedCases.value = selectedCases.value.filter(item => item.id !== c.id)
    ElMessage.success('移除成功')
  } catch (e) {
    console.error(e)
  }
}

async function startRun() {
  if (!runForm.test_set_id || !runForm.prompt_template_id || !runForm.model_id) {
    ElMessage.warning('请选择测试集、提示词模板和模型')
    return
  }
  
  running.value = true
  try {
    await startTestRun(runForm)
    ElMessage.success('测试任务已启动')
    fetchRecentRuns()
  } catch (e) {
    console.error(e)
  } finally {
    running.value = false
  }
}

function goToResults() {
  router.push('/results')
}

function viewRunDetail(row) {
  router.push({ path: '/results', query: { runId: row.id } })
}

function getStatusType(status) {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

function formatTime(time) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchCaseList()
  fetchSetList()
  fetchPromptList()
  fetchModelList()
  fetchTags()
  fetchRecentRuns()
})
</script>

<style scoped lang="scss">
.test-config {
  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .pagination {
    justify-content: flex-end;
    margin-top: 16px;
  }

  .text-muted {
    color: #c0c4cc;
  }

  .set-card {
    margin-bottom: 16px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .set-name {
        font-weight: 600;
        font-size: 15px;
      }
    }

    .set-desc {
      color: #606266;
      font-size: 13px;
      min-height: 40px;
      margin-bottom: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .set-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .set-time {
        font-size: 12px;
        color: #c0c4cc;
      }
    }
  }

  .run-test-panel {
    background: #f5f7fa;
    padding: 20px;
    border-radius: 8px;
  }

  .panel-title {
    font-weight: 600;
    margin-bottom: 10px;
    color: #303133;
  }

  .case-list-panel {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 10px;
    min-height: 300px;
    max-height: 400px;
    overflow-y: auto;
    background: #fafafa;
  }

  .case-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #fff;
    border-radius: 4px;
    margin-bottom: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
    }

    &.selected {
      background: #ecf5ff;
      border-color: #b3d8ff;

      .case-name {
        color: #409eff;
      }
    }

    .case-name {
      font-size: 13px;
    }
  }
}
</style>
