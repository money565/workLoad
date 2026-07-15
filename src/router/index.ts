import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    // PC 端路由
    {
      path: '/pc',
      component: () => import('@/layouts/PcLayout.vue'),
      children: [
        {
          path: '',
          name: 'pc-home',
          component: () => import('@/views/pc/Home.vue'),
        },
        {
          path: 'employees',
          name: 'pc-employees',
          component: () => import('@/views/pc/Employees.vue'),
        },
        {
          path: 'work-standard',
          name: 'pc-work-standard',
          component: () => import('@/views/pc/WorkStandard.vue'),
        },
        {
          path: 'work-manage',
          name: 'pc-work-manage',
          component: () => import('@/views/pc/WorkManage.vue'),
        },
        {
          path: 'position-manage',
          name: 'pc-position-manage',
          component: () => import('@/views/pc/PositionManage.vue'),
        },
        {
          path: 'staff-dispatch',
          name: 'pc-staff-dispatch',
          component: () => import('@/views/pc/StaffDispatch.vue'),
        },
        {
          path: 'departments',
          name: 'pc-departments',
          component: () => import('@/views/pc/Departments.vue'),
        },
        {
          path: 'today-task',
          name: 'pc-today-task',
          component: () => import('@/views/pc/TodayTask.vue'),
        },
        {
          path: 'week-plan',
          name: 'pc-week-plan',
          component: () => import('@/views/pc/WeekPlan.vue'),
        },
        {
          path: 'month-plan',
          name: 'pc-month-plan',
          component: () => import('@/views/pc/MonthPlan.vue'),
        },
        {
          path: 'month-inspect',
          name: 'pc-month-inspect',
          component: () => import('@/views/pc/MonthInspect.vue'),
        },
        {
          path: 'piece-account',
          name: 'pc-piece-account',
          component: () => import('@/views/pc/PieceAccount.vue'),
        },
        {
          path: 'work-market',
          name: 'pc-work-market',
          component: () => import('@/views/pc/WorkMarket.vue'),
        },
        ...(import.meta.env.DEV ? [{
          path: 'debug-data',
          name: 'pc-debug-data',
          component: () => import('@/views/pc/DebugData.vue'),
        }] : []),
        {
          path: 'user-manage',
          name: 'pc-user-manage',
          component: () => import('@/views/pc/UserManage.vue'),
        },
        {
          path: 'todo',
          name: 'pc-todo',
          component: () => import('@/views/pc/Todo.vue'),
        },
        {
          path: 'settings',
          name: 'pc-settings',
          component: () => import('@/views/pc/Settings.vue'),
        },
        {
          path: 'profile',
          name: 'pc-profile',
          component: () => import('@/views/pc/Profile.vue'),
        },
      ],
    },
    // 移动端路由
    {
      path: '/mobile',
      component: () => import('@/layouts/MobileLayout.vue'),
      children: [
        {
          path: '',
          name: 'mobile-home',
          component: () => import('@/views/mobile/MobileHome.vue'),
        },
        {
          path: 'scan-work',
          name: 'mobile-scan-work',
          component: () => import('@/views/mobile/ScanWork.vue'),
        },
        {
          path: 'employee',
          name: 'mobile-employee',
          component: () => import('@/views/mobile/MobileEmployee.vue'),
        },
        {
          path: 'work-market',
          name: 'mobile-work-market',
          component: () => import('@/views/mobile/MobileWorkMarket.vue'),
        },
        {
          path: 'admin',
          name: 'mobile-admin',
          component: () => import('@/views/mobile/MobileAdmin.vue'),
        },
      ],
    },
      // 手机首页（独立路由，无布局）
    {
      path: '/mobileHome',
      name: 'mobileHome',
      component: () => import('@/views/mobile/MobileHome.vue'),
    },
    // 默认跳转
    {
      path: '/',
      redirect: '/pc',
    },
  ],
})

export default router
