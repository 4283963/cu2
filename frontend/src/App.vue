<template>
  <el-container class="app-container">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <el-icon :size="28" color="#409eff"><ChatDotRound /></el-icon>
        <span class="logo-text">Prompt 评测</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        class="side-menu"
      >
        <el-menu-item index="/prompt-editor">
          <el-icon><Edit /></el-icon>
          <span>模板编辑器</span>
        </el-menu-item>
        <el-menu-item index="/test-config">
          <el-icon><SetUp /></el-icon>
          <span>测试集配置</span>
        </el-menu-item>
        <el-menu-item index="/results">
          <el-icon><DataAnalysis /></el-icon>
          <span>结果对比看板</span>
        </el-menu-item>
        <el-menu-item index="/audio-library">
          <el-icon><Headset /></el-icon>
          <span>音频资产库</span>
        </el-menu-item>
        <el-menu-item index="/models">
          <el-icon><Cpu /></el-icon>
          <span>模型配置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentPageTitle }}</div>
        <div class="header-right">
          <el-tag type="info">本地评测</el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => {
  const titles = {
    '/prompt-editor': '模板编辑器',
    '/test-config': '测试集配置',
    '/results': '结果对比看板',
    '/audio-library': '音频资产库',
    '/models': '模型配置'
  }
  return titles[route.path] || 'Prompt 评测系统'
})
</script>

<style scoped lang="scss">
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-color: #2b3648;
  border-bottom: 1px solid #1f2d3d;

  .logo-text {
    color: #fff;
    font-size: 18px;
    font-weight: 600;
  }
}

.side-menu {
  flex: 1;
  border-right: none;

  :deep(.el-menu-item) {
    height: 50px;
    line-height: 50px;

    &.is-active {
      background-color: #263445 !important;
    }
  }
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
