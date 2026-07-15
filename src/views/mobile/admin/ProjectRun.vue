<script setup lang="ts">
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { ShoppingCartOutlined } from '@ant-design/icons-vue'
import { getWorkPlans, type WorkPlanItem, type EmpFullInfo } from '@/axios/interface'
// import { useUserStore } from '@/stores/counter'

interface ExecBrief {
  work_plan_id: number
  uploader_name: string
  upload_time: string | null
  check_result: number
  checker_name: string
  id: number
}

const props = defineProps<{ pid: number }>()
// const userStore = useUserStore()
const router = useRouter()
const runTab = ref<'today' | 'week' | 'month'>('today')
const loading = ref(false)
const works = ref<WorkPlanItem[]>([])
const executionMap = ref<Record<number, ExecBrief>>({})
const executorMap = ref<Record<number, string[]>>({})

// 日期选择
const selectedDate = ref(dayjs())
const weekStart = ref(dayjs().day(1))
const selectedMonth = ref(dayjs())

function getWeekRangeStr(d: dayjs.Dayjs): string {
  const day = d.day()
  const monday = d.subtract(day === 0 ? 6 : day - 1, 'day')
  const sunday = monday.add(6, 'day')
  return `${monday.format('MM/DD')}-${sunday.format('MM/DD')}`
}

function calcWorkWeek(d: dayjs.Dayjs): number {
  const start = dayjs(`${d.year()}-01-01`)
  let firstMon = start.day() === 1 ? start : start.add(8 - start.day(), 'day')
  if (d.isBefore(firstMon)) {
    firstMon = dayjs(`${d.year() - 1}-01-01`)
    firstMon = firstMon.day() === 1 ? firstMon : firstMon.add(8 - firstMon.day(), 'day')
  }
  return Math.max(1, Math.ceil(d.diff(firstMon, 'day') / 7) + 1)
}

