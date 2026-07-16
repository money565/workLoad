<script setup lang="ts">
import { useUserStore } from '@/stores/counter'
import { useRoute } from 'vue-router'
import {
  CameraOutlined,
  LoadingOutlined,
  SearchOutlined,
  ToolOutlined,
  SoundOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useUpload } from '@/composables/useUpload'
import { type WorkPlanItem } from '@/axios/interface'

const userStore = useUserStore()
const route = useRoute()
const { initCos, upload, generatePath, getUrl } = useUpload()

const loading = ref(true)
const userRank = ref(0)
const hasWorks = ref(false)
const viewMode = ref<'menu' | 'work' | 'manage' | 'inspect'>('work')
const inspectContent = ref<string[]>([])
const inspectLoading = ref(false)
const execRecords = ref<{ uploader_name: string; image: string; upload_time: string }[]>([])
const checkResults = ref<Record<number, 1 | 2>>({})
const failPhotos = ref<Record<number, { url: string; key: string }>>({})
const failPhotoUploading = ref<Record<number, boolean>>({})
const failRemarks = ref<Record<number, string>>({})
const submittingInspect = ref(false)
const inspected = ref(false)
const oldCheckResult = ref(0)
const oldRemarkArr = ref<{ std: string; pic: string; tip: string }[]>([])
const oldCheckImage = ref('')
const oldCheckerName = ref('')
const oldCheckTime = ref('')

async function handleFailPhoto(file: File, index: number) {
  failPhotoUploading.value[index] = true
  try {
    await initCos()
    const key = generatePath(`${Date.now()}.jpg`, 'workload/inspect')
    const url = await upload(file, key)
    failPhotos.value[index] = { url, key }
  } catch {
    message.error('上传失败')
  } finally {
    failPhotoUploading.value[index] = false
  }
}

async function submitInspection() {
  for (let i = 0; i < inspectContent.value.length; i++) {
    if (!checkResults.value[i]) {
      message.warning(`"${inspectContent.value[i]!.slice(0, 20)}..." 还未判定`)
      return
    }
  }
  const hasFail = Object.values(checkResults.value).some((v) => v === 2)
  if (hasFail) {
    for (let i = 0; i < inspectContent.value.length; i++) {
      if (checkResults.value[i] === 2 && !failPhotos.value[i]?.url) {
        message.warning(`"${inspectContent.value[i]!.slice(0, 15)}..." 未拍摄不合格照片`)
        return
      }
    }
  }
  if (!uploadImage.value) {
    message.warning('请先拍摄巡检照片')
    return
  }
  if (!hasFail && !uploadKey.value) {
    message.warning('请先拍摄巡检照片')
    return
  }
  submittingInspect.value = true
  try {
    const w = selectedWork.value!
    // 查找已有执行记录
    const execRes = await fetch(`/api/workLoad/executions/${w.project_id}`).then((r) => r.json())
    const existing =
      execRes.code === 200
        ? execRes.result.find(
            (e: { work_plan_id: number; id: number }) => e.work_plan_id === w.work_id,
          )
        : null
    // 构建 remark 数组
    const remarkArr = Object.entries(checkResults.value)
      .filter(([, v]) => v === 2)
      .map(([k]) => ({
        std: inspectContent.value[Number(k)] || '',
        pic: failPhotos.value[Number(k)]?.key || '',
        tip: failRemarks.value[Number(k)] || '',
      }))
    const body = JSON.stringify({
      check_result: hasFail ? 2 : 1,
      check_image: uploadKey.value,
      remark: JSON.stringify(remarkArr),
      checker_id: w.executor_id,
      check_time: new Date().toISOString().slice(0, 19),
    })
    if (existing) {
      // 更新已有记录
      const resp = await fetch(`/api/workLoad/execution/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const result = await resp.json()
      if (result.code === 200) {
        message.success('巡检完成')
        setTimeout(() => window.location.reload(), 1000)
      } else message.error(result.msg || '提交失败')
    } else {
      // 创建新记录
      const fullBody = JSON.stringify({
        ...JSON.parse(body),
        work_plan_id: w.work_id,
        executor_id: w.executor_id,
      })
      const resp = await fetch(`/api/workLoad/executions/${w.project_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fullBody,
      })
      const result = await resp.json()
      if (result.code === 200) {
        message.success('巡检完成')
        setTimeout(() => window.location.reload(), 1000)
      } else message.error(result.msg || '提交失败')
    }
  } catch {
    message.error('提交失败')
  } finally {
    submittingInspect.value = false
  }
}

