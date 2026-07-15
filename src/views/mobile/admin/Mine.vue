<script setup lang="ts">
import dayjs from 'dayjs'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const selectedMonth = ref(dayjs())
const loading = ref(false)

interface InspectItem {
  group_key: string; work_name: string; work_cycle: number; exec_time: number
  feq: number; checked: boolean; check_time: string | null
}
const dataSource = ref<InspectItem[]>([])
const expandedSection = ref('')
function toggleSection(s: string) {
  expandedSection.value = expandedSection.value === s ? '' : s
}

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
function fmtExecTime(cycle: number, exec: number): string {
  if (cycle === 0) return exec === -1 ? '每天' : String(exec)
  if (cycle === 1) return WEEKDAY_MAP[exec] || String(exec)
  if (cycle === 2) return `${exec}日`
  return String(exec)
}

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const y = selectedMonth.value.year()
    const m = selectedMonth.value.month() + 1
    const res = await fetch(`/api/workLoad/monthInspect/${appCache.currentProject}/${y}/${m}`).then(r => r.json())
    if (res.code === 200) dataSource.value = res.result
  } catch { /* ignore */ }
  finally { loading.value = false }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
watch(selectedMonth, fetchData)
</script>

<template>
  <div class="p-3">
    <div class="bg-white rounded border mb-4">
      <div class="flex items-center justify-between p-3 cursor-pointer" @click="toggleSection('inspect')">
        <div class="flex items-center gap-2">
          <span class="text-gray-400 text-xs">{{ expandedSection === 'inspect' ? '▼' : '▶' }}</span>
          <span class="font-bold text-sm">本月巡检</span>
        </div>
        <a-date-picker v-model:value="selectedMonth" picker="month" format="YYYY年M月" size="small" class="w-36" @click.stop />
      </div>
      <div v-if="expandedSection === 'inspect'" class="border-t px-3 pb-3 max-h-64 overflow-y-auto">
        <a-spin :spinning="loading">
          <div v-if="dataSource.length === 0" class="flex-center py-6">
            <a-empty description="暂无数据" />
          </div>
          <div v-for="item in dataSource" :key="item.group_key" class="border-b border-gray-50 last:border-0 py-3">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="font-bold text-sm">{{ item.work_name }}</div>
                <div class="flex gap-2 mt-1 flex-wrap text-xs">
                  <a-tag :color="item.work_cycle === 0 ? 'blue' : item.work_cycle === 1 ? 'green' : 'orange'">{{ WORK_CYCLE_MAP[item.work_cycle] }}</a-tag>
                  <span>{{ fmtExecTime(item.work_cycle, item.exec_time) }}</span>
                  <span class="text-gray-400">频次 {{ item.feq }}</span>
                </div>
                <div class="text-xs text-gray-400 mt-1" v-if="item.check_time">
                  检查时间: {{ item.check_time?.slice(0, 16).replace('T', ' ') }}
                </div>
              </div>
              <a-tag :color="item.checked ? 'green' : 'red'" size="small">{{ item.checked ? '已检查' : '未检查' }}</a-tag>
            </div>
          </div>
        </a-spin>
      </div>
    </div>

    <div class="bg-white rounded border mb-4">
      <div class="flex items-center p-3 cursor-pointer" @click="toggleSection('data')">
        <span class="text-gray-400 text-xs mr-2">{{ expandedSection === 'data' ? '▼' : '▶' }}</span>
        <span class="font-bold text-sm">本月数据</span>
      </div>
      <div v-if="expandedSection === 'data'" class="border-t px-3 pb-3">
        <div class="flex-center py-6">
          <a-empty description="正在开发" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded border mb-4">
      <div class="flex items-center p-3 cursor-pointer" @click="toggleSection('todo')">
        <span class="text-gray-400 text-xs mr-2">{{ expandedSection === 'todo' ? '▼' : '▶' }}</span>
        <span class="font-bold text-sm">任务待办</span>
      </div>
      <div v-if="expandedSection === 'todo'" class="border-t px-3 pb-3">
        <div class="flex-center py-6">
          <a-empty description="正在开发" />
        </div>
      </div>
    </div>
  </div>
</template>
