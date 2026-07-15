<script setup lang="ts">
import { useAppCacheStore } from '@/stores/appCache'
import { LeftOutlined } from '@ant-design/icons-vue'

const appCache = useAppCacheStore()
interface MarketItem {
  id: number; work_id: number; work_name: string
  work_day: number; work_month: number; work_week: number
  ordertaker_id: number | null; status: number
}
interface PlanBrief { work_cycle: number; price: number; unit: string; number: number; start_time: string | null; end_time: string | null }

const loading = ref(false)
const items = ref<MarketItem[]>([])
const planMap = ref<Record<number, PlanBrief>>({})

async function fetchData() {
  const pid = appCache.currentProject
  if (pid === -1) return
  loading.value = true
  try {
    const [arrRes, planRes] = await Promise.all([
      fetch(`/api/workLoad/arrangements/${pid}`).then((r) => r.json()),
      fetch(`/api/workLoad/workPlans/${pid}`).then((r) => r.json()),
    ])
    if (planRes.code === 200) {
      for (const p of planRes.result) planMap.value[p.id] = p
    }
    if (arrRes.code === 200) {
      items.value = arrRes.result.filter((a: MarketItem) => a.status === 0 && !a.ordertaker_id)
    }
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}
fetchData()
watch(() => appCache.currentProject, fetchData)

function getWeekRange(weekNum: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1)
  const firstMon = new Date(start)
  firstMon.setDate(
    start.getDate() + ((8 - start.getDay()) % 7) ||
      (start.getDay() === 1 ? 0 : 7 - start.getDay() + 1),
  )
  const monday = new Date(firstMon)
  monday.setDate(firstMon.getDate() + (weekNum - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}-${String(sunday.getMonth() + 1).padStart(2, '0')}/${String(sunday.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <div class="flex items-center px-4 py-3 bg-white border-b">
      <a-button shape="circle" size="small" @click="$router.replace('/mobile/admin?tab=run')"
        ><template #icon><LeftOutlined /></template
      ></a-button>
      <span class="font-bold flex-1 text-center">工作市场</span>
      <span class="w-12" />
    </div>
    <div class="p-3">
      <a-spin :spinning="loading">
        <div v-if="items.length === 0" class="flex-center py-16">
          <a-empty description="暂无待接单工作" />
        </div>
        <a-card v-for="item in items" :key="item.id" class="mb-3" size="small">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-bold text-sm">{{ item.work_name }}</div>
              <div class="mt-1 flex gap-2 flex-wrap text-xs">
                <a-tag v-if="planMap[item.work_id]?.work_cycle === 0" color="blue"
                  >{{ item.work_day }}日</a-tag
                >
                <a-tag v-else-if="planMap[item.work_id]?.work_cycle === 1" color="green"
                  >第{{ item.work_week }}周 ({{ getWeekRange(item.work_week) }})</a-tag
                >
                <a-tag v-else color="orange">{{ item.work_month }}月{{ item.work_day }}日</a-tag>
                <span
                  >¥{{ planMap[item.work_id]?.price || '—' }} /
                  {{ planMap[item.work_id]?.unit || '—' }}×{{
                    planMap[item.work_id]?.number || '—'
                  }}</span
                >
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ planMap[item.work_id]?.start_time?.slice(0, 5) || '—' }}~{{
                  planMap[item.work_id]?.end_time?.slice(0, 5) || '—'
                }}
              </div>
            </div>
            <a-tag color="blue" size="small">待接单</a-tag>
          </div>
        </a-card>
      </a-spin>
    </div>
  </div>
</template>