async function enterInspect() {
  inspectLoading.value = true
  inspectContent.value = []
  execRecords.value = []
  checkResults.value = {}
  failPhotos.value = {}
  failRemarks.value = {}
  inspected.value = false
  oldRemarkArr.value = []
  const w = selectedWork.value
  if (!w) {
    viewMode.value = 'manage'
    return
  }
  try {
    const [stdRes, execRes] = await Promise.all([
      fetch(`/api/workLoad/standards/${w.project_id}`).then((r) => r.json()),
      fetch(`/api/workLoad/executions/${w.project_id}`).then((r) => r.json()),
    ])
    if (stdRes.code === 200) {
      const std = stdRes.result.find((s: { work_ids: number[]; content: string[] }) =>
        s.work_ids.includes(w.work_id),
      )
      if (std && std.content)
        inspectContent.value = Array.isArray(std.content) ? std.content : [std.content]
    }
    if (execRes.code === 200) {
      const records = execRes.result.filter(
        (e: {
          work_plan_id: number
          uploader_name: string
          image: string
          upload_time: string
          check_result: number
          checker_name: string
          check_image: string
          check_time: string | null
          remark: string
        }) => e.work_plan_id === w.work_id,
      )
      // 检查是否有执行人
      if (records.length > 0) {
        try {
          await initCos()
        } catch {
          /* ignore */
        }
        for (const r of records) {
          if (r.image && !r.image.startsWith('http')) {
            try {
              r.image = (await getUrl(r.image)) || r.image
            } catch {
              /* keep original */
            }
          }
        }
      }
      execRecords.value = records
      // 检查巡检状态
      const checked = records.find(
        (r: {
          check_result: number
          checker_name: string
          check_image: string
          check_time: string | null
          remark: string
        }) => r.check_result !== 0,
      )
      if (checked) {
        inspected.value = true
        oldCheckResult.value = checked.check_result
        oldCheckerName.value = checked.checker_name || ''
        oldCheckTime.value = checked.check_time || ''
        // 解析 remark
        try {
          oldRemarkArr.value = JSON.parse(checked.remark || '[]')
        } catch {
          oldRemarkArr.value = []
        }
        // 填充 checkResults
        for (let i = 0; i < inspectContent.value.length; i++) {
          const stdName = inspectContent.value[i]
          const found = oldRemarkArr.value.find(
            (r: { std: string; pic: string; tip: string }) => r.std === stdName,
          )
          if (found)
            checkResults.value[i] = 2 // 在不合格数组里
          else checkResults.value[i] = 1 // 合格
        }
        // 解析 oldCheckImage
        if (checked.check_image) {
          try {
            oldCheckImage.value = (await getUrl(checked.check_image)) || checked.check_image
          } catch {
            oldCheckImage.value = checked.check_image
          }
        }
        // 解析不合格照片 key 为 URL
        for (const r of oldRemarkArr.value) {
          if (r.pic && !r.pic.startsWith('http')) {
            try {
              r.pic = (await getUrl(r.pic)) || r.pic
            } catch {
              /* keep key */
            }
          }
        }
      }
    }
  } catch {
    /* ignore */
  } finally {
    inspectLoading.value = false
  }
  viewMode.value = 'inspect'
}

const allWorks = ref<ScanWorkItem[]>([])
const groupSiblings = ref<WorkPlanItem[]>([]) // 同 group_key 的所有项目工作
const workStandards = ref<{ id: number; name: string; content: string[]; work_ids: number[] }[]>([])
const errorMsg = ref('')
const showAll = ref(false)
const uploadImage = ref('')
const uploadKey = ref('')
const uploading = ref(false)
const submitting = ref(false)
const previewOpen = ref(false)
const wid = (route.query.wid as string) || ''
const gk = (route.query.group_key as string) || ''
const resolvedWid = ref('')
const noWorkInfo = ref<{ work_cycle: number; times: string[] } | null>(null)

// 同组工作（优先用 groupSiblings，兜底用 allWorks）
interface SiblingItem {
  wid: number
  work_cycle: number
  exec_time: number
  start_time: string | null
}
const siblingWorks = computed(() => {
  const gk = selectedWork.value?.group_key
  if (!gk) return [] as SiblingItem[]
  if (groupSiblings.value.length > 0) {
    return groupSiblings.value
      .filter((w) => w.group_key === gk)
      .map((w) => ({
        wid: w.id,
        work_cycle: w.work_cycle,
        exec_time: w.exec_time,
        start_time: w.start_time,
      }))
  }
  return allWorks.value
    .filter((w) => w.group_key === gk)
    .map((w) => ({
      wid: w.work_id,
      work_cycle: w.work_cycle,
      exec_time: w.exec_time,
      start_time: w.start_time,
    }))
})
function execLabel(w: {
  work_cycle: number
  exec_time: number
  start_time: string | null
}): string {
  if (w.work_cycle === 0) return w.start_time?.slice(0, 5) || '每天'
  if (w.work_cycle === 1)
    return (
      ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][w.exec_time] ||
      String(w.exec_time)
    )
  if (w.work_cycle === 2) return `${w.exec_time}日`
  return String(w.exec_time)
}
async function switchSibling(sw: SiblingItem) {
  const found = allWorks.value.find((a) => a.work_id === sw.wid)
  if (found) {
    resolvedWid.value = String(sw.wid)
    selectedWork.value = found
    await enterInspect()
  }
}

