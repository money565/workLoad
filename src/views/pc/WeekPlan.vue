<script setup lang="ts">
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { getWorkPlans, type WorkPlanItem, type EmpFullInfo } from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'
import { useUpload } from '@/composables/useUpload'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<WorkPlanItem[]>([])
const { initCos, getUrl } = useUpload()

function calcWorkWeek(d: dayjs.Dayjs): number {
  const now = d || dayjs()
  const start = dayjs(`${now.year()}-01-01`)
  let firstMon = start.day() === 1 ? start : start.add(8 - start.day(), 'day')
  if (now.isBefore(firstMon)) {
    const prevStart = dayjs(`${now.year()-1}-01-01`)
    firstMon = prevStart.day() === 1 ? prevStart : prevStart.add(8 - prevStart.day(), 'day')
  }
  return Math.max(1, Math.ceil(now.diff(firstMon, 'day') / 7) + 1)
}

const assignOpen = ref(false); const assignWorkId = ref(0); const assignKeyword = ref('')
const assignResults = ref<EmpFullInfo[]>([]); const selectedEmp = ref<EmpFullInfo | null>(null)

async function openAssign(record: { id: number }) { assignWorkId.value = record.id; assignKeyword.value = ''; assignResults.value = []; selectedEmp.value = null; assignOpen.value = true }
async function searchAssignEmps() {
  const kw = assignKeyword.value.trim()
  try { const res = await fetch(`/api/workLoad/empListByProject/${appCache.currentProject}`).then(r => r.json()); if (res.code === 200) assignResults.value = res.result.filter((e: EmpFullInfo) => !kw || e.name.includes(kw)) } catch { /* ignore */ }
}
async function confirmAssign() {
  if (!selectedEmp.value) { message.warning('请选择人员'); return }
  try {
    const w = weekStart.value
    await fetch(`/api/workLoad/arrangements/${appCache.currentProject}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ work_id: assignWorkId.value, work_day: w.date(), work_month: w.month() + 1, work_week: calcWorkWeek(w), ordertaker_id: selectedEmp.value.id, order_time: w.format('YYYY-MM-DDTHH:mm:ss'), status: 1 }) })
    assignOpen.value = false; message.success('指派成功'); fetchData()
  } catch { message.error('操作失败') }
}
async function putToMarket(wid: number) {
  try {
    const w = weekStart.value
    await fetch(`/api/workLoad/arrangements/${appCache.currentProject}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_id: wid, work_day: w.date(), work_month: w.month() + 1, work_week: calcWorkWeek(w) }),
    })
    message.success('已放入工作市场')
    fetchData()
  } catch { message.error('操作失败') }
}
const imageUrls = ref<Record<string, string>>({})

// 周选择器：计算当前周（星期一开始）
function getWeekRange(date: dayjs.Dayjs) {
  const day = date.day() // 0=周日 1=周一
  const monday = date.subtract(day === 0 ? 6 : day - 1, 'day')
  const sunday = monday.add(6, 'day')
  return { monday, sunday }
}

function getWeekLabel(date: dayjs.Dayjs) {
  const { monday } = getWeekRange(date)
  const yearStart = dayjs(`${monday.year()}-01-01`)
  const firstMonday = yearStart.day() === 1 ? yearStart : yearStart.add(8 - yearStart.day(), 'day')
  const weekNum = Math.ceil(monday.diff(firstMonday, 'day') / 7) + 1
  if (weekNum <= 0) {
    const prevYearStart = dayjs(`${monday.year() - 1}-01-01`)
    const prevFirstMon = prevYearStart.day() === 1 ? prevYearStart : prevYearStart.add(8 - prevYearStart.day(), 'day')
    return `第${Math.ceil(monday.diff(prevFirstMon, 'day') / 7) + 1}周`
  }
  return `第${weekNum}周`
}

const { monday, sunday } = getWeekRange(dayjs())
const weekStart = ref(monday)
const weekEnd = ref(sunday)
const selectedYear = ref(dayjs().year())
const yearOptions = computed(() => {
  const currentYear = dayjs().year()
  return Array.from({ length: 4 }, (_, i) => currentYear - i)
})

const weekLabel = computed(() => `${getWeekLabel(weekStart.value)} (${weekStart.value.format('MM/DD')} - ${weekEnd.value.format('MM/DD')})`)

function prevWeek() { weekStart.value = weekStart.value.subtract(7, 'day'); weekEnd.value = weekEnd.value.subtract(7, 'day'); fetchData() }
function nextWeek() { weekStart.value = weekStart.value.add(7, 'day'); weekEnd.value = weekEnd.value.add(7, 'day'); fetchData() }

