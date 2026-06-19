<template>
  <div class="results-page page-container">
    <div class="page-header">
      <h2 class="page-title">结果对比看板</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="fetchRunList" circle />
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="6">
        <div class="run-list-panel">
          <div class="section-title">测试运行列表</div>
          
          <div class="search-bar mb-16">
            <el-input
              v-model="runSearch"
              placeholder="搜索测试集/模型"
              :prefix-icon="Search"
              clearable
              @input="fetchRunList"
            />
          </div>

          <div class="run-list">
            <div
              v-for="run in runList"
              :key="run.id"
              class="run-item"
              :class="{ active: selectedRun?.id === run.id }"
              @click="selectRun(run)"
            >
              <div class="run-header">
                <span class="run-name">{{ run.test_set_name || '未知测试集' }}</span>
                <el-tag :type="getStatusType(run.status)" size="small">{{ getStatusText(run.status) }}</el-tag>
              </div>
              <div class="run-meta">
                <span class="meta-item">
                  <el-icon size="12"><Cpu /></el-icon>
                  {{ run.model_name || '未知模型' }}
                </span>
                <span class="meta-item">
                  <el-icon size="12"><Edit /></el-icon>
                  {{ run.prompt_template_name || '未知模板' }}
                </span>
              </div>
              <div class="run-stats" v-if="run.status === 'completed'">
                <el-progress
                  :percentage="Math.round((run.passed_cases / run.total_cases) * 100)"
                  :stroke-width="6"
                  :show-text="false"
                />
                <span class="stats-text">{{ run.passed_cases }}/{{ run.total_cases }} 通过</span>
              </div>
              <div class="run-time">{{ formatTime(run.created_at) }}</div>
            </div>
          </div>

          <el-pagination
            v-model:current-page="runPagination.page"
            v-model:page-size="runPagination.pageSize"
            :total="runPagination.total"
            layout="prev, pager, next"
            small
            class="pagination"
            @current-change="fetchRunList"
          />
        </div>
      </el-col>

      <el-col :span="18">
        <div v-if="selectedRun" class="detail-panel">
          <div class="detail-header">
            <div>
            <h3>{{ selectedRun.test_set_name }}</h3>
            <p class="run-subtitle">
              <el-tag size="small" type="info">{{ selectedRun.model_name }}</el-tag>
              <el-tag size="small" type="success">{{ selectedRun.prompt_template_name }}</el-tag>
              <span class="time-text">{{ formatTime(selectedRun.created_at) }}</span>
            </p>
            </div>
            <el-checkbox v-if="selectedRun.status === 'completed'">
              <el-statistic
                title="通过率"
                :value="Math.round((selectedRun.passed_cases / selectedRun.total_cases) * 100)"
                suffix="%"
              />
            </div>
          </div>

          <el-row :gutter="16" class="stats-cards">
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-title">总用例数</div>
                <div class="stat-value">{{ selectedRun.total_cases }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card success">
                <div class="stat-title">通过</div>
                <div class="stat-value">{{ selectedRun.passed_cases }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card danger">
                <div class="stat-title">失败</div>
                <div class="stat-value">{{ selectedRun.failed_cases }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card warning">
                <div class="stat-title">平均分</div>
                <div class="stat-value">{{ avgScore.toFixed(2) }}</div>
              </el-card>
            </el-col>
          </el-row>

          <div class="chart-section">
            <div class="section-title">评分分布</div>
            <div ref="chartRef" class="chart-container"></div>
          </div>

          <div class="results-section">
            <div class="section-title">详细结果</div>
            
            <el-table :data="selectedRun.results" border stripe>
              <el-table-column type="index" label="#" width="60" />
              <el-table-column prop="test_case_name" label="用例名称" width="150" />
              <el-table-column label="脚本内容" show-overflow-tooltip>
                <template #default="{ row }">{{ row.script_text }}</template>
              </el-table-column>
              <el-table-column label="预期" width="140">
                <template #default="{ row }">
                  <div>
                <el-tag size="small" type="warning">{{ row.expected_emotion || '-' }}</el-tag>
                <el-tag size="small" type="success" style="margin-left: 4px;">{{ row.expected_style || '-' }}</el-tag>
              </div>
                </template>
              </el-table-column>
              <el-table-column label="模型识别" width="140">
                <template #default="{ row }">
                  <div>
                    <el-tag size="small" :type="row.detected_emotion === row.expected_emotion ? 'success' : 'danger'">
                      {{ row.detected_emotion || '-' }}
                    </el-tag>
                    <el-tag
                      size="small"
                      :type="row.detected_style === row.expected_style ? 'success' : 'danger'"
                      style="margin-left: 4px;"
                    >
                      {{ row.detected_style || '-' }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="evaluation_score" label="评分" width="100">
                <template #default="{ row }">
                  <el-progress
                  :percentage="Math.round((row.evaluation_score || 0) * 100)"
                  :stroke-width="4"
                  :show-text="false"
                  :status="row.evaluation_score >= 0.6 ? 'success' : 'exception'"
                />
                  <span class="score-text">{{ (row.evaluation_score || 0).toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="viewResultDetail(row)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-else class="empty-state">
          <el-empty description="请选择一个测试运行查看详情" />
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="detailVisible" title="结果详情" width="700px">
      <div v-if="currentResult" class="result-detail">
        <div class="detail-item">
          <span class="label">用例名称：</span>
          <span class="value">{{ currentResult.test_case_name }}</span>
        </div>
        <div class="detail-item">
          <span class="label">脚本内容：</span>
          <div class="value script-text">{{ currentResult.script_text }}</div>
        </div>
        <el-divider />
        <div class="detail-item">
          <span class="label">预期情感：</span>
          <el-tag type="warning">{{ currentResult.expected_emotion || '-' }}</el-tag>
        </div>
        <div class="detail-item">
          <span class="label">预期风格：</span>
          <el-tag type="success">{{ currentResult.expected_style || '-' }}</el-tag>
        </div>
        <el-divider />
        <div class="detail-item">
          <span class="label">识别情感：</span>
          <el-tag :type="currentResult.detected_emotion === currentResult.expected_emotion ? 'success' : 'danger'">
            {{ currentResult.detected_emotion || '-' }}
          </el-tag>
        </div>
        <div class="detail-item">
          <span class="label">识别风格：</span>
          <el-tag :type="currentResult.detected_style === currentResult.expected_style ? 'success' : 'danger'">
            {{ currentResult.detected_style || '-' }}
          </el-tag>
        </div>
        <div class="detail-item">
          <span class="label">匹配音频：</span>
          <span class="value">{{ currentResult.matched_audio_name || '无' }}</span>
          <el-button v-if="currentResult.matched_audio_url" size="small" type="primary" link>
            <el-icon><Headset /></el-icon> 试听
          </el-button>
        </div>
        <div class="detail-item">
          <span class="label">评估分数：</span>
          <span class="value score-big">{{ (currentResult.evaluation_score || 0).toFixed(2) }}</span>
        </div>
        <el-divider />
        <div class="detail-item">
          <span class="label">模型输出：</span>
          <div class="model-output">{{ currentResult.model_output || '-' }}</div>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="compareVisible" title="对比测试" width="900px">
      <div class="compare-panel">
        <div class="compare-select">
          <span>选择运行：</span>
          <el-select
            v-model="compareRunIds"
            multiple
            filterable
            placeholder="选择要对比的运行"
            style="width: 400px"
          >
            <el-option v-for="r in runList" :key="r.id" :label="`#{{r.id}} - {{ r.test_set_name }} ({{ r.model_name }})" :value="r.id" />
          </el-select>
          <el-button type="primary" :disabled="compareRunIds.length < 2" @click="doCompare">
            对比
          </el-button>
        </div>

        <div v-if="compareData" class="compare-chart">
          <div ref="compareChartRef" class="compare-chart-container"></div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, ref as vueRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh, Search, Cpu, Edit, Headset } from '@element-plus/icons-vue'
import { getTestRunList, getTestRunDetail } from '@/api/tests'
import * as echarts from 'echarts'

const route = useRoute()

const runSearch = ref('')
const runList = ref([])
const selectedRun = ref(null)
const runPagination = reactive({ page: 1, pageSize: 10, total: 0 })

const detailVisible = ref(false)
const currentResult = ref(null)

const compareVisible = ref(false)
const compareRunIds = ref([])
const compareData = ref(null)

const chartRef = vueRef(null)
const compareChartRef = vueRef(null)
let chartInstance = null
let compareChartInstance = null

const avgScore = computed(() => {
  if (!selectedRun.value?.results?.length) return 0
  const total = selectedRun.value.results.reduce((sum, r) => sum + (r.evaluation_score || 0), 0)
  return total / selectedRun.value.results.length
})

async function fetchRunList() {
  try {
    const res = await getTestRunList({
      page: runPagination.page,
      pageSize: runPagination.pageSize
    })
    runList.value = res.list
    runPagination.total = res.total
  } catch (e) {
    console.error(e)
  }
}

async function selectRun(run) {
  try {
    const detail = await getTestRunDetail(run.id)
    selectedRun.value = detail
    nextTick(() => {
      initChart()
    })
  } catch (e) {
    console.error(e)
  }
}

function initChart() {
  if (!chartRef.value || !selectedRun.value?.results) return
  
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const scores = selectedRun.value.results.map(r => (r.evaluation_score || 0))
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0]
        const result = selectedRun.value.results[data.dataIndex]
        return `
          <div>${result.test_case_name}<br/>评分: ${(data.value * 100).toFixed(0)}%</div>
        `
      }
    },
    xAxis: {
      type: 'category',
      data: selectedRun.value.results.map((_, i) => `用例${i + 1}`),
      axisLabel: {
        rotate: 45,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      max: 1,
      min: 0,
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: [
      {
        data: scores,
        type: 'bar',
        itemStyle: {
          color: (params) => {
            return params.value >= 0.6 ? '#67C23A' : '#F56C6C'
          }
        },
        markLine: {
          data: [
            { yAxis: 0.6, name: '及格线', lineStyle: { color: '#E6A23C' } }
          ]
        }
      }
    ],
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    }
  }

  chartInstance.setOption(option)
}

function viewResultDetail(row) {
  currentResult.value = row
  detailVisible.value = true
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

async function doCompare() {
  // 对比功能：简单实现，实际可以扩展
}

onMounted(() => {
  fetchRunList()
  
  if (route.query.runId) {
    setTimeout(() => {
      const run = runList.value.find(r => r.id == route.query.runId)
      if (run) selectRun(run)
    }, 500)
  }
})

watch(() => route.query.runId, (newVal) => {
  if (newVal && runList.value.length) {
    const run = runList.value.find(r => r.id == newVal)
    if (run) selectRun(run)
  }
})
</script>

<style scoped lang="scss">
.results-page {
  .run-list-panel {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    min-height: 600px;
  }

  .run-list {
    min-height: 480px;
  }

  .run-item {
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid #ebeef5;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      background: #f5f7fa;
    }

    &.active {
      border-color: #409eff;
      background: #ecf5ff;
    }

    .run-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .run-name {
        font-weight: 600;
        font-size: 14px;
        color: #303133;
      }
    }

    .run-meta {
      margin-bottom: 8px;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #606266;
        margin-bottom: 4px;
      }
    }

    .run-stats {
      margin-bottom: 6px;

      .stats-text {
        font-size: 12px;
        color: #909399;
        margin-left: 8px;
      }
    }

    .run-time {
      font-size: 11px;
      color: #c0c4cc;
    }
  }

  .pagination {
    justify-content: center;
    margin-top: 12px;
  }

  .detail-panel {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    min-height: 600px;

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid #ebeef5;
      margin-bottom: 20px;

      h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        color: #303133;
      }

      .run-subtitle {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;

        .time-text {
          font-size: 12px;
          color: #909399;
          margin-left: 8px;
        }
      }
    }
  }

  .stats-cards {
    margin-bottom: 24px;

    .stat-card {
      text-align: center;

      .stat-title {
        font-size: 13px;
        color: #909399;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
      }

      &.success .stat-value {
        color: #67C23A;
      }

      &.danger .stat-value {
        color: #F56C6C;
      }

      &.warning .stat-value {
        color: #E6A23C;
      }
    }
  }

  .chart-section {
    margin-bottom: 24px;

    .chart-container {
      height: 300px;
      width: 100%;
    }
  }

  .results-section {
    .score-text {
      font-size: 12px;
      color: #909399;
      margin-left: 6px;
    }
  }

  .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;
    background: #fff;
    border-radius: 8px;
  }

  .result-detail {
    .detail-item {
      margin-bottom: 12px;
      display: flex;
      align-items: flex-start;

      .label {
        color: #606266;
        min-width: 100px;
        flex-shrink: 0;
      }

      .value {
        color: #303133;
      }

      .script-text {
        background: #f5f7fa;
        padding: 10px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.6;
        flex: 1;
      }

      .score-big {
        font-size: 24px;
        font-weight: 600;
        color: #409eff;
      }
    }

    .model-output {
      flex: 1;
      background: #f5f7fa;
      padding: 12px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 300px;
      overflow-y: auto;
    }
  }
}
</style>
