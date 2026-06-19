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
              :class="{ 
                active: selectedRun?.id === run.id,
                'run-high-score': getRunAvgScore(run) >= 0.8,
                'run-good-score': getRunAvgScore(run) >= 0.6 && getRunAvgScore(run) < 0.8,
                'run-low-score': getRunAvgScore(run) < 0.6 && run.status === 'completed'
              }"
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
                <div class="score-row">
                  <el-progress
                    :percentage="Math.round((run.passed_cases / run.total_cases) * 100)"
                    :stroke-width="6"
                    :show-text="false"
                    :color="getRunAvgScore(run) >= 0.6 ? '#67C23A' : '#F56C6C'"
                  />
                  <span class="stats-text">{{ run.passed_cases }}/{{ run.total_cases }} 通过</span>
                  <el-tag size="small" :type="getScoreLevelType(getRunAvgScore(run))" class="avg-score-tag">
                    平均分 {{ (getRunAvgScore(run)).toFixed(2) }}
                  </el-tag>
                </div>
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
            
            <el-table 
              :data="selectedRun.results" 
              border 
              stripe
              :row-class-name="getRowClassName"
            >
              <el-table-column type="index" label="#" width="60" />
              <el-table-column prop="test_case_name" label="用例名称" width="150" />
              <el-table-column label="脚本内容" show-overflow-tooltip>
                <template #default="{ row }">{{ row.script_text }}</template>
              </el-table-column>
              <el-table-column label="评估规则" width="220">
                <template #default="{ row }">
                  <div>
                    <div>
                      <el-tag size="small" type="warning">{{ row.expected_emotion || '-' }}</el-tag>
                      <el-tag size="small" type="success" style="margin-left: 4px;">{{ row.expected_style || '-' }}</el-tag>
                    </div>
                    <div class="rule-tags" v-if="(row.expected_keywords?.length || 0) + (row.expected_phrases?.length || 0) > 0">
                      <el-tag
                        v-for="kw in (row.expected_keywords || []).slice(0, 3)"
                        :key="'kw-' + kw"
                        size="small"
                        type="primary"
                        effect="plain"
                        class="mini-tag"
                      >{{ kw }}</el-tag>
                      <el-tag
                        v-for="ph in (row.expected_phrases || []).slice(0, 2)"
                        :key="'ph-' + ph"
                        size="small"
                        type="info"
                        effect="plain"
                        class="mini-tag"
                      >"{{ ph }}"</el-tag>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="评分分解" width="200">
                <template #default="{ row }">
                  <div class="score-breakdown">
                    <div class="breakdown-item">
                      <span class="bd-label">情感</span>
                      <el-progress
                        :percentage="Math.round((row.emotion_score || 0) * 100)"
                        :stroke-width="3"
                        :show-text="false"
                        :status="row.emotion_score >= 0.6 ? 'success' : 'exception'"
                        style="flex: 1; margin: 0 6px;"
                      />
                      <span class="bd-value">{{ (row.emotion_score || 0).toFixed(2) }}</span>
                    </div>
                    <div class="breakdown-item">
                      <span class="bd-label">风格</span>
                      <el-progress
                        :percentage="Math.round((row.style_score || 0) * 100)"
                        :stroke-width="3"
                        :show-text="false"
                        :status="row.style_score >= 0.6 ? 'success' : 'exception'"
                        style="flex: 1; margin: 0 6px;"
                      />
                      <span class="bd-value">{{ (row.style_score || 0).toFixed(2) }}</span>
                    </div>
                    <div class="breakdown-item" v-if="(row.expected_keywords?.length || 0) + (row.expected_phrases?.length || 0) > 0">
                      <span class="bd-label">关键词</span>
                      <el-progress
                        :percentage="Math.round((row.keyword_score || 0) * 100)"
                        :stroke-width="3"
                        :show-text="false"
                        :status="row.keyword_score >= 0.6 ? 'success' : 'exception'"
                        style="flex: 1; margin: 0 6px;"
                      />
                      <span class="bd-value">{{ (row.keyword_score || 0).toFixed(2) }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="evaluation_score" label="综合评分" width="120">
                <template #default="{ row }">
                  <div :class="['final-score-cell', getScoreLevelClass(row.evaluation_score)]">
                    <el-progress
                      :percentage="Math.round((row.evaluation_score || 0) * 100)"
                      :stroke-width="4"
                      :show-text="false"
                      :color="getScoreColor(row.evaluation_score)"
                    />
                    <span class="final-score-text" :style="{ color: getScoreColor(row.evaluation_score) }">
                      {{ (row.evaluation_score || 0).toFixed(2) }}
                    </span>
                  </div>
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

    <el-dialog v-model="detailVisible" title="结果详情" width="800px">
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
          <span class="label">评估规则：</span>
          <div class="value">
            <div class="rule-detail-row">
              <el-tag size="small" type="warning">{{ currentResult.expected_emotion || '-' }}</el-tag>
              <el-tag size="small" type="success" style="margin-left: 8px;">{{ currentResult.expected_style || '-' }}</el-tag>
            </div>
            <div v-if="(currentResult.expected_keywords?.length || 0) + (currentResult.expected_phrases?.length || 0) > 0" class="rule-detail-row mt-8">
              <div v-if="currentResult.expected_keywords?.length" class="rule-group">
                <div class="rule-group-label">期望关键词：</div>
                <el-tag
                  v-for="kw in currentResult.expected_keywords"
                  :key="'ekw-' + kw"
                  size="small"
                  :type="currentResult.keyword_match_details?.matchedKeywords?.includes(kw) ? 'success' : 'danger'"
                  effect="plain"
                  class="mr-4 mb-4"
                >{{ kw }}</el-tag>
              </div>
              <div v-if="currentResult.expected_phrases?.length" class="rule-group">
                <div class="rule-group-label">期望短语：</div>
                <el-tag
                  v-for="ph in currentResult.expected_phrases"
                  :key="'eph-' + ph"
                  size="small"
                  :type="currentResult.keyword_match_details?.matchedPhrases?.includes(ph) ? 'success' : 'danger'"
                  effect="plain"
                  class="mr-4 mb-4"
                >"{{ ph }}"</el-tag>
              </div>
            </div>
          </div>
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
        <el-divider />
        <div class="detail-item score-detail-section">
          <span class="label">评分详情：</span>
          <div class="value score-breakdown-large">
            <div class="bd-large-item">
              <span class="bd-large-label">情感得分</span>
              <el-progress
                :percentage="Math.round((currentResult.emotion_score || 0) * 100)"
                :stroke-width="8"
                :show-text="false"
                :color="getScoreColor(currentResult.emotion_score)"
                style="flex: 1; margin: 0 12px;"
              />
              <span class="bd-large-value" :style="{ color: getScoreColor(currentResult.emotion_score) }">
                {{ (currentResult.emotion_score || 0).toFixed(2) }}
              </span>
            </div>
            <div class="bd-large-item">
              <span class="bd-large-label">风格得分</span>
              <el-progress
                :percentage="Math.round((currentResult.style_score || 0) * 100)"
                :stroke-width="8"
                :show-text="false"
                :color="getScoreColor(currentResult.style_score)"
                style="flex: 1; margin: 0 12px;"
              />
              <span class="bd-large-value" :style="{ color: getScoreColor(currentResult.style_score) }">
                {{ (currentResult.style_score || 0).toFixed(2) }}
              </span>
            </div>
            <div v-if="(currentResult.expected_keywords?.length || 0) + (currentResult.expected_phrases?.length || 0) > 0" class="bd-large-item">
              <span class="bd-large-label">关键词得分</span>
              <el-progress
                :percentage="Math.round((currentResult.keyword_score || 0) * 100)"
                :stroke-width="8"
                :show-text="false"
                :color="getScoreColor(currentResult.keyword_score)"
                style="flex: 1; margin: 0 12px;"
              />
              <span class="bd-large-value" :style="{ color: getScoreColor(currentResult.keyword_score) }">
                {{ (currentResult.keyword_score || 0).toFixed(2) }}
              </span>
            </div>
            <div class="bd-large-item final-item">
              <span class="bd-large-label">综合评分</span>
              <el-progress
                :percentage="Math.round((currentResult.evaluation_score || 0) * 100)"
                :stroke-width="10"
                :show-text="false"
                :color="getScoreColor(currentResult.evaluation_score)"
                style="flex: 1; margin: 0 12px;"
              />
              <span class="bd-large-value final-score" :style="{ color: getScoreColor(currentResult.evaluation_score) }">
                {{ (currentResult.evaluation_score || 0).toFixed(2) }}
              </span>
            </div>
          </div>
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

function getRunAvgScore(run) {
  if (!run.results?.length && run.passed_cases != null) {
    return run.total_cases > 0 ? run.passed_cases / run.total_cases : 0
  }
  if (!run.results?.length) return 0
  const total = run.results.reduce((sum, r) => sum + (r.evaluation_score || 0), 0)
  return total / run.results.length
}

function getScoreLevelType(score) {
  if (score >= 0.8) return 'success'
  if (score >= 0.6) return 'warning'
  return 'danger'
}

function getScoreLevelClass(score) {
  if (score >= 0.8) return 'score-high'
  if (score >= 0.6) return 'score-good'
  return 'score-low'
}

function getScoreColor(score) {
  if (score >= 0.8) return '#67C23A'
  if (score >= 0.6) return '#E6A23C'
  return '#F56C6C'
}

function getRowClassName({ row }) {
  if (row.evaluation_score >= 0.8) return 'row-high-score'
  if (row.evaluation_score >= 0.6) return 'row-good-score'
  if (row.evaluation_score != null) return 'row-low-score'
  return ''
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
  :deep(.row-high-score td) {
    background-color: rgba(103, 194, 58, 0.1) !important;
  }
  :deep(.row-good-score td) {
    background-color: rgba(230, 162, 60, 0.08) !important;
  }
  :deep(.row-low-score td) {
    background-color: rgba(245, 108, 108, 0.1) !important;
  }

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

    &.run-high-score {
      border-left: 4px solid #67C23A;
    }
    &.run-good-score {
      border-left: 4px solid #E6A23C;
    }
    &.run-low-score {
      border-left: 4px solid #F56C6C;
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

      .score-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .stats-text {
        font-size: 12px;
        color: #909399;
        margin-left: 8px;
      }

      .avg-score-tag {
        margin-left: auto;
        font-weight: 600;
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

    .rule-tags {
      margin-top: 4px;
    }

    .mini-tag {
      margin-right: 3px;
      margin-bottom: 2px;
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .score-breakdown {
      .breakdown-item {
        display: flex;
        align-items: center;
        margin-bottom: 4px;

        .bd-label {
          font-size: 11px;
          color: #909399;
          width: 40px;
          flex-shrink: 0;
        }

        .bd-value {
          font-size: 11px;
          font-weight: 600;
          color: #303133;
          width: 36px;
          text-align: right;
        }
      }

      .breakdown-item:last-child {
        margin-bottom: 0;
      }
    }

    .final-score-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;

      &.score-high {
        background: rgba(103, 194, 58, 0.1);
      }
      &.score-good {
        background: rgba(230, 162, 60, 0.08);
      }
      &.score-low {
        background: rgba(245, 108, 108, 0.1);
      }

      .final-score-text {
        font-weight: 600;
        font-size: 14px;
      }
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
        flex: 1;
      }

      .script-text {
        background: #f5f7fa;
        padding: 10px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.6;
      }

      .score-big {
        font-size: 24px;
        font-weight: 600;
        color: #409eff;
      }

      .rule-detail-row {
        margin-bottom: 4px;
      }

      .rule-group {
        margin-top: 6px;

        .rule-group-label {
          font-size: 12px;
          color: #909399;
          margin-bottom: 4px;
        }
      }

      .mr-4 {
        margin-right: 6px;
      }
      .mb-4 {
        margin-bottom: 4px;
      }
      .mt-8 {
        margin-top: 8px;
      }

      .score-detail-section {
        .score-breakdown-large {
          width: 100%;
        }

        .bd-large-item {
          display: flex;
          align-items: center;
          margin-bottom: 10px;

          .bd-large-label {
            font-size: 13px;
            color: #606266;
            width: 80px;
            flex-shrink: 0;
          }

          .bd-large-value {
            font-size: 14px;
            font-weight: 600;
            width: 50px;
            text-align: right;
          }

          &.final-item {
            padding-top: 8px;
            border-top: 1px dashed #ebeef5;

            .bd-large-label {
              font-weight: 600;
              color: #303133;
            }

            .final-score {
              font-size: 18px;
            }
          }
        }
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
