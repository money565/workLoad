<script setup lang="ts">
import { useAppCacheStore } from '@/stores/appCache'
import type { WorkPlanItem } from '@/axios/interface'

const appCache = useAppCacheStore()
const loading = ref(false)

interface ArrangementRaw {
  id: number
  work_id: number
  work_name: string
  work_day: number
  work_month: number
  work_week: number
  release_time: string | null
  ordertaker_id: number | null
  ordertaker_name: string
  order_time: string | null
  status: number
}

interface ArrangementItem extends ArrangementRaw {
  price: number
  unit: string
  number: number
  start_time: string
  end_time: string
  work_cycle: number
  exec_time: number
}

const dataSource = ref<ArrangementItem[]>([])

const STATUS_MAP: Record<number, string> = { 0: '待接单', 1: '已接单', 2: '已完成' }
const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const columns = [
  { title: '工作名称', dataIndex: 'work_name', key: 'work_name', width: 130 },
  { title: '周期', key: 'work_cycle', width: 60 },
  { title: '期间', key: 'period', width: 140 },
  { title: '单价', dataIndex: 'price', key: 'price', width: 70 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 50 },
  { title: '数量', dataIndex: 'number', key: 'number', width: 50 },
  { title: '放出时间', dataIndex: 'release_time', key: 'release_time', width: 120 },
  { title: '接单人', key: 'ordertaker', width: 80 },
  { title: '接单时间', dataIndex: 'order_time', key: 'order_time', width: 120 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 80 },
]

async function handleDelete(id: number) {
  try { await fetch(`/api/workLoad/arrangement/${id}`, { method: 'DELETE' }); fetchData() }
  catch { console.warn('删除失败') }
}

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [arrRes, planRes] = await Promise.all([
      fetch(`/api/workLoad/arrangements/${appCache.currentProject}`).then(r => r.json()),
      fetch(`/api/workLoad/workPlans/${appCache.currentProject}`).then(r => r.json()),
    ])
    if (arrRes.code === 200 && planRes.code === 200) {
      const planMap: Record<number, WorkPlanItem> = {}
      for (const p of planRes.result) planMap[p.id] = p
      dataSource.value = arrRes.result.map((a: ArrangementRaw) => ({
        ...a,
        price: planMap[a.work_id]?.price || 0,
        unit: planMap[a.work_id]?.unit || '',
        number: planMap[a.work_id]?.number || 0,
        start_time: planMap[a.work_id]?.start_time || '',
        end_time: planMap[a.work_id]?.end_time || '',
        work_cycle: planMap[a.work_id]?.work_cycle || 0,
        exec_time: planMap[a.work_id]?.exec_time || 0,
      }))
    }
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

function getWeekRange(weekNum: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1)
  const firstMon = new Date(start)
  firstMon.setDate(start.getDate() + (8 - start.getDay()) % 7)
  if (start.getDay() === 1) firstMon.setDate(1)
  const monday = new Date(firstMon)
  monday.setDate(firstMon.getDate() + (weekNum - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(monday)}-${fmt(sunday)}`
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="工作市场" :sub-title="appCache.currentProjectName" @back="() => $router.back()" />
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table :columns="columns" :data-source="dataSource" :loading="loading" :pagination="{ pageSize: 20 }" :scroll="{ y: 'calc(100vh - 320px)' }" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 0 ? 'blue' : record.status === 1 ? 'orange' : 'green'">{{ STATUS_MAP[record.status] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'work_cycle'">{{ WORK_CYCLE_MAP[record.work_cycle] }}</template>
          <template v-else-if="column.key === 'release_time'">
            {{ record.release_time?.slice(0, 16).replace('T', ' ') || '—' }}
          </template>
          <template v-else-if="column.key === 'order_time'">
            {{ record.order_time?.slice(0, 16).replace('T', ' ') || '—' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm title="确定从市场删除？" @confirm="handleDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
          <template v-else-if="column.key === 'period'">
            <template v-if="record.work_cycle === 0">{{ record.work_day }}日</template>
            <template v-else-if="record.work_cycle === 1">第{{ record.work_week }}周 ({{ getWeekRange(record.work_week) }})</template>
            <template v-else-if="record.work_cycle === 2">{{ record.work_month }}月</template>
            <template v-else>—</template>
          </template>
          <template v-else-if="column.key === 'ordertaker'">
            {{ record.ordertaker_name || '—' }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
