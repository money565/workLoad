<script setup lang="ts">
import dayjs from 'dayjs'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const selectedMonth = ref(dayjs())
const loading = ref(false)

interface PieceItem {
  id: number
  name: string
  emp_type: string
  checked_count: number
  piece_salary: number
  duty_count: number
  grab_count: number
}
const dataSource = ref<PieceItem[]>([])

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '用工性质', dataIndex: 'emp_type', key: 'emp_type', width: 80 },
  { title: '合格工作数', dataIndex: 'checked_count', key: 'checked_count', width: 100 },
  { title: '计件薪资', dataIndex: 'piece_salary', key: 'piece_salary', width: 100 },
  { title: '职责工作数', dataIndex: 'duty_count', key: 'duty_count', width: 100 },
  { title: '抢单数', dataIndex: 'grab_count', key: 'grab_count', width: 80 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const y = selectedMonth.value.year()
    const m = selectedMonth.value.month() + 1
    const res = await fetch(`/api/workLoad/pieceAccount/${appCache.currentProject}/${y}/${m}`).then(
      (r) => r.json(),
    )
    if (res.code === 200) dataSource.value = res.result
  } catch {
    console.warn('获取失败')
  } finally {
    loading.value = false
  }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
watch(selectedMonth, fetchData)
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header
      class="shrink-0"
      title="计件核算"
      :sub-title="appCache.currentProjectName"
      @back="() => $router.back()"
    >
      <template #extra>
        <a-date-picker
          v-model:value="selectedMonth"
          picker="month"
          format="YYYY年M月"
          class="w-36"
        />
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :scroll="{ y: 'calc(100vh - 320px)' }"
        row-key="id"
        size="middle"
      />
    </a-card>
  </div>
</template>
