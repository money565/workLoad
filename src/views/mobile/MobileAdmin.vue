<script setup lang="ts">
import { useUserStore } from '@/stores/counter'
import { useAppCacheStore } from '@/stores/appCache'
import { TeamOutlined, ToolOutlined, PlayCircleOutlined, UserOutlined } from '@ant-design/icons-vue'
import AdminEmployees from './admin/Employees.vue'
import AdminWorkPosition from './admin/WorkPosition.vue'
import AdminProjectRun from './admin/ProjectRun.vue'
import TreeNode from './admin/TreeNode.vue'
import AdminMine from './admin/Mine.vue'

const userStore = useUserStore()
const appCache = useAppCacheStore()
provide('pid', computed(() => appCache.currentProject))
const route = useRoute()
const activeTab = ref((route.query.tab as string) || 'employees')
const tabLabel = computed(() => ({ employees: '人员管理', work: '工作和岗位', run: '项目运行', mine: '我的' }[activeTab.value] || ''))
const projectPickerOpen = ref(false)
const expandedNodes = ref<Set<number>>(new Set())

function toggleExpand(id: number) {
  if (expandedNodes.value.has(id)) expandedNodes.value.delete(id)
  else expandedNodes.value.add(id)
}

function selectProject(node: { id: number; label: string }) {
  appCache.currentProject = node.id
  projectPickerOpen.value = false
}

onMounted(async () => {
  document.body.style.overflow = 'hidden'
  await appCache.fetchProjectList()
})
onUnmounted(() => { document.body.style.overflow = '' })
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden overscroll-none">
    <div class="flex-center px-4 py-1 bg-blue-500 text-white text-sm font-bold shrink-0" @click="userStore.userRank >= 3 ? projectPickerOpen = true : null">
      <span>{{ appCache.currentProjectName || '选择部门' }}</span>
      <span v-if="userStore.userRank >= 3" class="ml-1 text-xs">▼</span>
    </div>
    <div class="flex items-center gap-3 px-4 py-2 bg-white shadow-md shrink-0 relative z-10">
      <a-avatar :src="userStore.userInfo.avatar" :size="32" />
      <span class="text-sm font-bold">{{ userStore.userInfo.username }}</span>
      <span class="flex-1 text-center text-base text-gray-600 font-bold">{{ tabLabel }}</span>
      <a-tag color="blue">{{ userStore.userRank }}级管理员</a-tag>
    </div>
    <div class="flex-1 overflow-y-auto">
      <!-- 人员管理 -->
      <AdminEmployees v-if="activeTab === 'employees'" :pid="appCache.currentProject" />
      <AdminWorkPosition v-else-if="activeTab === 'work'" :pid="appCache.currentProject" />
      <AdminProjectRun v-else-if="activeTab === 'run'" :pid="appCache.currentProject" />
      <AdminMine v-else />
    </div>
    <!-- 底部 TabBar -->
    <div class="flex border-t bg-white shrink-0">
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'employees' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'employees'"
      >
        <TeamOutlined class="text-xl" />
        <span class="text-xs mt-1">人员管理</span>
      </div>
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'work' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'work'"
      >
        <ToolOutlined class="text-xl" />
        <span class="text-xs mt-1">工作和岗位</span>
      </div>
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'run' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'run'"
      >
        <PlayCircleOutlined class="text-xl" />
        <span class="text-xs mt-1">项目运行</span>
      </div>
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'mine' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'mine'"
      >
        <UserOutlined class="text-xl" />
        <span class="text-xs mt-1">我的</span>
      </div>
    </div>
  </div>

  <!-- 项目选择 -->
  <a-modal v-model:open="projectPickerOpen" title="选择项目" :footer="null" width="88%">
    <div class="max-h-70vh overflow-y-auto">
      <TreeNode v-for="node in appCache.projectList" :key="node.id" :node="node" :current-id="appCache.currentProject" :expanded-nodes="expandedNodes" @toggle="toggleExpand" @select="selectProject" />
    </div>
  </a-modal>
</template>