async function fetchData() {
  const pid = props.pid
  if (!pid) return
  loading.value = true
  try {
    const [planRes, execRes, arrRes, dispatchRes, posRes] = await Promise.all([
      getWorkPlans(pid),
      fetch(`/api/workLoad/executions/${pid}`).then((r) => r.json()),
      fetch(`/api/workLoad/arrangements/${pid}`).then((r) => r.json()),
      fetch(`/api/workLoad/staffDispatch/${pid}`).then((r) => r.json()),
      fetch(`/api/workLoad/positions/${pid}`).then((r) => r.json()),
    ])

    // 市场过滤
    const marketIds = new Set<number>()
    if (arrRes.code === 200) {
      if (runTab.value === 'today') {
        const today = selectedDate.value.date()
        for (const a of arrRes.result) {
          if (a.work_day === today) marketIds.add(a.work_id)
        }
      } else if (runTab.value === 'week') {
        const wk = calcWorkWeek(weekStart.value)
        for (const a of arrRes.result) {
          if (a.work_week === wk) marketIds.add(a.work_id)
        }
      } else {
        const m = selectedMonth.value.month() + 1
        for (const a of arrRes.result) {
          if (a.work_month === m) marketIds.add(a.work_id)
        }
      }
    }

    // 筛选本周期工作
    if (planRes.code === 200) {
      if (runTab.value === 'today') {
        works.value = planRes.result.filter(
          (w: WorkPlanItem) => w.work_cycle === 0 && !marketIds.has(w.id),
        )
      } else if (runTab.value === 'week') {
        works.value = planRes.result.filter(
          (w: WorkPlanItem) => w.work_cycle === 1 && !marketIds.has(w.id),
        )
      } else {
        works.value = planRes.result.filter(
          (w: WorkPlanItem) => w.work_cycle === 2 && !marketIds.has(w.id),
        )
      }
    }

    // 执行记录
    if (execRes.code === 200) {
      const m: Record<number, ExecBrief> = {}
      for (const e of execRes.result as ExecBrief[]) {
        if (!m[e.work_plan_id]) m[e.work_plan_id] = e
      }
      executionMap.value = m
    }

    // 执行人
    if (dispatchRes.code === 200 && posRes.code === 200) {
      const posWork: Record<number, number[]> = {}
      for (const p of posRes.result) posWork[p.id] = p.works
      const map: Record<number, string[]> = {}
      for (const d of dispatchRes.result) {
        for (const posId of d.position_ids) {
          for (const wid of posWork[posId] || []) {
            if (!map[wid]) map[wid] = []
            for (const en of d.emp_names) {
              if (!map[wid].includes(en)) map[wid].push(en)
            }
          }
        }
      }
      executorMap.value = map
    }
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}

watch([runTab, selectedDate, weekStart, selectedMonth, () => props.pid], fetchData)
fetchData()

function prevDay() {
  selectedDate.value = selectedDate.value.subtract(1, 'day')
}
function nextDay() {
  selectedDate.value = selectedDate.value.add(1, 'day')
}
function prevWeek() {
  weekStart.value = weekStart.value.subtract(7, 'day')
}
function nextWeek() {
  weekStart.value = weekStart.value.add(7, 'day')
}

// 工作详情弹窗
const detailOpen = ref(false)
const detailWork = ref<WorkPlanItem | null>(null)
const detailExecs = ref<ExecBrief[]>([])
async function openDetail(w: WorkPlanItem) {
  detailWork.value = w
  detailExecs.value = []
  detailOpen.value = true
  const pid = props.pid
  const execRes = await fetch(`/api/workLoad/executions/${pid}`).then((r) => r.json())
  if (execRes.code === 200) {
    detailExecs.value = (execRes.result as ExecBrief[]).filter((e) => e.work_plan_id === w.id)
  }
}

const canMarketOrAssign = computed(() => {
  if (!detailWork.value) return false
  // 与PC端一致：执行记录为空 且 当前日期不是过去
  const hasExec = executionMap.value[detailWork.value.id]
  const isFuture = selectedDate.value.isAfter(dayjs(), 'day')
  return !hasExec && !isFuture
})

async function putToMarket() {
  if (!detailWork.value) return
  const pid = props.pid
  const now = dayjs()
  try {
    await fetch(`/api/workLoad/arrangements/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_id: detailWork.value.id,
        work_day: now.date(),
        work_month: now.month() + 1,
        work_week: calcWorkWeek(now),
      }),
    })
    message.success('已放入市场')
    detailOpen.value = false
    fetchData()
  } catch {
    message.error('操作失败')
  }
}

// 指派
const assignOpen = ref(false)
const assignWorkId = ref(0)
const allEmps = ref<EmpFullInfo[]>([])
const selectedEmpId = ref(0)
const assignKeyword = ref('')

// function openAssignDialog(w: WorkPlanItem) {
//   assignWorkId.value = w.id
//   assignOpen.value = true
//   selectedEmpId.value = 0
//   assignKeyword.value = ''
//   fetch(`/api/workLoad/empListByProject/${props.pid}`)
//     .then((r) => r.json())
//     .then((res) => {
//       if (res.code === 200) allEmps.value = res.result
//     })
// }

async function confirmAssign() {
  if (!selectedEmpId.value) {
    message.warning('请选择人员')
    return
  }
  try {
    const pid = props.pid
    const now = dayjs()
    await fetch(`/api/workLoad/arrangements/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_id: assignWorkId.value,
        work_day: now.date(),
        work_month: now.month() + 1,
        work_week: calcWorkWeek(now),
        ordertaker_id: selectedEmpId.value,
        status: 1,
      }),
    })
    assignOpen.value = false
    detailOpen.value = false
    message.success('指派成功')
    fetchData()
  } catch {
    message.error('操作失败')
  }
}

const filteredAssignEmps = computed(() => {
  const kw = assignKeyword.value.trim()
  return kw ? allEmps.value.filter((e) => e.name.includes(kw)) : allEmps.value
})

// 浮动工作市场按钮
const fabX = ref(0)
const fabY = ref(0)
const fabInit = ref(false)
const fabDragging = ref(false)
let fabStartX = 0
let fabStartY = 0
let fabOrigX = 0
let fabOrigY = 0

