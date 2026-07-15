<script setup lang="ts">
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/counter'
import { HomeOutlined, UserOutlined, CalendarOutlined, SoundOutlined, LoadingOutlined } from '@ant-design/icons-vue'

const userStore = useUserStore()
const activeTab = ref('today')

onMounted(() => {
  userStore.login().then(() => {
    fetchGrabList()
    fetchMyWorks()
  })
})

interface GrabItem {
  id: number
  work_id: number
  work_name: string
  work_day: number
  work_month: number
  work_week: number
  work_cycle: number
  price: number
  unit: string
  number: number
  ordertaker_id: number | null
  order_time: string | null
  status: number
  start_time: string | null
  end_time: string | null
}
const grabList = ref<GrabItem[]>([])
const grabLoading = ref(false)

async function fetchGrabList() {
  if (!userStore.userInfo.userid) return
  grabLoading.value = true
  try {
    const res = await fetch(`/api/workLoad/mobileScan/${userStore.userInfo.userid}`).then((r) =>
      r.json(),
    )
    if (res.code === 200 && res.result.length > 0) {
      const pid = res.result[0].project_id
      // 收集用户已有的工作ID（通过调配分配），这些不在抢单列表中显示
      const myWorkIds = new Set(res.result.map((w: { work_id: number }) => w.work_id))
      const arrRes = await fetch(`/api/workLoad/arrangements/${pid}`).then((r) => r.json())
      if (arrRes.code === 200) {
        const planRes = await fetch(`/api/workLoad/workPlans/${pid}`).then((r) => r.json())
        const planMap: Record<
          number,
          { id: number; work_cycle: number; price: number; unit: string; number: number; start_time: string | null; end_time: string | null }
        > = {}
        if (planRes.code === 200) for (const p of planRes.result) planMap[p.id] = p
        grabList.value = arrRes.result
          .filter(
            (a: { status: number; ordertaker_id: number | null; work_id: number }) =>
              a.status === 0 && !a.ordertaker_id && !myWorkIds.has(a.work_id),
          )
          .map(
            (a: {
              status: number
              ordertaker_id: number | null
              work_id: number
              work_name: string
              work_day: number
              work_month: number
              work_week: number
            }) => {
              const p = planMap[a.work_id] || ({} as typeof planMap[number])
              return { ...a, work_cycle: p.work_cycle, price: p.price, unit: p.unit, number: p.number, start_time: p.start_time, end_time: p.end_time }
            },
          )
      }
    }
  } catch {
    /* ignore */
  } finally {
    grabLoading.value = false
  }
  preloadGrabTTS(grabList.value)
}