// 生成所选年的周列表
const allWeeks = computed(() => {
  const year = selectedYear.value
  const yearStart = dayjs(`${year}-01-01`)
  let monday = yearStart.day() === 1 ? yearStart : yearStart.add(8 - yearStart.day(), 'day')
  if (monday.year() > year) monday = monday.subtract(7, 'day')
  const weeks: { label: string; monday: dayjs.Dayjs; sunday: dayjs.Dayjs }[] = []
  while (true) {
    const sun = monday.add(6, 'day')
    weeks.push({ label: `第${weeks.length + 1}周 (${monday.format('MM/DD')} - ${sun.format('MM/DD')})`, monday, sunday: sun })
    monday = monday.add(7, 'day')
    if (monday.year() > year && weeks.length > 50) break
    if (weeks.length > 53) break
  }
  return weeks
})

function selectYear(y: number) { selectedYear.value = y; selectWeek(allWeeks.value[0]!) }
function selectWeek(week: { monday: dayjs.Dayjs; sunday: dayjs.Dayjs }) {
  weekStart.value = week.monday; weekEnd.value = week.sunday; fetchData()
}

async function resolveImages(keys: string[]) {
  const map: Record<string, string> = {}
  for (const k of keys) { if (!k) continue; try { const u = await getUrl(k); if (u) map[k] = u } catch { /* ignore */ } }
  imageUrls.value = map
}

interface ExecData {
  work_plan_id: number; uploader_name: string; image: string; check_result: number
  checker_name: string; check_image: string; upload_time: string | null; check_time: string | null
}
const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
const expandedRowKeys = ref<(string | number)[]>([])
function onExpand(_expanded: boolean, record: Record<string, unknown>) {
  const key = record.id as string | number
  const idx = expandedRowKeys.value.indexOf(key)
  if (idx >= 0) expandedRowKeys.value.splice(idx, 1)
  else expandedRowKeys.value.push(key)
}
function customRow(record: Record<string, unknown>) {
  if ((record.id as number) < 0) return { onClick: () => onExpand(true, record), style: { cursor: 'pointer' } }
  return {}
}
const execMap = ref<Record<number, ExecData>>({})

