<script setup lang="ts">
import dayjs from 'dayjs'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const selectedMonth = ref(dayjs())
const loading = ref(false)

interface InspectItem {
  group_key: string
  work_name: string
  work_cycle: number
  exec_time: number
  feq: number
  checked: boolean
  check_time: string | null
}
const dataSource = ref<InspectItem[]>([])

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }

function fmtExecTime(cycle: number, exec: number): string {
  if (cycle === 0) return exec === -1 ? '每天' : String(exec)
  if (cycle === 1) return WEEKDAY_MAP[exec] || String(exec)
  if (cycle === 2) return `${exec}日`
  return String(exec)
}

const columns = [
  { title: '工作名称', dataIndex: 'work_name', key: 'work_name', width: 150 },
  { title: '周期', dataIndex: 'work_cycle', key: 'work_cycle', width: 60 },
  { title: '执行时间', key: 'exec_time', width: 80 },
  { title: '频次', dataIndex: 'feq', key: 'feq', width: 50 },
  { title: '检查状态', key: 'checked', width: 80 },
  { title: '检查时间', dataIndex: 'check_time', key: 'check_time', width: 160 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const y = selectedMonth.value.year()
    const m = selectedMonth.value.month() + 1
    const res = await fetch(`/api/workLoad/monthInspect/${appCache.currentProject}/${y}/${m}`).then(r => r.json())
    if (res.code === 200) dataSource.value = res.result
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
watch(selectedMonth, fetchData)
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="本月巡检" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <a-date-picker v-model:value="selectedMonth" picker="month" format="YYYY年M月" class="w-36" />
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :scroll="{ y: 'calc(100vh - 320px)' }"
        row-key="group_key"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'work_cycle'">
            <a-tag :color="record.work_cycle === 0 ? 'blue' : record.work_cycle === 1 ? 'green' : ''">
              {{ WORK_CYCLE_MAP[record.work_cycle] }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'exec_time'">
            {{ fmtExecTime(record.work_cycle, record.exec_time) }}
          </template>
          <template v-else-if="column.key === 'checked'">
            <a-tag :color="record.checked ? 'green' : 'red'">
              {{ record.checked ? '已检查' : '未检查' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'check_time'">
            {{ record.check_time?.slice(0, 16).replace('T', ' ') || '—' }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
