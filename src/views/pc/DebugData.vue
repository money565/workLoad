<script setup lang="ts">
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const table = ref('workplan')
const loading = ref(false)
const data = ref<any[]>([])
const count = ref(0)

const tables = [
  { label: '工作计划', value: 'workplan' },
  { label: '岗位', value: 'position' },
  { label: '人员调配', value: 'staffdispatch' },
  { label: '工作执行', value: 'execution' },
  { label: '工作标准', value: 'standard' },
]

async function fetchTable() {
  loading.value = true
  try {
    const res = await fetch(`/api/workLoad/debug/${appCache.currentProject}/${table.value}`).then(r => r.json())
    if (res.code === 200) { data.value = res.result; count.value = res.count }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await fetch(`/api/workLoad/debug/${appCache.currentProject}/${table.value}/${row.id}`, { method: 'DELETE' })
    fetchTable()
  } catch { /* ignore */ }
}

watch([table, () => appCache.currentProject], fetchTable, { immediate: true })

// Auto-generate columns from first row + action column
const columns = computed(() => {
  if (data.value.length === 0) return []
  return [
    ...Object.keys(data.value[0]!).map(k => ({ title: k, dataIndex: k, key: k, width: 120 })),
    { title: '操作', key: 'action', width: 80 },
  ]
})
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="数据查看" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <a-select v-model:value="table" class="w-40" @change="fetchTable">
          <a-select-option v-for="t in tables" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
        </a-select>
        <span class="ml-3 text-gray-500">共 {{ count }} 条</span>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :columns="columns" :data-source="data" :loading="loading"
        :pagination="{ pageSize: 50 }" :scroll="{ x: 1000, y: 'calc(100vh - 320px)' }"
        row-key="id" size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-popconfirm title="确定删除？" @confirm="handleDelete(record)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