const columns = [
  { title: '工作名称', dataIndex: 'work_name', key: 'work_name', width: 130 },
  { title: '周期', dataIndex: 'work_cycle', key: 'work_cycle', width: 50 },
  { title: '执行时间', key: 'exec_time', width: 80 },
  { title: '单价', dataIndex: 'price', key: 'price', width: 60 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 50 },
  { title: '数量', dataIndex: 'number', key: 'number', width: 50 },
  { title: '执行人', key: 'executor', width: 70 },
  { title: '工作照片', key: 'image', width: 80 },
  { title: '检查结果', key: 'check_result', width: 80 },
  { title: '检查人', key: 'checker', width: 70 },
  { title: '检查照片', key: 'check_image', width: 80 },
  { title: '操作', key: 'action', width: 140 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const pid = appCache.currentProject
    const [planRes, execRes, arrRes] = await Promise.all([
      getWorkPlans(pid),
      fetch(`/api/workLoad/executions/${pid}`).then(r => r.json()),
      fetch(`/api/workLoad/arrangements/${pid}`).then(r => r.json()),
    ])
    const marketIds = new Set<number>()
    if (arrRes.code === 200) {
      const curWeek = calcWorkWeek(weekStart.value)
      for (const a of arrRes.result) { if (a.work_week === curWeek) marketIds.add(a.work_id) }
    }
    if (planRes.code === 200) {
      const filtered = planRes.result.filter((w: WorkPlanItem) => w.work_cycle === 1 && !marketIds.has(w.id))
      const groupMap = new Map<string, (WorkPlanItem & { children?: WorkPlanItem[] })[]>()
      const singles: (WorkPlanItem & { children?: WorkPlanItem[] })[] = []
      for (const w of filtered) {
        if (w.group_key) {
          if (!groupMap.has(w.group_key)) groupMap.set(w.group_key, [])
          groupMap.get(w.group_key)!.push({ ...w })
        } else {
          singles.push({ ...w })
        }
      }
      const grouped: (WorkPlanItem & { children?: WorkPlanItem[] })[] = []
      for (const [, items] of groupMap) {
        if (items.length > 1) {
          const parent = { ...items[0]!, id: -(items[0]!.id) } as WorkPlanItem & { children?: WorkPlanItem[] }
          parent.children = items
          grouped.push(parent)
        } else {
          grouped.push(items[0]!)
        }
      }
      dataSource.value = [...singles, ...grouped]
    }
    if (execRes.code === 200) {
      const startStr = weekStart.value.format('YYYY-MM-DD')
      const endStr = weekEnd.value.format('YYYY-MM-DD')
      const m: Record<number, ExecData> = {}; const keys: string[] = []
      for (const e of execRes.result) {
        const t = e.upload_time?.slice(0, 10)
        if (t && t >= startStr && t <= endStr && !m[e.work_plan_id]) m[e.work_plan_id] = e
        if (e.image) keys.push(e.image); if (e.check_image) keys.push(e.check_image)
      }
      execMap.value = m
      if (keys.length > 0) { initCos().then(() => resolveImages(keys)) }
    }
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="本周计划" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <div class="flex items-center gap-2">
          <a-button size="small" @click="prevWeek">◀</a-button>
          <a-select v-model:value="selectedYear" class="w-20" size="small" @change="(v) => v && selectYear(Number(String(v)))">
            <a-select-option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</a-select-option>
          </a-select>
          <a-select :value="weekLabel" class="w-56" size="small" @change="(v) => { const w = allWeeks.find((x) => String(x.label) === String(v)); if (w) selectWeek(w) }">
            <a-select-option v-for="w in allWeeks" :key="w.label" :value="w.label">{{ w.label }}</a-select-option>
          </a-select>
          <a-button size="small" @click="nextWeek">▶</a-button>
        </div>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table :columns="columns" :data-source="dataSource" :loading="loading" :pagination="{ pageSize: 20 }" :scroll="{ y: 'calc(100vh - 320px)' }" row-key="id" size="middle" :row-class-name="(r: { id: number }) => r.id < 0 ? 'group-parent-row' : ''" v-model:expanded-row-keys="expandedRowKeys" :custom-row="customRow">
        <template #bodyCell="{ column, record }">
          <template v-if="record.id < 0">
            <span v-if="column.key === 'work_name'">{{ record.work_name }}</span>
            <span v-else></span>
          </template>
          <template v-else-if="column.key === 'work_cycle'">
            <a-tag :color="record.work_cycle === 0 ? 'blue' : record.work_cycle === 1 ? 'green' : ''">{{ WORK_CYCLE_MAP[record.work_cycle] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'exec_time'">
            <template v-if="record.work_cycle === 0">{{ record.exec_time === -1 ? '每天' : record.exec_time }}</template>
            <template v-else-if="record.work_cycle === 1">{{ WEEKDAY_MAP[record.exec_time] || record.exec_time }}</template>
            <template v-else-if="record.work_cycle === 2">{{ record.exec_time }}日</template>
            <template v-else>—</template>
          </template>
          <template v-else-if="column.key === 'executor'">{{ execMap[record.id]?.uploader_name || '无' }}</template>
          <template v-else-if="column.key === 'image'">
            <a-image v-if="execMap[record.id]?.image" :src="imageUrls[execMap[record.id]!.image] || execMap[record.id]!.image" :width="40" />
            <span v-else class="text-gray-400">无</span>
          </template>
          <template v-else-if="column.key === 'check_result'">
            <a-tag v-if="execMap[record.id]" :color="execMap[record.id]!.check_result === 1 ? 'green' : execMap[record.id]!.check_result === 2 ? 'red' : 'default'">
              {{ ['未检查','合格','不合格'][execMap[record.id]!.check_result] }}
            </a-tag>
            <span v-else class="text-gray-400">无</span>
          </template>
          <template v-else-if="column.key === 'checker'">{{ execMap[record.id]?.checker_name || '无' }}</template>
          <template v-else-if="column.key === 'check_image'">
            <a-image v-if="execMap[record.id]?.check_image" :src="imageUrls[execMap[record.id]!.check_image] || execMap[record.id]!.check_image" :width="40" />
            <span v-else class="text-gray-400">无</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space v-if="record.id > 0 && !execMap[record.id] && !weekStart.isBefore(dayjs().day(1).subtract(dayjs().day()===0?6:0,'day'), 'day')">
              <a-button size="small" type="primary" @click="putToMarket(record.id)">放入市场</a-button>
              <a-button size="small" @click="openAssign({ id: Number(record.id) })">指派</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:open="assignOpen" title="指派人员" cancel-text="取消" ok-text="确定" @ok="confirmAssign" width="400px">
      <a-input v-model:value="assignKeyword" placeholder="搜索姓名" @press-enter="searchAssignEmps" @focus="searchAssignEmps" class="mb-3" />
      <div class="max-h-60 overflow-y-auto">
        <div v-for="e in assignResults" :key="e.id" class="flex items-center gap-2 py-1 px-2 rounded cursor-pointer" :class="{ 'bg-blue-50': selectedEmp?.id === e.id }" @click="selectedEmp = e">
          <a-avatar :src="e.avatar" :size="28" /><div><div class="text-sm">{{ e.name }}</div><div class="text-xs text-gray-400">{{ e.depName }}</div></div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
:deep(.ant-table-row-expand-icon) {
  transition: transform 0.5s ease;
}
:deep(.ant-table-tbody tr.ant-table-row-level-1) {
  animation: expandIn 0.5s ease both;
}
:deep(.group-parent-row) {
  background-color: #e6f4ff !important;
}
:deep(.group-parent-row + tr.ant-table-row-level-1),
:deep(tr.ant-table-row-level-1) {
  background-color: #f0f8ff !important;
}
@keyframes expandIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