interface ScanWorkItem {
  work_id: number
  work_name: string
  price: number
  salary: number
  unit: string
  number: number
  start_time: string | null
  end_time: string | null
  work_cycle: number
  exec_time: number
  position_name: string
  project_name: string
  project_id: number
  executor_id: number
  executed: boolean
  msg: string | null
  group_key: string
}

async function init() {
  const loginRes = await userStore.login()
  const res = loginRes as { result: boolean } | undefined
  if (!res?.result || !userStore.userInfo.userid) {
    errorMsg.value = '登录失败'
    loading.value = false
    return
  }

  // 如果有 group_key，先查出具体 work_id
  if (gk && !wid) {
    try {
      const pickRes = await fetch(
        `/api/workLoad/pickWork?group_key=${gk}&userid=${userStore.userInfo.userid}`,
      ).then((r) => r.json())
      if (pickRes.code === 200) {
        if (pickRes.id) {
          resolvedWid.value = String(pickRes.id)
        } else if (pickRes.times) {
          noWorkInfo.value = { work_cycle: pickRes.work_cycle, times: pickRes.times }
        } else if (pickRes.msg) {
          errorMsg.value = pickRes.msg
        }
      }
    } catch {
      /* ignore */
    }
  }
  resolvedWid.value = resolvedWid.value || wid
  const effectiveWid = resolvedWid.value

  // 检查权限
  try {
    const perm = await fetch(`/api/workLoad/permission/${userStore.userInfo.userid}`).then((r) =>
      r.json(),
    )
    if (perm.code === 200) userRank.value = perm.rank || 0
  } catch {
    /* ignore */
  }

  // 检查是否有安排的工作
  try {
    const scanRes = await fetch(`/api/workLoad/mobileScan/${userStore.userInfo.userid}`).then((r) =>
      r.json(),
    )
    if (scanRes.code === 200 && scanRes.result.length > 0) {
      allWorks.value = scanRes.result
      hasWorks.value = true
      preloadSpeakCache(scanRes.result)
      // 获取工作标准 + 同组工作
      const pid = scanRes.result[0].project_id
      try {
        const [stdRes, planRes] = await Promise.all([
          fetch(`/api/workLoad/standards/${pid}`).then((r) => r.json()),
          fetch(`/api/workLoad/workPlans/${pid}`).then((r) => r.json()),
        ])
        if (stdRes.code === 200) workStandards.value = stdRes.result
        if (planRes.code === 200) groupSiblings.value = planRes.result
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  // 设置当前选中工作
  if (effectiveWid && allWorks.value.length > 0) {
    const found = allWorks.value.find((w) => w.work_id === Number(effectiveWid))
    if (found) selectedWork.value = found
    else if (!gk) selectedWork.value = allWorks.value.find((w) => !w.executed) || allWorks.value[0]!
  } else if (!gk && allWorks.value.length > 0) {
    selectedWork.value = allWorks.value.find((w) => !w.executed) || allWorks.value[0]!
  }

  if (userRank.value >= 1) {
    if (hasWorks.value) {
      viewMode.value = 'menu'
    } else {
      viewMode.value = 'manage'
    }
  } else {
    // 普通员工
    if (effectiveWid) {
      // pickWork 已鉴权，直接从 mobileScan 或 workPlans 加载
      const scanRes = await fetch(
        `/api/workLoad/mobileScan/${userStore.userInfo.userid}?wid=${effectiveWid}`,
      ).then((r) => r.json())
      if (scanRes.code === 200 && scanRes.result.length > 0) {
        selectedWork.value = scanRes.result[0]
      } else {
        // 抢单工作不在 mobileScan 中，从 workPlans 加载
        const pid = scanRes.result?.[0]?.project_id
        if (pid || scanRes.code === 200) {
          // 尝试获取 pid
          const anyRes = await fetch(`/api/workLoad/mobileScan/${userStore.userInfo.userid}`).then(
            (r) => r.json(),
          )
          const projectId =
            anyRes.code === 200 && anyRes.result.length > 0 ? anyRes.result[0].project_id : 0
          if (projectId) {
            const planRes = await fetch(`/api/workLoad/workPlans/${projectId}`).then((r) =>
              r.json(),
            )
            if (planRes.code === 200) {
              const plan = planRes.result.find((p: WorkPlanItem) => p.id === Number(effectiveWid))
              if (plan) {
                selectedWork.value = {
                  work_id: plan.id,
                  work_name: plan.work_name,
                  price: plan.price,
                  salary: plan.salary,
                  unit: plan.unit,
                  number: plan.number,
                  start_time: plan.start_time,
                  end_time: plan.end_time,
                  work_cycle: plan.work_cycle,
                  exec_time: plan.exec_time,
                  position_name: '抢单',
                  project_name: '',
                  project_id: projectId,
                  executor_id: 0,
                  executed: false,
                  msg: null,
                  group_key: plan.group_key,
                }
              }
            }
          }
        }
      }
    } else if (gk) {
      // gk 存在但 pickWork 没返回 id（无匹配时段）
      // noWorkInfo 已设置，前端显示时间槽
    } else {
      await loadAllWorks()
    }
  }
  loading.value = false
}

async function loadAllWorks() {
  try {
    const uid = userStore.userInfo.userid
    const res = await fetch(`/api/workLoad/mobileScan/${uid}`).then((r) => r.json())
    if (res.code === 200) {
      allWorks.value = res.result
      hasWorks.value = res.result.length > 0
      preloadSpeakCache(res.result)
    } else errorMsg.value = res.msg
  } catch {
    errorMsg.value = '请求失败'
  }
}

async function handlePhoto(file: File) {
  uploading.value = true
  try {
    await initCos()
    const key = generatePath(`${Date.now()}.jpg`, 'workload/photo')
    const url = await upload(file, key)
    uploadImage.value = url
    uploadKey.value = key
    previewOpen.value = true
    message.success('拍照成功')
  } catch {
    message.error('上传失败')
  } finally {
    uploading.value = false
  }
}

async function submitExecution() {
  if (!selectedWork.value! || !uploadImage.value) {
    message.warning('请先拍照')
    return
  }
  const pid = selectedWork.value!.project_id
  if (!pid) {
    message.error('无法获取项目ID')
    return
  }
  submitting.value = true
  try {
    const body = JSON.stringify({
      work_plan_id: selectedWork.value!.work_id,
      executor_id: selectedWork.value!.executor_id,
      uploader_id: selectedWork.value!.executor_id,
      image: uploadKey.value,
    })
    const resp = await fetch(`/api/workLoad/executions/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const result = await resp.json()
    if (result.code === 200) {
      previewOpen.value = false
      message.success('提交成功')
      setTimeout(() => window.location.reload(), 1000)
    } else message.error(result.msg || '提交失败')
  } catch {
    message.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const speakCache = new Map<number, string>() // work_id -> dataUrl
const SPEAK_CACHE_KEY = 'speak_cache_v1'

function loadSpeakCache() {
  try {
    const raw = localStorage.getItem(SPEAK_CACHE_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>
      for (const [k, v] of Object.entries(obj)) speakCache.set(Number(k), v)
    }
  } catch {
    /* ignore */
  }
}
loadSpeakCache()

function saveSpeakCache() {
  const obj: Record<string, string> = {}
  for (const [k, v] of speakCache.entries()) obj[k] = v
  try {
    localStorage.setItem(SPEAK_CACHE_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

async function preloadSpeakCache(works: ScanWorkItem[]) {
  for (const w of works) {
    if (speakCache.has(w.work_id)) continue
    const time = w.start_time?.slice(0, 5) || ''
    const text = `${time}做${w.work_name}`
    try {
      const resp = await fetch(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      await new Promise<void>((resolve) => {
        reader.onloadend = () => resolve()
      })
      speakCache.set(w.work_id, reader.result as string)
      saveSpeakCache()
    } catch {
      /* ignore */
    }
  }
}

function speakOnce(text: string) {
  const audio = new Audio(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
  audio.volume = 1
  audio.play().catch(() => {})
}

function speakWorkBrief(w: ScanWorkItem) {
  const dataUrl = speakCache.get(w.work_id)
  if (!dataUrl) return
  const audio = new Audio(dataUrl)
  audio.volume = 1
  audio.play().catch(() => {})
}

function speakWorkTitle(w: ScanWorkItem | (ScanWorkItem & { group_key?: string })) {
  const time = w.start_time?.slice(0, 5) || ''
  const end = w.end_time?.slice(0, 5) || ''
  let text = `${w.work_name}，单价${w.price}元，${w.unit}${w.number}个，${time}到${end}`
  const stds = workStandards.value.filter((s) => s.work_ids?.includes(w.work_id))
  if (stds.length > 0) {
    text += '，标准：'
    for (const s of stds) {
      text += `${s.name}`
      if (s.content.length > 0) text += s.content.join('，')
    }
  }
  if (!w.executed) text += '，请按绿色按钮拍摄工作过程中的照片'
  const audio = new Audio(`/api/workLoad/tts?text=${encodeURIComponent(text)}`)
  audio.volume = 1
  audio.play().catch(() => {})
}

const selectedWork = ref<ScanWorkItem | null>(null)
const currentWorkStandards = computed(() =>
  workStandards.value.filter(
    (s) => selectedWork.value && s.work_ids?.includes(selectedWork.value.work_id),
  ),
)

async function enterWork() {
  viewMode.value = 'work'
  if (allWorks.value.length === 0) await loadAllWorks()
  // 选中第一个未执行的工作，如果有 wid 则优先选对应工作
  const list = allWorks.value
  const ew = resolvedWid.value || wid
  selectedWork.value = ew
    ? list.find((w) => w.work_id === Number(ew)) || null
    : gk
      ? list[0] || null
      : list.find((w) => !w.executed) || list[0] || null
}

watch(showAll, async (v) => {
  if (v && allWorks.value.length === 0) await loadAllWorks()
})
onMounted(init)

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAYS = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-4">
    <a-spin :spinning="loading" tip="加载中...">
      <div v-if="errorMsg && viewMode === 'work'" class="text-center py-16">
        <a-result status="warning">
          <template #title>
            {{ errorMsg }}
            <span
              class="inline-flex w-10 h-10 rounded-full bg-blue-500 flex-center cursor-pointer shadow-lg align-middle ml-2"
              @click.stop="speakOnce(errorMsg)"
            >
              <SoundOutlined class="text-white text-lg" />
            </span>
          </template>
        </a-result>
      </div>
      <div v-else-if="viewMode === 'work' && !selectedWork" class="text-center py-16">
        <a-result status="info" title="当前时间暂无工作" sub-title="或当前用户不是该工作的执行者" />
        <div v-if="noWorkInfo" class="mt-4 text-sm text-gray-500">
          <template v-if="noWorkInfo.work_cycle === 0"
            >可选时间段: {{ noWorkInfo.times.join(', ') }}</template
          >
          <template v-else-if="noWorkInfo.work_cycle === 1"
            >可选星期:
            {{
              noWorkInfo.times
                .map(
                  (t) =>
                    ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][Number(t)] || t,
                )
                .join(', ')
            }}</template
          >
          <template v-else-if="noWorkInfo.work_cycle === 2"
            >可选日期: {{ noWorkInfo.times.map((t) => t + '日').join(', ') }}</template
          >
        </div>
      </div>

      <!-- === 管理菜单 === -->
      <template v-if="viewMode === 'menu'">
        <a-card class="mb-4">
          <div class="flex items-center gap-3">
            <a-avatar :src="userStore.userInfo.avatar" :size="48" />
            <div>
              <div class="text-lg font-bold">{{ userStore.userInfo.username }}</div>
              <a-tag color="blue">{{ userRank }}级管理员</a-tag>
            </div>
          </div>
        </a-card>
        <div v-if="selectedWork && (resolvedWid || wid || gk)" class="mb-4">
          <a-card size="small">
            <div class="text-sm font-bold mb-2">当前工作</div>
            <div class="text-base font-bold">{{ selectedWork.work_name }}</div>
            <div class="text-xs text-gray-400 mt-1">
              {{ selectedWork.position_name }} · {{ selectedWork.project_name }}
            </div>
            <div class="mt-2 flex gap-2 text-xs flex-wrap">
              <span
                >¥{{ selectedWork.price }} / {{ selectedWork.unit }} ×
                {{ selectedWork.number }}</span
              >
            </div>
            <div class="text-xs text-gray-400 mt-1">
              {{ selectedWork.start_time?.slice(0, 5) || '—' }}~{{
                selectedWork.end_time?.slice(0, 5) || '—'
              }}
            </div>
            <div class="text-xs text-gray-400">
              周期: {{ WORK_CYCLE_MAP[selectedWork.work_cycle] || selectedWork.work_cycle }}
              <template v-if="selectedWork.work_cycle === 2">
                · {{ selectedWork.exec_time }}日</template
              >
              <template v-else-if="selectedWork.work_cycle === 1">
                · {{ WEEKDAYS[selectedWork.exec_time] }}</template
              >
            </div>
            <a-tag :color="selectedWork.executed ? 'success' : 'processing'" class="mt-1">{{
              selectedWork.executed ? '已完成' : '待执行'
            }}</a-tag>
          </a-card>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <a-card hoverable class="text-center cursor-pointer" @click="enterWork">
            <ToolOutlined class="text-4xl text-blue-500 mb-2" />
            <div class="text-lg font-bold">我的工作</div>
          </a-card>
          <a-card hoverable class="text-center cursor-pointer" @click="enterInspect">
            <SearchOutlined class="text-4xl text-green-500 mb-2" />
            <div class="text-lg font-bold">巡检</div>
          </a-card>
        </div>
      </template>

      <!-- === 工作详情（原有逻辑）=== -->
      <!-- 工作拍照 -->
      <template v-if="viewMode === 'work' && selectedWork">
        <a-card class="mb-4">
          <div class="flex items-center gap-3">
            <a-avatar :src="userStore.userInfo.avatar" :size="48" />
            <div>
              <div class="text-lg font-bold">{{ userStore.userInfo.username }}</div>
              <div class="text-sm text-gray-500">{{ userStore.userInfo.position }}</div>
            </div>
          </div>
        </a-card>
        <a-card v-if="selectedWork.executed" class="mb-4 border-orange-400 relative">
          <a-result status="warning" :title="selectedWork.msg || '该工作已执行'" />
          <div class="text-sm text-gray-600 px-4 pb-4">
            <div class="font-bold">{{ selectedWork.work_name }}</div>
            <div>{{ selectedWork.position_name }} · {{ selectedWork.project_name }}</div>
            <div class="mt-1">
              ¥{{ selectedWork.price }} / {{ selectedWork.unit }} × {{ selectedWork.number }}
            </div>
          </div>
          <div
            class="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-blue-500 flex-center cursor-pointer shadow-lg"
            @click.stop="
              speakOnce(
                (selectedWork.msg || selectedWork.work_name + '已完成').replace(
                  '该工作已经于',
                  selectedWork.work_name + '已于',
                ),
              )
            "
          >
            <SoundOutlined class="text-white text-xl" />
          </div>
        </a-card>
        <a-card v-if="!selectedWork.executed">
          <div class="text-xl font-bold text-center mb-2">
            {{ selectedWork.work_name }}
            <SoundOutlined
              class="text-blue-400 cursor-pointer align-middle"
              @click.stop="speakWorkTitle(selectedWork!)"
            />
          </div>
          <div class="text-sm text-gray-400 text-center mb-4">
            {{ selectedWork.position_name }} · {{ selectedWork.project_name }}
          </div>
          <div class="flex justify-center gap-4 text-sm mb-3">
            <span
              >单价: <strong>¥{{ selectedWork.price }}</strong></span
            >
            <span>{{ selectedWork.unit }} × {{ selectedWork.number }}</span>
          </div>
          <div class="text-center text-sm text-gray-500">
            {{ selectedWork.start_time?.slice(0, 5) || '—' }} ~
            {{ selectedWork.end_time?.slice(0, 5) || '—' }}
          </div>
          <div v-if="selectedWork.work_cycle === 2" class="text-center text-sm text-gray-500">
            每月{{ selectedWork.exec_time }}日
          </div>
          <div v-else-if="selectedWork.work_cycle === 1" class="text-center text-sm text-gray-500">
            每{{ WEEKDAYS[selectedWork.exec_time] }}
          </div>
          <div class="mt-3 px-2">
            <div class="text-sm font-bold mb-1">工作标准</div>
            <template v-if="currentWorkStandards.length > 0">
              <div
                v-for="s in currentWorkStandards"
                :key="s.id"
                class="mb-2 border rounded p-2 text-xs"
              >
                <div class="font-bold text-blue-500 mb-1">{{ s.name }}</div>
                <div v-for="(c, i) in s.content" :key="i">{{ i + 1 }}. {{ c }}</div>
              </div>
            </template>
            <div v-else class="text-xs text-gray-400">暂无标准</div>
          </div>
          <div class="mt-4">
            <label
              class="flex flex-col items-center gap-1 py-3"
              :class="{ 'pointer-events-none': uploading }"
            >
              <div
                class="w-14 h-14 rounded-full flex-center text-white text-2xl"
                style="
                  background: linear-gradient(135deg, #52c41a, #73d13d);
                  box-shadow: 0 4px 12px rgba(82, 196, 26, 0.4);
                "
              >
                <LoadingOutlined v-if="uploading" /><CameraOutlined v-else />
              </div>
              <span class="text-sm text-gray-600">{{ uploading ? '上传中...' : '工作拍照' }}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                :disabled="uploading"
                @change="
                  (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) handlePhoto(f)
                  }
                "
              />
            </label>
          </div>
        </a-card>

        <!-- 拍照预览弹窗 -->
        <a-modal
          v-model:open="previewOpen"
          title="工作照片"
          :footer="null"
          width="90%"
          @cancel="previewOpen = false; uploadImage = ''; uploadKey = ''"
        >
          <img :src="uploadImage" class="w-full rounded mb-4" />
          <a-button type="primary" block size="large" :loading="submitting" @click="submitExecution"
            >提交工作记录</a-button
          >
        </a-modal>
      </template>

      <!-- === 巡检页 === -->
      <template v-if="viewMode === 'inspect'">
        <a-card v-if="selectedWork" class="mb-4">
          <div class="font-bold">
            {{ selectedWork.work_name }}
            <SoundOutlined
              class="text-blue-400 cursor-pointer"
              @click.stop="speakWorkTitle(selectedWork!)"
            />
          </div>
          <div class="text-xs text-gray-400">
            {{ selectedWork.position_name }} · {{ selectedWork.project_name }}
          </div>
        </a-card>

        <!-- 同组工作Tab切换 -->
        <div v-if="siblingWorks.length > 1" class="flex gap-1 mb-3 flex-wrap">
          <a-button
            v-for="sw in siblingWorks"
            :key="sw.wid"
            size="small"
            :type="selectedWork!.work_id === sw.wid ? 'primary' : 'default'"
            @click="switchSibling(sw)"
            >{{ execLabel(sw) }}</a-button
          >
        </div>

        <!-- 已巡检结果（只读） -->
        <template v-if="inspected">
          <a-card title="巡检结果" class="mb-4">
            <a-tag :color="oldCheckResult === 1 ? 'green' : 'red'">{{
              oldCheckResult === 1 ? '合格' : '不合格'
            }}</a-tag>
            <span class="text-xs text-gray-400 ml-2"
              >检查人: {{ oldCheckerName }} |
              {{ oldCheckTime?.slice(0, 16).replace('T', ' ') }}</span
            >
          </a-card>
          <a-card title="工作标准" class="mb-4">
            <div
              v-for="(item, i) in inspectContent"
              :key="i"
              class="flex gap-2 border-b pb-2 last:border-0 items-start"
            >
              <span class="text-blue-500 font-bold shrink-0">{{ i + 1 }}.</span>
              <span class="text-sm flex-1">{{ item }}</span>
              <a-tag :color="checkResults[i] === 1 ? 'green' : 'red'" class="shrink-0">{{
                checkResults[i] === 1 ? '合格' : '不合格'
              }}</a-tag>
            </div>
          </a-card>
          <a-card title="巡检照片" class="mb-4">
            <a-image v-if="oldCheckImage" :src="oldCheckImage" :width="120" />
            <span v-else class="text-gray-400">无</span>
          </a-card>
          <div v-if="oldRemarkArr.length > 0" class="mb-4">
            <a-card
              v-for="(r, i) in oldRemarkArr"
              :key="i"
              :title="r.std"
              class="mb-2"
              size="small"
            >
              <div class="text-xs text-red-500 font-bold mb-1">不合格</div>
              <a-image v-if="r.pic" :src="r.pic" :width="100" class="mb-1" />
              <div class="text-sm">{{ r.tip || '无说明' }}</div>
            </a-card>
          </div>
        </template>

        <!-- 正常巡检表单 -->
        <template v-if="!inspected && execRecords.length > 0">
          <a-card title="执行记录">
            <div v-if="execRecords.length === 0" class="text-gray-400">暂无执行记录</div>
            <div v-for="(r, i) in execRecords" :key="i" class="mb-3 border-b pb-3 last:border-0">
              <div class="text-sm">
                执行人: <a-tag>{{ r.uploader_name }}</a-tag>
              </div>
              <div class="text-xs text-gray-400">
                {{ r.upload_time?.slice(0, 16).replace('T', ' ') }}
              </div>
              <a-image v-if="r.image" :src="r.image" :width="120" class="mt-2" />
            </div>
          </a-card>
          <a-card title="工作标准" class="mb-4">
            <a-spin :spinning="inspectLoading">
              <div v-if="inspectContent.length === 0" class="text-gray-400">没有标准</div>
              <div v-else class="flex flex-col gap-2">
                <div
                  v-for="(item, i) in inspectContent"
                  :key="i"
                  class="flex gap-2 border-b pb-2 last:border-0 items-start"
                >
                  <span class="text-blue-500 font-bold shrink-0">{{ i + 1 }}.</span>
                  <span class="text-sm flex-1">{{ item }}</span>
                  <a-radio-group v-model:value="checkResults[i]" size="small" class="shrink-0">
                    <a-radio-button :value="1" class="text-xs">合格</a-radio-button>
                    <a-radio-button :value="2" class="text-xs">不合格</a-radio-button>
                  </a-radio-group>
                </div>
              </div>
            </a-spin>
          </a-card>
          <a-card title="巡检照片">
            <label
              class="flex flex-col items-center gap-1 py-3"
              :class="{ 'pointer-events-none': uploading }"
            >
              <div
                class="w-14 h-14 rounded-full flex-center text-white text-2xl"
                style="
                  background: linear-gradient(135deg, #52c41a, #73d13d);
                  box-shadow: 0 4px 12px rgba(82, 196, 26, 0.4);
                "
              >
                <LoadingOutlined v-if="uploading" /><CameraOutlined v-else />
              </div>
              <span class="text-sm text-gray-600">{{ uploading ? '上传中...' : '巡检拍照' }}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                :disabled="uploading"
                @change="
                  (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) handlePhoto(f)
                  }
                "
              />
            </label>
            <img v-if="uploadImage" :src="uploadImage" class="mt-3 w-full rounded" />

            <!-- 不合格照片 -->
            <div v-if="Object.values(checkResults).some((v) => v === 2)" class="mt-4 pt-4 border-t">
              <div class="text-sm font-bold mb-2 text-red-500">不合格项需拍照说明</div>
              <div v-for="(item, i) in inspectContent" :key="'fail' + i">
                <div v-if="checkResults[i] === 2" class="mb-3 border border-red-200 rounded p-3">
                  <div class="text-xs text-red-500 font-bold mb-2">{{ i + 1 }}. {{ item }}</div>
                  <label
                    class="flex flex-col items-center gap-1 py-1"
                    :class="{ 'pointer-events-none': !!failPhotoUploading[i] }"
                  >
                    <div
                      class="w-10 h-10 rounded-full flex-center text-white text-lg"
                      style="
                        background: linear-gradient(135deg, #ff4d4f, #ff7875);
                        box-shadow: 0 2px 8px rgba(255, 77, 79, 0.4);
                      "
                    >
                      <LoadingOutlined v-if="failPhotoUploading[i]" /><CameraOutlined v-else />
                    </div>
                    <span class="text-xs text-gray-600">{{
                      failPhotoUploading[i] ? '上传中...' : '拍照说明'
                    }}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      class="hidden"
                      :disabled="!!failPhotoUploading[i]"
                      @change="
                        (e) => {
                          const f = (e.target as HTMLInputElement).files?.[0]
                          if (f) handleFailPhoto(f, i)
                        }
                      "
                    />
                  </label>
                  <img
                    v-if="failPhotos[i]?.url"
                    :src="failPhotos[i]!.url"
                    class="mt-2 w-full rounded"
                  />
                  <a-textarea
                    v-if="failPhotos[i]?.url"
                    v-model:value="failRemarks[i]"
                    placeholder="请说明不合格原因"
                    :rows="2"
                    class="mt-2"
                  />
                </div>
              </div>
            </div>
          </a-card>

          <a-button
            type="primary"
            block
            size="large"
            class="mt-4"
            :loading="submittingInspect"
            @click="submitInspection"
            >完成巡检</a-button
          >
        </template>
        <a-card v-if="!inspected && execRecords.length === 0" class="mt-4">
          <a-empty description="该工作还未完成" />
        </a-card>
      </template>

      <!-- === 管理页 === -->
      <template v-if="viewMode === 'manage'">
        <a-card class="mb-4">
          <div class="flex items-center gap-3">
            <a-avatar :src="userStore.userInfo.avatar" :size="48" />
            <div>
              <div class="text-lg font-bold">{{ userStore.userInfo.username }}</div>
              <a-tag color="blue">{{ userRank }}级管理员</a-tag>
            </div>
          </div>
        </a-card>
        <a-card>
          <a-empty description="巡检功能待开发" />
        </a-card>
      </template>

      <div class="mt-4 px-4">
        <a-button type="primary" block size="large" @click="$router.push('/mobile/employee')"
          >查看我的所有工作</a-button
        >
      </div>
      <a-modal
        v-model:open="showAll"
        title="我的所有工作"
        :footer="null"
        width="90%"
        :body-style="{ maxHeight: '70vh', overflowY: 'auto' }"
      >
        <a-card
          v-for="w in allWorks"
          :key="w.work_id"
          class="mb-3 relative"
          :class="{ 'border-green-400': w.executed }"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-bold text-sm">{{ w.work_name }}</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ w.position_name }} · {{ w.project_name }}
              </div>
              <div class="mt-1 flex gap-2 text-xs flex-wrap">
                <a-tag
                  :color="w.work_cycle === 0 ? 'blue' : w.work_cycle === 1 ? 'green' : 'orange'"
                  >{{ WORK_CYCLE_MAP[w.work_cycle] }}</a-tag
                >
                <template v-if="w.work_cycle === 2"> · {{ w.exec_time }}日</template>
                <template v-else-if="w.work_cycle === 1"> · {{ WEEKDAYS[w.exec_time] }}</template>
                <span>¥{{ w.price }} / {{ w.unit }}×{{ w.number }}</span>
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ w.start_time?.slice(0, 5) || '—' }} ~ {{ w.end_time?.slice(0, 5) || '—' }}
              </div>
              <div v-if="w.executed && w.msg" class="text-xs text-gray-400 mt-1">{{ w.msg }}</div>
            </div>
            <a-tag v-if="w.executed" color="success" size="small">已完成</a-tag>
            <a-tag v-else color="processing" size="small">待执行</a-tag>
          </div>
          <SoundOutlined
            class="absolute right-2 bottom-2 text-blue-400 text-xl cursor-pointer"
            @click.stop="speakWorkBrief(w)"
          />
        </a-card>
      </a-modal>
    </a-spin>
  </div>
</template>