function initFab() {
  if (!fabInit.value) {
    fabX.value = window.innerWidth - 72
    fabY.value = window.innerHeight - 200
    fabInit.value = true
  }
}

function onFabTouchStart(e: TouchEvent) {
  fabDragging.value = false
  fabStartX = e.touches[0]!.clientX
  fabStartY = e.touches[0]!.clientY
  fabOrigX = fabX.value
  fabOrigY = fabY.value
}

function onFabTouchMove(e: TouchEvent) {
  const dx = e.touches[0]!.clientX - fabStartX
  const dy = e.touches[0]!.clientY - fabStartY
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) fabDragging.value = true
  fabX.value = Math.max(0, Math.min(window.innerWidth - 56, fabOrigX + dx))
  fabY.value = Math.max(0, Math.min(window.innerHeight - 56, fabOrigY + dy))
}

function onFabClick() {
  if (fabDragging.value) return
  router.push('/mobile/work-market')
}

onMounted(() => initFab())

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 子Tab -->
    <div class="flex border-b bg-white shrink-0">
      <div
        class="flex-1 py-2 text-center cursor-pointer font-bold text-sm"
        :class="runTab === 'today' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
        @click="runTab = 'today'"
      >
        今日
      </div>
      <div
        class="flex-1 py-2 text-center cursor-pointer font-bold text-sm"
        :class="runTab === 'week' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
        @click="runTab = 'week'"
      >
        本周
      </div>
      <div
        class="flex-1 py-2 text-center cursor-pointer font-bold text-sm"
        :class="runTab === 'month' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
        @click="runTab = 'month'"
      >
        本月
      </div>
    </div>

    <!-- 日期导航 -->
    <div class="flex items-center justify-between px-3 py-2 bg-white border-b">
      <template v-if="runTab === 'today'">
        <a-button size="small" @click="prevDay">◀</a-button>
        <span class="text-sm font-bold">{{ selectedDate.format('YYYY年M月D日') }}</span>
        <a-button size="small" @click="nextDay">▶</a-button>
      </template>
      <template v-else-if="runTab === 'week'">
        <a-button size="small" @click="prevWeek">◀</a-button>
        <span class="text-sm font-bold"
          >第{{ calcWorkWeek(weekStart) }}周 ({{ getWeekRangeStr(weekStart) }})</span
        >
        <a-button size="small" @click="nextWeek">▶</a-button>
      </template>
      <template v-else>
        <a-date-picker
          v-model:value="selectedMonth"
          picker="month"
          format="YYYY年M月"
          size="small"
          class="flex-1"
        />
      </template>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <a-spin :spinning="loading">
        <div v-if="works.length === 0" class="flex-center py-16">
          <a-empty description="暂无工作" />
        </div>
        <div
          v-for="w in works"
          :key="w.id"
          class="mb-3 bg-white rounded border p-3 cursor-pointer"
          :class="{ 'border-green-400': executionMap[w.id] }"
          @click="openDetail(w)"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-bold text-sm">{{ w.work_name }}</div>
              <div class="flex gap-2 mt-1 flex-wrap text-xs">
                <a-tag
                  :color="w.work_cycle === 0 ? 'blue' : w.work_cycle === 1 ? 'green' : 'orange'"
                  >{{ WORK_CYCLE_MAP[w.work_cycle] }}</a-tag
                >
                <span v-if="w.work_cycle === 1">{{ WEEKDAY_MAP[w.exec_time] || w.exec_time }}</span>
                <span v-else-if="w.work_cycle === 2">{{ w.exec_time }}日</span>
                <span class="text-gray-500">¥{{ w.price }} / {{ w.unit }}×{{ w.number }}</span>
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ w.start_time?.slice(0, 5) || '—' }}~{{ w.end_time?.slice(0, 5) || '—' }}
              </div>
              <div v-if="executorMap[w.id]" class="mt-1 flex gap-1 flex-wrap">
                <a-tag v-for="e in executorMap[w.id]" :key="e" size="small" class="text-xs">{{
                  e
                }}</a-tag>
              </div>
            </div>
            <a-tag v-if="executionMap[w.id]?.check_result === 1" color="success" size="small"
              >已完成</a-tag
            >
            <a-tag v-else-if="executionMap[w.id]?.check_result === 2" color="red" size="small"
              >不合格</a-tag
            >
            <a-tag v-else color="processing" size="small">待执行</a-tag>
          </div>
        </div>
      </a-spin>
    </div>
  </div>

  <!-- 工作详情弹窗 -->
  <a-modal
    v-model:open="detailOpen"
    :title="detailWork?.work_name || '工作详情'"
    :footer="null"
    width="90%"
    @cancel="detailOpen = false"
  >
    <div v-if="detailWork" class="text-sm">
      <div class="mb-2">
        <span class="text-gray-500">周期：</span>{{ WORK_CYCLE_MAP[detailWork.work_cycle] }}
      </div>
      <div class="mb-2">
        <span class="text-gray-500">时间：</span>{{ detailWork.start_time?.slice(0, 5) || '—' }}~{{
          detailWork.end_time?.slice(0, 5) || '—'
        }}
      </div>
      <div class="mb-2">
        <span class="text-gray-500">单价：</span>¥{{ detailWork.price }} / {{ detailWork.unit }}×{{
          detailWork.number
        }}
      </div>
      <div class="mb-3 font-bold">执行记录</div>
      <div v-if="detailExecs.length === 0" class="text-gray-400 text-center py-4">暂无执行记录</div>
      <div v-for="e in detailExecs" :key="e.id" class="border rounded p-2 mb-2 text-xs">
        <div>执行人：{{ e.uploader_name || '—' }}</div>
        <div>执行时间：{{ e.upload_time?.slice(0, 16).replace('T', ' ') || '—' }}</div>
        <div>
          检查结果：<a-tag
            :color="e.check_result === 1 ? 'green' : e.check_result === 2 ? 'red' : 'default'"
            size="small"
            >{{ ['未检查', '合格', '不合格'][e.check_result] }}</a-tag
          >
        </div>
        <div v-if="e.checker_name">检查人：{{ e.checker_name }}</div>
      </div>
      <div v-if="canMarketOrAssign" class="flex gap-2 mt-3">
        <a-button
          type="primary"
          size="small"
          @click="
            putToMarket()
            detailOpen = false
          "
          >放入市场</a-button
        >
        >
        <a-button size="small">指派</a-button>
      </div>
    </div>
  </a-modal>

  <!-- 指派弹窗 -->
  <a-modal
    v-model:open="assignOpen"
    title="指派人员"
    cancel-text="取消"
    ok-text="确定"
    @ok="confirmAssign"
    width="90%"
  >
    <a-input v-model:value="assignKeyword" placeholder="搜索姓名" size="small" class="mb-3" />
    <div class="max-h-60 overflow-y-auto">
      <div
        v-for="e in filteredAssignEmps"
        :key="e.id"
        class="flex items-center gap-2 py-2 px-1 border-b border-gray-100 cursor-pointer"
        :class="{ 'bg-blue-50': selectedEmpId === e.id }"
        @click="selectedEmpId = e.id"
      >
        <a-avatar :src="e.avatar" :size="28" />
        <div>
          <div class="text-sm">{{ e.name }}</div>
          <div class="text-xs text-gray-400">{{ e.depName }}</div>
        </div>
      </div>
    </div>
  </a-modal>

  <!-- 浮动工作市场按钮 -->
  <div
    class="fixed z-50 w-14 h-14 rounded-full flex-center text-white text-xl shadow-lg cursor-pointer select-none"
    style="background: linear-gradient(135deg, #1677ff, #4096ff); touch-action: none"
    :style="{
      left: fabX + 'px',
      top: fabY + 'px',
      transition: fabDragging ? 'none' : 'box-shadow 0.3s',
    }"
    @touchstart.prevent="onFabTouchStart"
    @touchmove.prevent="onFabTouchMove"
    @touchend="onFabClick"
  >
    <ShoppingCartOutlined />
  </div>
</template>
