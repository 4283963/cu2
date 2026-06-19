import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/prompt-editor'
  },
  {
    path: '/prompt-editor',
    name: 'PromptEditor',
    component: () => import('@/views/PromptEditor.vue'),
    meta: { title: '模板编辑器' }
  },
  {
    path: '/test-config',
    name: 'TestConfig',
    component: () => import('@/views/TestConfig.vue'),
    meta: { title: '测试集配置' }
  },
  {
    path: '/results',
    name: 'Results',
    component: () => import('@/views/Results.vue'),
    meta: { title: '结果对比看板' }
  },
  {
    path: '/audio-library',
    name: 'AudioLibrary',
    component: () => import('@/views/AudioLibrary.vue'),
    meta: { title: '音频资产库' }
  },
  {
    path: '/models',
    name: 'Models',
    component: () => import('@/views/Models.vue'),
    meta: { title: '模型配置' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