async function takeOrder(arrId: number) {
  const uid = userStore.userInfo.userid
  if (!uid) { message.error('未获取到用户ID，请重新登录'); return }
  try {
    const payload = { userid: uid, arr_id: arrId }
    const resp = await fetch('/api/workLoad/takeOrder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await resp.text()
    const result = JSON.parse(text)
    if (result.code === 200) { message.success('接单成功'); speakOnce('抢单成功'); await fetchGrabList(); await fetchGrabbedWorks(); await fetchMyWorks() }
    else message.error(result.msg || '接单失败')
  } catch (e) { message.error('网络错误'); console.error(e) }
}

async function giveUpOrder(arrId: number) {
  try {
    const resp = await fetch(`/api/workLoad/arrangement/${arrId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordertaker_id: null, order_time: null, status: 0 }),
    })
    const result = await resp.json()
    if (result.code === 200) { message.success('已放弃'); await fetchGrabbedWorks(); await fetchGrabList(); await fetchMyWorks() }
    else message.error(result.msg || '操作失败')
  } catch (e) { message.error('网络错误'); console.error(e) }
}

const grabSubTab = ref<'available' | 'grabbed'>('available')
const grabbedList = ref<GrabItem[]>([])
const grabbedLoading = ref(false)
const grabbedPage = ref(1)
const grabbedTotal = computed(() => grabbedList.value.length)
const grabbedPaged = computed(() => {
  const start = (grabbedPage.value - 1) * 10
  return grabbedList.value.slice(start, start + 10)
})

async function fetchGrabbedWorks() {
  if (!userStore.userInfo.userid) return
  grabbedLoading.value = true
  try {
    const res = await fetch(`/api/workLoad/mobileScan/${userStore.userInfo.userid}`).then(r => r.json())
    let pid = 0
    if (res.code === 200 && res.result.length > 0) pid = res.result[0].project_id
    if (!pid) { grabbedList.value = []; grabbedLoading.value = false; return }

    const [arrRes, planRes] = await Promise.all([
      fetch(`/api/workLoad/arrangements/${pid}`).then(r => r.json()),
      fetch(`/api/workLoad/workPlans/${pid}`).then(r => r.json()),
    ])
    const planMap: Record<number, { work_cycle: number; price: number; unit: string; number: number; start_time: string | null; end_time: string | null }> = {}
    if (planRes.code === 200) for (const p of planRes.result) planMap[p.id] = p

    const currentUserName = userStore.userInfo.username
    if (arrRes.code === 200) {
      grabbedList.value = arrRes.result
        .filter((a: { ordertaker_name: string; status: number }) =>
          a.ordertaker_name === currentUserName && a.status === 1,
        )
        .map((a: GrabItem) => {
          const p = planMap[a.work_id] || ({} as typeof planMap[number])
          return { ...a, work_cycle: p.work_cycle, price: p.price, unit: p.unit, number: p.number, start_time: p.start_time, end_time: p.end_time }
        })
        .sort((a: GrabItem, b: GrabItem) => (b.order_time || '').localeCompare(a.order_time || ''))
      grabbedPage.value = 1
    }
    preloadGrabTTS(grabbedList.value)
  } catch { /* ignore */ }
  finally { grabbedLoading.value = false }
}

watch(activeTab, (v) => {
  if (v === 'grab') fetchGrabList()
  if (v === 'today') fetchMyWorks()
})

const salaryData = ref({
  month: '2026年7月',
  total: 6823.5,
  items: [
    { work: '车库主道清洁', count: 30, unitPrice: 0.16, amount: 163.2 },
    { work: '电梯厅保洁', count: 28, unitPrice: 186.67, amount: 5226.76 },
    { work: '车位清洁', count: 15, unitPrice: 5.03, amount: 1509.0 },
    { work: '坡道冲洗', count: 20, unitPrice: 1.0, amount: 280.0 },
  ],
  deduction: 355.46,
})

interface WorkItem {
  work_id: number; work_name: string; price: number; unit: string; number: number
  work_cycle: number; exec_time: number; position_name: string; project_name: string
  start_time: string | null; end_time: string | null
  executed: boolean; msg: string | null; source: 'assigned' | 'grabbed'
}
const myWorks = ref<WorkItem[]>([])
const takenWorkIds = ref<Set<number>>(new Set())
const grabbedWorkIds = ref<Set<number>>(new Set())
const marketWorkIds = ref<Set<number>>(new Set())
const loading = ref(false)

// 计算本年周数（第一个星期一 = 第1周）
function calcWorkWeek(d: Date): number {
  const year = d.getFullYear()
  const start = new Date(year, 0, 1)
  const day = start.getDay()
  let firstMon: Date
  if (day === 1) { firstMon = start }
  else { firstMon = new Date(start); firstMon.setDate(start.getDate() + (8 - day) % 7) }
  if (d < firstMon) {
    // 属于上一年的最后一周
    const prevStart = new Date(year - 1, 0, 1)
    const prevDay = prevStart.getDay()
    let prevFirstMon: Date
    if (prevDay === 1) { prevFirstMon = prevStart }
    else { prevFirstMon = new Date(prevStart); prevFirstMon.setDate(prevStart.getDate() + (8 - prevDay) % 7) }
    return Math.ceil((d.getTime() - prevFirstMon.getTime()) / (7 * 86400000)) + 1
  }
  return Math.ceil((d.getTime() - firstMon.getTime()) / (7 * 86400000)) + 1
}

// 判断抢到的工作是否属于本期（今日/本周/本月）
function isCurrentPeriod(arr: { work_day: number; work_month: number; work_week: number }, plan: { work_cycle: number }): boolean {
  const now = new Date()
  if (plan.work_cycle === 0) return arr.work_day === now.getDate()
  if (plan.work_cycle === 1) return arr.work_week === calcWorkWeek(now)
  if (plan.work_cycle === 2) return arr.work_month === now.getMonth() + 1
  return false
}

// 判断执行状态（逻辑与后端 MobileScanView.get 一致）
function checkExecution(workPlanId: number, workCycle: number, execTime: number, executions: Array<{ work_plan_id: number; upload_time: string | null; uploader_name: string }>): { executed: boolean; msg: string | null } {
  const today = new Date()
  if (workCycle === 0) {
    const todayStr = today.toISOString().slice(0, 10)
    const exe = executions.find(e => e.work_plan_id === workPlanId && e.upload_time?.startsWith(todayStr))
    if (exe) {
      const t = exe.upload_time?.slice(0, 16).replace('T', ' ') || ''
      return { executed: true, msg: `该工作已经于 ${t} 被${exe.uploader_name}执行` }
    }
  } else if (workCycle === 1) {
    const wkday = today.getDay() || 7
    const monday = new Date(today); monday.setDate(today.getDate() - wkday + 1)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const startStr = monday.toISOString().slice(0, 10)
    const endStr = sunday.toISOString().slice(0, 10)
    const exe = executions.find(e => e.work_plan_id === workPlanId && e.upload_time && e.upload_time.slice(0, 10) >= startStr && e.upload_time.slice(0, 10) <= endStr)
    if (exe) {
      const t = exe.upload_time?.slice(0, 16).replace('T', ' ') || ''
      return { executed: true, msg: `该工作已经于 ${t} 被${exe.uploader_name}执行` }
    }
  } else if (workCycle === 2) {
    const execDay = execTime
    if (today.getDate() < execDay) {
      return { executed: false, msg: `还没到检查时间（每月${execDay}日）` }
    }
    const execDate = new Date(today.getFullYear(), today.getMonth(), execDay)
    const startStr = execDate.toISOString().slice(0, 10)
    const endStr = today.toISOString().slice(0, 10)
    const exe = executions.find(e => e.work_plan_id === workPlanId && e.upload_time && e.upload_time.slice(0, 10) >= startStr && e.upload_time.slice(0, 10) <= endStr)
    if (exe) {
      const t = exe.upload_time?.slice(0, 16).replace('T', ' ') || ''
      return { executed: true, msg: `该工作已经于 ${t} 被${exe.uploader_name}执行` }
    }
  }
  return { executed: false, msg: null }
}

async function fetchMyWorks() {
  if (!userStore.userInfo.userid) return
  loading.value = true
  try {
    const uid = userStore.userInfo.userid
    const scanRes = await fetch(`/api/workLoad/mobileScan/${uid}`).then(r => r.json())

    // 获取项目ID
    let pid = 0
    if (scanRes.code === 200 && scanRes.result.length > 0) {
      pid = scanRes.result[0].project_id
    }
    if (!pid) { myWorks.value = []; loading.value = false; return }

    // 并行获取计划、安排、执行数据
    const [planRes, arrRes, execRes] = await Promise.all([
      pid ? fetch(`/api/workLoad/workPlans/${pid}`).then(r => r.json()) : Promise.resolve({ code: 0, result: [] }),
      pid ? fetch(`/api/workLoad/arrangements/${pid}`).then(r => r.json()) : Promise.resolve({ code: 0, result: [] }),
      pid ? fetch(`/api/workLoad/executions/${pid}`).then(r => r.json()) : Promise.resolve({ code: 0, result: [] }),
    ])

    const planMap: Record<number, { id: number; work_cycle: number; exec_time: number; price: number; unit: string; number: number; work_name: string; start_time: string | null; end_time: string | null }> = {}
    if (planRes.code === 200) for (const p of planRes.result) planMap[p.id] = p

    const executions: Array<{ work_plan_id: number; upload_time: string | null; uploader_name: string }> = execRes.code === 200 ? execRes.result : []

    // 区分用户抢到的、其他人抢走的、已放入市场的
    const takenIds = new Set<number>()
    const grabbedIds = new Set<number>()
    const marketIds = new Set<number>()
    const grabbedWorks: WorkItem[] = []

    if (arrRes.code === 200) {
      for (const a of arrRes.result) {
        // 只有本期放入市场的才标记（与PC端逻辑一致）
        const plan = planMap[a.work_id]
        if (plan && isCurrentPeriod(a, plan)) {
          marketIds.add(a.work_id)
        }
        if (a.ordertaker_id && a.status === 1) {
          takenIds.add(a.work_id)
        }
      }
      // 筛选当前用户抢到的（ordertaker_name 匹配或通过 ordertaker_id）
      // 注意：arrangements 返回的是 ordertaker_id (emp id) 和 ordertaker_name
      // 需要用 userid 来判断。由于 arrangements 不直接返回 userid，
      // 我们通过匹配 ordertaker_name 和当前用户名来判断
      const currentUserName = userStore.userInfo.username
      for (const a of arrRes.result) {
        if (a.ordertaker_id && a.status === 1 && a.ordertaker_name === currentUserName) {
          const plan = planMap[a.work_id]
          if (!plan || !isCurrentPeriod(a, plan)) continue
          const exeCheck = checkExecution(a.work_id, plan.work_cycle, plan.exec_time, executions)
          grabbedIds.add(a.work_id)
          // 从 takenIds 中移除（因为是自己抢的，不算别人抢走）
          takenIds.delete(a.work_id)
          grabbedWorks.push({
            work_id: a.work_id,
            work_name: a.work_name || plan.work_name,
            price: plan.price,
            unit: plan.unit,
            number: plan.number,
            work_cycle: plan.work_cycle,
            exec_time: plan.exec_time,
            position_name: '抢单',
            project_name: '',
            start_time: plan.start_time,
            end_time: plan.end_time,
            executed: exeCheck.executed,
            msg: exeCheck.msg,
            source: 'grabbed',
          })
        }
      }
    }

    // 从市场ID中排除用户自己抢到的（已单独显示）和已被别人抢走的（另有标记）
    for (const wid of grabbedIds) marketIds.delete(wid)
    for (const wid of takenIds) marketIds.delete(wid)
    marketWorkIds.value = marketIds
    takenWorkIds.value = takenIds
    grabbedWorkIds.value = grabbedIds

    // mobileScan 结果：标记已被别人抢走的
    const scanWorks: WorkItem[] = []
    if (scanRes.code === 200) {
      for (const w of scanRes.result) {
        const wid = w.work_id as number
        if (grabbedIds.has(wid)) continue
        scanWorks.push({
          ...w,
          source: 'assigned' as const,
        })
      }
    }

    // 合并并排序：待执行 > 已完成 > 已安排(别人抢走) > 已安排至市场
    myWorks.value = [...scanWorks, ...grabbedWorks].sort((a, b) => {
      const rank = (w: WorkItem) => {
        if (!w.executed && !takenWorkIds.value.has(w.work_id) && !marketWorkIds.value.has(w.work_id)) return 0
        if (w.executed) return 1
        if (takenWorkIds.value.has(w.work_id)) return 2
        return 3  // 已安排至市场
      }
      return rank(a) - rank(b)
    })
    preloadTTS(myWorks.value)
  } catch { /* ignore */ }
  finally { loading.value = false }
}


const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const speakingWorkId = ref<number | null>(null)
const ttsCache = new Map<number, string>() // work_id -> dataUrl
const TTS_CACHE_KEY = 'tts_cache_v2'

// 从 localStorage 恢复缓存
function loadTTSCache() {
  try {
    const raw = localStorage.getItem(TTS_CACHE_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>
      for (const [k, v] of Object.entries(obj)) ttsCache.set(Number(k), v)
    }
  } catch { /* ignore */ }
}
loadTTSCache()

function buildSpeakText(w: WorkItem): string {
  const time = w.start_time?.slice(0, 5) || ''
  let text = ''
  if (w.work_cycle === 0) text = `${time}做${w.work_name}`
  else if (w.work_cycle === 1) text = `${WEEKDAY_NAMES[w.exec_time] || ''}${time}做${w.work_name}`
  else if (w.work_cycle === 2) text = `${w.exec_time}日${time}做${w.work_name}`
  else text = `${time}执行${w.work_name}`
  if (w.executed) text = `已完成${text}`
  return text
}

function saveTTSCache() {
  const obj: Record<string, string> = {}
  for (const [k, v] of ttsCache.entries()) obj[k] = v
  try { localStorage.setItem(TTS_CACHE_KEY, JSON.stringify(obj)) } catch { /* quota */ }
}

async function preloadTTS(works: WorkItem[]) {
  for (const w of works) {
    if (ttsCache.has(w.work_id)) continue
    const text = buildSpeakText(w)
    try {
      const resp = await fetch(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      await new Promise<void>((resolve) => { reader.onloadend = () => resolve() })
      ttsCache.set(w.work_id, reader.result as string)
      saveTTSCache()
    } catch { /* ignore */ }
  }
}

function speakOnce(text: string) {
  const audio = new Audio(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
  audio.volume = 1
  audio.play().catch(() => {})
}

let audioCtx: AudioContext | null = null

async function playWithGain(dataUrl: string): Promise<void> {
  if (!audioCtx) audioCtx = new AudioContext()
  const resp = await fetch(dataUrl)
  const buf = await resp.arrayBuffer()
  const audioBuf = await audioCtx.decodeAudioData(buf)
  const source = audioCtx.createBufferSource()
  source.buffer = audioBuf
  // 增益 + 简易压缩防忽大忽小
  const gain = audioCtx.createGain()
  gain.gain.value = 2.5
  const compressor = audioCtx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 20
  compressor.ratio.value = 4
  source.connect(gain)
  gain.connect(compressor)
  compressor.connect(audioCtx.destination)
  source.start()
  return new Promise((resolve) => { source.onended = () => resolve() })
}

async function speakWork(w: WorkItem) {
  speakingWorkId.value = w.work_id
  const dataUrl = ttsCache.get(w.work_id)
  if (!dataUrl) return
  try {
    await playWithGain(dataUrl)
  } catch { /* ignore */ }
  speakingWorkId.value = null
}

async function speakGrab(item: GrabItem) {
  grabSpeakingId.value = item.id
  const dataUrl = ttsCache.get(-item.id)
  if (!dataUrl) return
  try {
    await playWithGain(dataUrl)
  } catch { /* ignore */ }
  grabSpeakingId.value = null
}

const WORK_CYCLE_LABEL: Record<number, string> = { 0: '每日工作', 1: '每周工作', 2: '每月工作' }

function numberToChinese(n: number): string {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 10) return digits[n] || String(n)
  if (n < 20) return `十${digits[n - 10] || ''}`
  if (n < 100) return `${digits[Math.floor(n / 10)] || ''}十${digits[n % 10] || ''}`
  return String(n)
}

function buildGrabText(item: GrabItem): string {
  const time = item.start_time?.slice(0, 5) || ''
  if (item.work_cycle === 0) {
    return `${item.work_day}日${time}做${item.work_name}`
  } else if (item.work_cycle === 1) {
    const range = getWeekRange(item.work_week)
    const parts = range.split('-')
    const startParts = (parts[0] || '00/00').split('/')
    const endParts = (parts[1] || '00/00').split('/')
    const startStr = `${parseInt(startParts[0] || '0')}月${parseInt(startParts[1] || '0')}日`
    const endStr = `${parseInt(endParts[0] || '0')}月${parseInt(endParts[1] || '0')}日`
    return `第${numberToChinese(item.work_week)}周${startStr}至${endStr}${time}做${item.work_name}`
  } else if (item.work_cycle === 2) {
    return `${item.work_month}月${item.work_day}日${time}做${item.work_name}`
  }
  return `${time}做${item.work_name}`
}

const grabSpeakingId = ref<number | null>(null)

async function preloadGrabTTS(items: GrabItem[]) {
  for (const item of items) {
    if (ttsCache.has(-item.id)) continue  // negative key for grab items
    const text = buildGrabText(item)
    try {
      const resp = await fetch(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      await new Promise<void>((resolve) => { reader.onloadend = () => resolve() })
      ttsCache.set(-item.id, reader.result as string)
      saveTTSCache()
    } catch { /* ignore */ }
  }
}


function getWeekRange(weekNum: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1)
  const firstMon = new Date(start); firstMon.setDate(start.getDate() + (8 - start.getDay()) % 7 || (start.getDay() === 1 ? 0 : 7 - start.getDay() + 1))
  // Simplified calculation
  const monday = new Date(firstMon); monday.setDate(firstMon.getDate() + (weekNum - 1) * 7)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  return `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}-${String(sunday.getMonth() + 1).padStart(2, '0')}/${String(sunday.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-100">
    <!-- 抢单 -->
    <div v-if="activeTab === 'grab'" class="flex-1 flex flex-col overflow-hidden">
      <div class="flex border-b bg-white shrink-0">
        <div
          class="flex-1 py-2 text-center cursor-pointer font-bold"
          :class="grabSubTab === 'available' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
          @click="grabSubTab = 'available'"
        >可抢工作</div>
        <div
          class="flex-1 py-2 text-center cursor-pointer font-bold"
          :class="grabSubTab === 'grabbed' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'"
          @click="grabSubTab = 'grabbed'; fetchGrabbedWorks()"
        >抢到的工作</div>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <!-- 可抢工作 -->
        <template v-if="grabSubTab === 'available'">
          <a-spin :spinning="grabLoading">
            <div v-if="grabList.length === 0" class="text-center py-8 text-gray-400">暂无可抢工作</div>
            <a-card v-for="item in grabList" :key="item.id" class="mb-3 relative">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="font-bold text-base">{{ item.work_name }}</div>
                  <div class="mt-1">
                    <a-tag v-if="item.work_cycle === 0" color="blue">{{ item.work_day }}日</a-tag>
                    <a-tag v-else-if="item.work_cycle === 1" color="green"
                      >第{{ item.work_week }}周 ({{ getWeekRange(item.work_week) }})</a-tag
                    >
                    <a-tag v-else-if="item.work_cycle === 2" color="orange"
                      >{{ item.work_month }}月{{ item.work_day }}日</a-tag
                    >
                  </div>
                  <div class="mt-2 flex gap-2 text-sm flex-wrap">
                    <span>¥{{ item.price || '—' }}/{{ item.unit || '—' }}×{{ item.number || '—' }}</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{ item.start_time?.slice(0, 5) || '—' }} ~ {{ item.end_time?.slice(0, 5) || '—' }}
                  </div>
                </div>
                <a-button type="primary" size="small" @click="takeOrder(item.id)">接单</a-button>
              </div>
              <LoadingOutlined v-if="grabSpeakingId === item.id" class="absolute right-2 bottom-2 text-blue-400 text-2xl" spin />
              <SoundOutlined v-else class="absolute right-2 bottom-2 text-blue-400 text-2xl cursor-pointer" @click.stop="speakGrab(item)" />
            </a-card>
          </a-spin>
        </template>
        <!-- 抢到的工作 -->
        <template v-else>
          <a-spin :spinning="grabbedLoading">
            <div v-if="grabbedList.length === 0" class="text-center py-8 text-gray-400">暂无抢到的工作</div>
            <template v-else>
              <a-card v-for="item in grabbedPaged" :key="item.id" class="mb-3 relative">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="font-bold text-base">{{ item.work_name }}</div>
                    <div class="mt-1">
                      <a-tag v-if="item.work_cycle === 0" color="blue">{{ item.work_day }}日</a-tag>
                      <a-tag v-else-if="item.work_cycle === 1" color="green"
                        >第{{ item.work_week }}周 ({{ getWeekRange(item.work_week) }})</a-tag
                      >
                      <a-tag v-else-if="item.work_cycle === 2" color="orange"
                        >{{ item.work_month }}月{{ item.work_day }}日</a-tag
                      >
                    </div>
                    <div class="mt-2 flex gap-2 text-sm flex-wrap">
                      <span>¥{{ item.price || '—' }}/{{ item.unit || '—' }}×{{ item.number || '—' }}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                      {{ item.start_time?.slice(0, 5) || '—' }} ~ {{ item.end_time?.slice(0, 5) || '—' }}
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                      接单时间: {{ item.order_time?.slice(0, 16).replace('T', ' ') || '—' }}
                    </div>
                  </div>
                  <a-button v-if="isCurrentPeriod(item, { work_cycle: item.work_cycle })" size="small" danger @click="giveUpOrder(item.id)">放弃</a-button>
                  <a-tag v-else color="default">历史工作</a-tag>
                </div>
                <LoadingOutlined v-if="grabSpeakingId === item.id" class="absolute right-2 bottom-2 text-blue-400 text-2xl" spin />
                <SoundOutlined v-else class="absolute right-2 bottom-2 text-blue-400 text-2xl cursor-pointer" @click.stop="speakGrab(item)" />
              </a-card>
              <a-pagination
                v-if="grabbedTotal > 10"
                v-model:current="grabbedPage"
                :total="grabbedTotal"
                :page-size="10"
                size="small"
                class="text-center mt-4"
              />
            </template>
          </a-spin>
        </template>
      </div>
    </div>

    <!-- 今日工作 -->
    <div v-if="activeTab === 'today'" class="flex-1 overflow-y-auto p-4">
      <div class="text-lg font-bold mb-4">今日工作</div>
      <a-spin :spinning="loading">
        <div v-if="myWorks.length === 0" class="text-center py-8 text-gray-400">暂无工作安排</div>
        <a-card
          v-for="w in myWorks"
          :key="w.source + '-' + w.work_id"
          class="mb-3 relative"
          :class="{ 'border-green-400': w.executed, 'border-blue-400': w.source === 'grabbed' && !w.executed, 'opacity-50': takenWorkIds.has(w.work_id) || marketWorkIds.has(w.work_id) }"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-bold text-base">{{ w.work_name }}</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ w.position_name }}<template v-if="w.project_name"> · {{ w.project_name }}</template>
              </div>
              <div class="mt-2 flex gap-2 text-sm flex-wrap">
                <a-tag :color="w.source === 'grabbed' ? 'blue' : undefined">{{ WORK_CYCLE_LABEL[w.work_cycle] || '—' }}</a-tag>
                <span>¥{{ w.price }} / {{ w.unit }}×{{ w.number }}</span>
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ w.start_time?.slice(0, 5) || '—' }} ~ {{ w.end_time?.slice(0, 5) || '—' }}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <a-tag v-if="w.source === 'grabbed'" color="blue">抢单</a-tag>
              <a-tag v-if="takenWorkIds.has(w.work_id)" color="default">已安排</a-tag>
              <a-tag v-else-if="marketWorkIds.has(w.work_id)" color="default">已安排至市场</a-tag>
              <a-tag v-else-if="w.executed" color="success">已完成</a-tag>
              <a-tag v-else color="processing">待执行</a-tag>
            </div>
          </div>
          <LoadingOutlined v-if="speakingWorkId === w.work_id" class="absolute right-2 bottom-2 text-blue-400 text-2xl" spin />
          <SoundOutlined v-else class="absolute right-2 bottom-2 text-blue-400 text-2xl cursor-pointer" @click.stop="speakWork(w)" />
        </a-card>
      </a-spin>
    </div>

    <!-- 我的页 -->
    <div v-if="activeTab === 'mine'" class="flex-1 overflow-y-auto p-4">
      <a-card class="mb-4">
        <div class="flex items-center gap-3">
          <a-avatar :src="userStore.userInfo.avatar" :size="56" />
          <div>
            <div class="text-lg font-bold">{{ userStore.userInfo.username || '未登录' }}</div>
            <div class="text-sm text-gray-500">
              {{ userStore.userInfo.position }} · {{ userStore.userInfo.mobile }}
            </div>
          </div>
        </div>
      </a-card>
      <a-card title="我的薪资" class="mb-4">
        <div class="text-center mb-3">
          <div class="text-3xl font-bold text-green-600">¥{{ salaryData.total }}</div>
          <div class="text-xs text-gray-400">{{ salaryData.month }}</div>
        </div>
        <a-divider />
        <div class="text-sm font-bold mb-2">工作明细</div>
        <div v-for="s in salaryData.items" :key="s.work" class="flex justify-between text-sm py-1">
          <span>{{ s.work }} ×{{ s.count }}</span>
          <span>¥{{ s.amount }}</span>
        </div>
        <a-divider />
        <div class="flex justify-between text-sm">
          <span>扣款</span>
          <span class="text-red-500">-¥{{ salaryData.deduction }}</span>
        </div>
        <div class="flex justify-between font-bold mt-2 pt-2 border-t">
          <span>实发</span>
          <span class="text-green-600"
            >¥{{ (salaryData.total - salaryData.deduction).toFixed(2) }}</span
          >
        </div>
      </a-card>
      <a-card title="薪资说明" size="small">
        <div class="text-sm text-gray-600 space-y-2">
          <p>1. 单价按岗位标准执行，具体金额以实际工作量为准。</p>
          <p>2. 每月15日发放上月薪资。</p>
          <p>3. 扣款包括：社保公积金、个人所得税等。</p>
          <p>4. 如有疑问请联系项目财务。</p>
        </div>
      </a-card>
    </div>

    <!-- TabBar -->
    <div class="flex border-t bg-white shrink-0">
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'grab' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'grab'"
      >
        <HomeOutlined class="text-xl" />
        <span class="text-xs mt-1">抢单</span>
      </div>
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'today' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'today'"
      >
        <CalendarOutlined class="text-xl" />
        <span class="text-xs mt-1">今日工作</span>
      </div>
      <div
        class="flex-1 py-2 flex flex-col items-center cursor-pointer"
        :class="activeTab === 'mine' ? 'text-blue-500' : 'text-gray-500'"
        @click="activeTab = 'mine'"
      >
        <UserOutlined class="text-xl" />
        <span class="text-xs mt-1">我的</span>
      </div>
    </div>
  </div>
</template>
