<script setup lang="ts">
import {
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  TeamOutlined,
  BulbOutlined,
  ToolOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  CrownOutlined,
} from '@ant-design/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { useUserStore } from '@/stores/counter'
import { useAppCacheStore } from '@/stores/appCache'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const { isDark, antdAlgorithm, toggle } = useTheme()
const userStore = useUserStore()
const appCache = useAppCacheStore()
const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

const breadcrumbItems = computed(() => {
  const items: { title: string; path: string }[] = []
  const seg = route.path.split('/').pop()
  if (seg && seg !== 'pc') {
    const parentMap: Record<string, string> = {
      employees: '人员管理',
      departments: '人员管理',
      'work-manage': '工作和岗位',
      'work-standard': '工作和岗位',
      'position-manage': '工作和岗位',
      'staff-dispatch': '工作和岗位',
      'today-task': '项目运行',
      'month-plan': '项目运行',
      'month-inspect': '项目运行',
      'piece-account': '项目运行',
      'work-market': '项目运行',
    }
    if (parentMap[seg]) {
      items.push({ title: parentMap[seg], path: '' })
    }
    const map: Record<string, string> = {
      employees: '员工列表',
      departments: '员工详情',
      'work-manage': '工作管理',
      'work-standard': '工作标准',
      'position-manage': '岗位管理',
      'staff-dispatch': '人员调配',
      'today-task': '今日任务',
      'month-plan': '本月计划',
      'month-inspect': '本月巡检',
      'piece-account': '计件核算',
      'work-market': '工作市场',
      profile: '个人中心',
      todo: '待办事项',
      settings: '设置',
      'debug-data': '数据查看',
      'user-manage': '用户管理',
    }
    items.push({ title: map[seg] || seg, path: route.path })
  }
  return items
})

const menuItems = [
  { key: 'home', icon: () => h(HomeOutlined), label: '首页' },
  {
    key: 'manage', icon: () => h(TeamOutlined), label: '人员管理',
    children: [
      { key: 'employees', label: '员工列表' },
      { key: 'departments', label: '员工详情' },
    ],
  },
  {
    key: 'work-position', icon: () => h(ToolOutlined), label: '工作和岗位',
    children: [
      { key: 'work-manage', label: '工作管理' },
      { key: 'work-standard', label: '工作标准' },
      { key: 'position-manage', label: '岗位管理' },
      { key: 'staff-dispatch', label: '人员调配' },
    ],
  },
  {
    key: 'project-run', icon: () => h(PlayCircleOutlined), label: '项目运行',
    children: [
      { key: 'today-task', label: '今日任务' },
      { key: 'week-plan', label: '本周计划' },
      { key: 'month-plan', label: '本月计划' },
      { key: 'month-inspect', label: '本月巡检' },
      { key: 'piece-account', label: '计件核算' },
      { key: 'work-market', label: '工作市场' },
    ],
  },
  { key: 'user-manage', icon: () => h(CrownOutlined), label: '用户管理' },
  { key: 'debug-data', icon: () => h(SettingOutlined), label: '数据查看' },
  { key: 'settings', icon: () => h(SettingOutlined), label: '设置' },
  { key: 'todo', icon: () => h(BellOutlined), label: '待办事项' },
]

onMounted(() => {
  appCache.fetchProjectList()
})

function handleUserMenuClick({ key }: { key: string | number }) {
  if (key === 'profile') {
    router.push('/pc/profile')
  } else if (key === 'logout') {
    userStore.logout()
  }
}

function handleSideMenuClick({ key }: { key: string | number }) {
  const k = String(key)
  if (k === 'home') {
    router.push('/pc')
  } else {
    router.push(`/pc/${k}`)
  }
}
</script>

<template>
  <a-config-provider :theme="{ algorithm: antdAlgorithm }" :locale="zhCN">
    <a-layout class="fixed inset-0 overflow-hidden">
      <!-- 侧边栏 -->
      <a-layout-sider
        v-model:collapsed="collapsed"
        :width="220"
        :theme="isDark ? 'dark' : 'light'"
        collapsible
      >
        <div class="flex items-center h-16 px-4 gap-2 overflow-hidden">
          <img src="/favicon.ico" class="h-8 w-8 shrink-0" />
          <span v-show="!collapsed" class="text-lg font-bold whitespace-nowrap truncate">
            细川量化工作
          </span>
        </div>
        <a-menu
          mode="inline"
          :theme="isDark ? 'dark' : 'light'"
          :selected-keys="[route.path === '/pc' ? 'home' : route.path.split('/').pop() || '']"
          :items="menuItems"
          @click="handleSideMenuClick"
        />
      </a-layout-sider>

      <!-- 主区域 -->
      <a-layout class="flex flex-col overflow-hidden">
        <!-- 顶部栏 -->
        <a-layout-header
          class="px-6 flex items-center justify-between shadow-sm h-14 leading-[56px]"
          :style="{ background: isDark ? '#141414' : '#fff' }"
        >
          <!-- 左侧 -->
          <div class="flex items-center gap-3">
            <component
              :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
              class="text-lg cursor-pointer"
              @click="collapsed = !collapsed"
            />
            <!-- 部门选择 -->
            <a-tree-select
              v-model:value="appCache.currentProject"
              size="middle"
              class="w-64"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '260px' }"
              tree-node-filter-prop="label"
              :tree-data="appCache.projectList"
              :field-names="{ value: 'id', label: 'label', children: 'children' }"
              placeholder="选择部门"
            />
          </div>

          <!-- 右侧 -->
          <div class="flex items-center gap-4">
            <!-- 主题切换 -->
            <a-tooltip :title="isDark ? '切换亮色模式' : '切换暗色模式'">
              <a-button
                shape="circle"
                size="small"
                @click="toggle"
                :type="isDark ? 'primary' : 'default'"
              >
                <template #icon>
                  <BulbOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <!-- 待办 -->
            <a-badge :count="5" :overflow-count="99">
              <a-button shape="circle" size="small">
                <template #icon><BellOutlined /></template>
              </a-button>
            </a-badge>

            <!-- 用户 -->
            <a-dropdown>
              <div class="flex items-center gap-2 cursor-pointer">
                <a-avatar :size="32" :src="userStore.userInfo.avatar">
                  <template #icon><UserOutlined /></template>
                </a-avatar>
                <span class="text-sm">{{ userStore.userInfo.username || '管理员' }}</span>
              </div>
              <template #overlay>
                <a-menu @click="handleUserMenuClick">
                  <a-menu-item key="profile">个人中心</a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="logout">退出登录</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </a-layout-header>

        <!-- 内容区 -->
        <div
          class="px-6 pt-2 pb-0 shrink-0"
          :style="{ background: isDark ? '#141414' : '#f0f2f5' }"
        >
          <a-breadcrumb>
            <a-breadcrumb-item v-for="item in breadcrumbItems" :key="item.path">{{
              item.title
            }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <a-layout-content class="mx-6 mb-6 overflow-hidden flex-1">
          <router-view />
        </a-layout-content>
      </a-layout>
    </a-layout>
  </a-config-provider>
</template>
