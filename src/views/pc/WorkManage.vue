<script setup lang="ts">
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { PlusOutlined, EditOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons-vue'
import {
  getWorkPlans,
  createWorkPlan,
  updateWorkPlan,
  deleteWorkPlan,
  type WorkPlanItem,
  type WorkPlanCreateParams,
} from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<WorkPlanItem[]>([])
const selectedRowKeys = ref<(string | number)[]>([])
const qrOpen = ref(false)
const qrItems = computed(() =>
  dataSource.value
    .filter((w) => selectedRowKeys.value.includes(w.id))
    .map((w) => ({ group_key: w.group_key, name: w.work_name })),
)
// 标准关联
const standards = ref<{ id: number; name: string; work_ids: number[] }[]>([])
const standardLinkOpen = ref(false)
const linkWorkId = ref<number | null>(null)
const linkFormIds = ref<number[]>([])
const standardMap = computed(() => {
  const m: Record<number, { ids: number[]; names: string[] }> = {}
  for (const s of standards.value) {
    for (const wid of s.work_ids) {
      if (!m[wid]) m[wid] = { ids: [], names: [] }
      m[wid].ids.push(s.id)
      m[wid].names.push(s.name)
    }
  }
  return m
})
const modalOpen = ref(false)
const modalTitle = ref('创建工作')
const formRef = ref()
const editId = ref<number | null>(null)
const endTimeInvalid = ref(false)
const timeListOpen = ref(false)
const timeList = ref<(string | number | undefined)[]>([])
const formProjectId = ref<number>(-1)

function openTimeList() {
  const feq = Number(localFeq.value)
  const current = [...timeList.value]
  // 每月/每周的值转数字，每天保留字符串
  while (current.length < feq) current.push(undefined)
  current.length = feq
  // 确保值和控件类型匹配
  for (let i = 0; i < current.length; i++) {
    const v = current[i]
    if (v != null && form.work_cycle !== 0) current[i] = Number(v)
  }
  timeList.value = current
  timeListOpen.value = true
}

const localFeq = ref('')

function onFeqChange() {
  if (Number(localFeq.value) > 1) {
    form.exec_time = -2
  } else {
    form.exec_time = form.work_cycle === 0 ? -1 : 1
  }
}

function validateTimes() {
  endTimeInvalid.value = !!(form.start_time && form.end_time && form.end_time < form.start_time)
}

function handleTimeListOk() {
  if (validateTimeList()) timeListOpen.value = false
}

function validateTimeList(): boolean {
  if (Number(localFeq.value) <= 1) return true
  if (timeList.value.length === 0) { message.warning('请配置工作时间'); return false }
  const emptyIdx = timeList.value.findIndex(v => v == null || v === '')
  if (emptyIdx >= 0) { message.warning(`第 ${emptyIdx + 1} 个时间未配置，请完成所有时间配置`); return false }
  return true
}

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
const STATUS_MAP: Record<number, string> = { 0: '正常', 1: '停用' }

const form = reactive<WorkPlanCreateParams>({
  work_name: '',
  price: 0,
  salary: 0,
  unit: '',
  number: 0,
  start_time: undefined,
  end_time: undefined,
  work_cycle: 0,
  exec_time: -1,
  status: 0,
})

// 切换工作周期时重置执行时间
watch(
  () => form.work_cycle,
  (v) => {
    if (v === 0) form.exec_time = -1
    else form.exec_time = 1
  },
)

watch([() => form.salary, () => form.number], () => {
  const s = Number(form.salary)
  const n = Number(form.number)
  if (s > 0 && n > 0) {
    form.price = +(s / n).toFixed(4)
  } else {
    form.price = 0
  }
})

// 切换工作周期时重置执行时间
watch(
  () => form.work_cycle,
  (v) => {
    if (v === 0) form.exec_time = -1
    else form.exec_time = 1
  },
)

const columns = [
  { title: '工作名称', dataIndex: 'work_name', key: 'work_name', width: 150 },
  { title: '工资', dataIndex: 'salary', key: 'salary', width: 80 },
  { title: '单价', dataIndex: 'price', key: 'price', width: 80 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
  { title: '数量', dataIndex: 'number', key: 'number', width: 60 },
  { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 80 },
  { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 80 },
  { title: '周期', dataIndex: 'work_cycle', key: 'work_cycle', width: 60 },
  { title: '频次', key: 'freq', width: 50 },
  { title: '执行时间', dataIndex: 'exec_time', key: 'exec_time', width: 70 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 60 },
  { title: '关联标准', key: 'standards', width: 100 },
  { title: '操作', key: 'action', width: 180 },
]

// 保存原始数据（未分组），供编辑时查找同组工作
const rawWorks = ref<WorkPlanItem[]>([])

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [planRes, stdRes] = await Promise.all([
      getWorkPlans(appCache.currentProject),
      fetch(`/api/workLoad/standards/${appCache.currentProject}`).then((r) => r.json()),
    ])
    if (planRes.code === 200) {
      rawWorks.value = planRes.result.sort((a, b) => a.id - b.id)
      // 按 group_key 分组：相同 group_key 的工作合并为一条
      const groupMap = new Map<string, WorkPlanItem[]>()
      const singles: WorkPlanItem[] = []
      for (const w of rawWorks.value) {
        if (w.group_key) {
          if (!groupMap.has(w.group_key)) groupMap.set(w.group_key, [])
          groupMap.get(w.group_key)!.push(w)
        } else {
          singles.push(w)
        }
      }
      // 每组取第一条，exec_time 收集同组所有值
      const grouped: WorkPlanItem[] = []
      for (const [, items] of groupMap) {
        const first = { ...items[0]! }
        first.exec_time = (first.work_cycle === 0
          ? items.map(i => i.start_time?.slice(0, 5) || '—')
          : items.map(i => i.exec_time)) as unknown as number
        grouped.push(first)
      }
      dataSource.value = [...grouped, ...singles].sort((a, b) => a.id - b.id)
    }
    if (stdRes.code === 200) {
      standards.value = stdRes.result
    }
  } catch {
    console.warn('获取工作计划失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editId.value = null
  groupWorks.value = []
  endTimeInvalid.value = false
  formProjectId.value = appCache.currentProject
  modalTitle.value = '创建工作'
  Object.assign(form, {
    work_name: '',
    price: 0,
    salary: 0,
    unit: '',
    number: 0,
    start_time: dayjs('07:00', 'HH:mm'),
    end_time: dayjs('18:00', 'HH:mm'),
    work_cycle: 0,
    exec_time: -1,
    status: 0,
  })
  timeList.value = []
  localFeq.value = ''
  modalOpen.value = true
}

const groupWorks = ref<WorkPlanItem[]>([])
const activeGroupIdx = ref(0)

function execTimeLabel(w: WorkPlanItem): string {
  if (w.work_cycle === 0) return w.start_time?.slice(0, 5) || '每天'
  if (w.work_cycle === 1) return WEEKDAY_MAP[w.exec_time] || String(w.exec_time)
  if (w.work_cycle === 2) return `${w.exec_time}日`
  return String(w.exec_time)
}

function openEdit(r: WorkPlanItem) {
  const key = r.group_key
  if (key) {
    // 查找同组所有工作
    groupWorks.value = rawWorks.value.filter(w => w.group_key === key)
    activeGroupIdx.value = 0
  } else {
    groupWorks.value = []
  }
  loadEditForm(r)
}

function loadEditForm(r: WorkPlanItem) {
  editId.value = r.id
  formProjectId.value = appCache.currentProject
  modalTitle.value = '编辑工作'
  Object.assign(form, {
    work_name: r.work_name,
    price: r.price,
    salary: r.salary,
    unit: r.unit,
    number: r.number,
    start_time: r.start_time ? dayjs(r.start_time, 'HH:mm') : undefined,
    end_time: r.end_time ? dayjs(r.end_time, 'HH:mm') : undefined,
    work_cycle: r.work_cycle,
    exec_time: r.work_cycle === 0 ? -1 : (Array.isArray(r.exec_time) ? r.exec_time[0] : r.exec_time),
    status: r.status,
  })
  timeList.value = []
  modalOpen.value = true
}

function switchGroupTab(idx: number) {
  if (groupWorks.value[idx]) {
    activeGroupIdx.value = idx
    loadEditForm(groupWorks.value[idx]!)
  }
}

const submitting = ref(false)

async function handleSubmit() {
  if (formProjectId.value === -1) return
  if (endTimeInvalid.value) {
    message.warning('结束时间不能小于开始时间')
    return
  }
  if (!validateTimeList()) return
  submitting.value = true
  try {
    const toTimeStr = (v: unknown) => {
      if (!v) return ''
      if (typeof v === 'string') return v
      if (typeof v === 'object' && 'format' in v)
        return (v as { format: (f: string) => string }).format('HH:mm')
      return ''
    }
    const basePayload = {
      work_name: form.work_name,
      price: Number(form.price),
      salary: Number(form.salary),
      unit: form.unit,
      number: Number(form.number),
      work_cycle: form.work_cycle,
      status: form.status,
      start_time: toTimeStr(form.start_time),
      end_time: toTimeStr(form.end_time),
      project_id: formProjectId.value,
    }

    if (editId.value) {
      await updateWorkPlan(editId.value, {
        ...basePayload,
        exec_time: form.exec_time,
      })
    } else if (Number(localFeq.value) > 1) {
      // 新建 + 频次>1：每个配置时间创建一个工作，共享同一个 group_key
      const times = timeList.value.filter((v) => v != null && v !== '')
      const groupKey = Array.from({ length: 10 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
      ).join('')
      for (const t of times) {
        const payload: WorkPlanCreateParams = { ...basePayload, group_key: groupKey }
        if (form.work_cycle === 1) {
          payload.exec_time = Number(t)
        } else if (form.work_cycle === 2) {
          payload.exec_time = Number(t)
        } else {
          payload.exec_time = -1
          payload.start_time = String(t)
        }
        await createWorkPlan(formProjectId.value, payload)
      }
      message.success(`已创建 ${times.length} 个工作`)
    } else {
      await createWorkPlan(formProjectId.value, {
        ...basePayload,
        exec_time: form.exec_time,
      })
    }
    modalOpen.value = false
    fetchData()
  } catch (e) {
    console.error('保存失败', e)
    message.error('保存失败')
  } finally {
    submitting.value = false
  }
}

const toggleTargetOpen = ref(false)
const toggleTargets = ref<WorkPlanItem[]>([])
const selectedToggleId = ref<number>(0)

function handleToggleStatus(record: WorkPlanItem) {
  const execTimes = record.exec_time as number | number[]
  if (Array.isArray(execTimes) && execTimes.length > 1 && record.group_key) {
    // 同组多个工作，弹窗选择
    toggleTargets.value = rawWorks.value.filter(w => w.group_key === record.group_key)
    selectedToggleId.value = toggleTargets.value[0]?.id || 0
    toggleTargetOpen.value = true
  } else {
    doToggleStatus(record.id, record.status)
  }
}

async function doToggleStatus(id: number, status: number) {
  try {
    await updateWorkPlan(id, { status: status === 0 ? 1 : 0 } as WorkPlanCreateParams)
    fetchData()
  } catch {
    console.warn('操作失败')
  }
}

async function confirmToggle() {
  if (!selectedToggleId.value) return
  const target = toggleTargets.value.find(w => w.id === selectedToggleId.value)
  if (target) {
    await doToggleStatus(target.id, target.status)
  }
  toggleTargetOpen.value = false
}

function openStandardLink(wid: number) {
  linkWorkId.value = wid
  linkFormIds.value = standardMap.value[wid]?.ids || []
  standardLinkOpen.value = true
}

async function saveStandardLink() {
  if (linkWorkId.value === null) return
  try {
    await fetch(`/api/workLoad/workPlan/${linkWorkId.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standard_ids: linkFormIds.value }),
    })
    standardLinkOpen.value = false
    fetchData()
  } catch {
    message.error('保存失败')
  }
}

async function handleDelete(id: number) {
  try {
    await deleteWorkPlan(id)
    fetchData()
  } catch {
    console.warn('删除失败')
  }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header
      class="shrink-0"
      title="工作管理"
      :sub-title="appCache.currentProjectName"
      @back="() => $router.back()"
    >
      <template #extra>
        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          创建工作
        </a-button>
        <a-button v-if="selectedRowKeys.length > 1" @click="qrOpen = true">
          <template #icon><QrcodeOutlined /></template>
          导出二维码
        </a-button>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :row-selection="{
          selectedRowKeys,
          onChange: (keys: (string | number)[]) => {
            selectedRowKeys = keys
          },
        }"
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :scroll="{ y: 'calc(100vh - 320px)' }"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'work_cycle'">
            <a-tag
              :color="record.work_cycle === 0 ? 'blue' : record.work_cycle === 1 ? 'green' : ''"
            >
              {{ WORK_CYCLE_MAP[record.work_cycle] }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'freq'">
            {{ Array.isArray(record.exec_time) ? record.exec_time.length : 1 }}
          </template>
          <template v-else-if="column.key === 'exec_time'">
            <template v-if="Array.isArray(record.exec_time)">
              <template v-for="(et, i) in record.exec_time" :key="i">
                <template v-if="record.work_cycle === 0">{{ et }}</template>
                <template v-else-if="record.work_cycle === 1">{{ WEEKDAY_MAP[et] || et }}</template>
                <template v-else-if="record.work_cycle === 2">{{ et }}日</template>
                <template v-else>—</template>
                <template v-if="i < record.exec_time.length - 1">, </template>
              </template>
            </template>
            <template v-else>
              <template v-if="record.work_cycle === 0">{{ record.exec_time === -1 ? '每天' : record.exec_time }}</template>
              <template v-else-if="record.work_cycle === 1">{{ WEEKDAY_MAP[record.exec_time] || record.exec_time }}</template>
              <template v-else-if="record.work_cycle === 2">{{ record.exec_time }}日</template>
              <template v-else>—</template>
            </template>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 0 ? 'green' : 'red'">{{
              STATUS_MAP[record.status]
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'start_time'">{{
            record.start_time ? record.start_time.slice(0, 5) : '—'
          }}</template>
          <template v-else-if="column.key === 'end_time'">{{
            record.end_time ? record.end_time.slice(0, 5) : '—'
          }}</template>
          <template v-else-if="column.key === 'standards'">
            <a-button size="small" type="link" @click="openStandardLink(record.id)">
              {{
                standardMap[record.id]?.ids?.length
                  ? `已关联 (${standardMap[record.id]!.ids.length})`
                  : '无关联'
              }}
            </a-button>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                size="small"
                :type="record.status === 0 ? 'default' : 'primary'"
                @click="handleToggleStatus(record as unknown as WorkPlanItem)"
              >
                {{ record.status === 0 ? '停用' : '启用' }}
              </a-button>
              <a-button size="small" @click="openEdit(record as unknown as WorkPlanItem)"><EditOutlined /></a-button>
              <a-popconfirm title="确定删除？" @confirm="handleDelete(record.id)">
                <a-button size="small" danger><DeleteOutlined /></a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑弹窗 -->
    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      cancel-text="取消"
      ok-text="确定"
      :confirm-loading="submitting" @ok="handleSubmit"
      width="640px"
    >
      <a-form ref="formRef" :model="form" layout="vertical">
        <!-- 同组工作 Tab 切换 -->
        <div v-if="groupWorks.length > 1" class="flex gap-1 mb-3 flex-wrap">
          <a-button
            v-for="(gw, i) in groupWorks"
            :key="gw.id"
            size="small"
            :type="i === activeGroupIdx ? 'primary' : 'default'"
            @click="switchGroupTab(i)"
          >{{ execTimeLabel(gw) }}</a-button>
        </div>
        <a-form-item label="所属项目">
          <a-tree-select
            v-model:value="formProjectId"
            :tree-data="appCache.projectList"
            :field-names="{ children: 'children', label: 'label', value: 'id' }"
            tree-node-filter-prop="label"
            :dropdown-match-select-width="false"
            :dropdown-style="{ minWidth: '260px' }"
            placeholder="选择项目"
          />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="工作名称" required>
              <a-input v-model:value="form.work_name" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="工资">
              <a-input-number v-model:value="form.salary" :min="0" :step="0.01" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="单价">
              <a-input-number v-model:value="form.price" :min="0" disabled class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="单位">
              <a-input v-model:value="form.unit" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="数量">
              <a-input-number v-model:value="form.number" :min="0" class="w-full" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="!editId" :gutter="16">
          <a-col :span="6">
            <a-form-item label="频次">
              <a-input v-model:value="localFeq" @change="onFeqChange" placeholder="时间槽数量" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="开始时间">
              <a-time-picker
                v-model:value="form.start_time"
                format="HH:mm"
                class="w-full"
                @change="validateTimes"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item
              label="结束时间"
              :validate-status="endTimeInvalid ? 'error' : ''"
              :help="endTimeInvalid ? '结束时间不能小于开始时间' : ''"
            >
              <a-time-picker
                v-model:value="form.end_time"
                format="HH:mm"
                class="w-full"
                @change="validateTimes"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="工作周期">
              <a-select v-model:value="form.work_cycle" :disabled="!!editId">
                <a-select-option :value="0">每日</a-select-option>
                <a-select-option :value="1">每周</a-select-option>
                <a-select-option :value="2">每月</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8" v-if="Number(localFeq) <= 1">
            <a-form-item label="执行时间">
              <div v-if="form.work_cycle === 0" key="daily">每天</div>
              <a-select
                v-else-if="form.work_cycle === 2"
                key="monthly"
                v-model:value="form.exec_time"
              >
                <a-select-option v-for="d in 31" :key="d" :value="d">{{ d }}日</a-select-option>
              </a-select>
              <a-select v-else key="weekly" v-model:value="form.exec_time">
                <a-select-option :value="1">星期一</a-select-option>
                <a-select-option :value="2">星期二</a-select-option>
                <a-select-option :value="3">星期三</a-select-option>
                <a-select-option :value="4">星期四</a-select-option>
                <a-select-option :value="5">星期五</a-select-option>
                <a-select-option :value="6">星期六</a-select-option>
                <a-select-option :value="7">星期日</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="Number(localFeq) > 1 && !editId" :gutter="16">
          <a-col :span="24">
            <a-form-item label="时间记录">
              <a-button @click="openTimeList"
                >配置时间 ({{ timeList.length || Number(localFeq) }})</a-button
              >
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 时间记录子对话框 -->
    <a-modal
      v-model:open="timeListOpen"
      title="时间记录"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleTimeListOk"
    >
      <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
        <div v-for="(_t, i) in timeList" :key="i" class="flex items-center gap-2">
          <span class="text-gray-400 w-6 text-right">{{ i + 1 }}</span>
          <a-input-number
            v-if="form.work_cycle === 2"
            v-model:value="timeList[i]"
            :min="1"
            :max="31"
            class="flex-1"
            addon-after="日"
          />
          <a-select v-else-if="form.work_cycle === 1" v-model:value="timeList[i]" class="flex-1">
            <a-select-option :value="1">星期一</a-select-option>
            <a-select-option :value="2">星期二</a-select-option>
            <a-select-option :value="3">星期三</a-select-option>
            <a-select-option :value="4">星期四</a-select-option>
            <a-select-option :value="5">星期五</a-select-option>
            <a-select-option :value="6">星期六</a-select-option>
            <a-select-option :value="7">星期日</a-select-option>
          </a-select>
          <a-time-picker
            v-else
            :value="timeList[i] ? dayjs(timeList[i], 'HH:mm') : undefined"
            format="HH:mm"
            class="flex-1"
            @update:value="
              (v) => {
                timeList[i] = v ? (v as ReturnType<typeof dayjs>).format('HH:mm') : undefined
              }
            "
          />
        </div>
      </div>
    </a-modal>
    <!-- 停用选择 -->
    <a-modal v-model:open="toggleTargetOpen" title="选择要停用的工作" ok-text="确定" cancel-text="取消" @ok="confirmToggle" width="400px">
      <a-radio-group v-model:value="selectedToggleId" class="flex flex-col gap-2">
        <a-radio v-for="t in toggleTargets" :key="t.id" :value="t.id">
          {{ execTimeLabel(t) }}
          <a-tag :color="t.status === 0 ? 'green' : 'red'" class="ml-2">{{ STATUS_MAP[t.status] }}</a-tag>
        </a-radio>
      </a-radio-group>
    </a-modal>
    <PcQrCodeDialog v-model="qrOpen" :items="qrItems" />
    <a-modal
      v-model:open="standardLinkOpen"
      title="关联工作标准"
      cancel-text="取消"
      ok-text="确定"
      @ok="saveStandardLink"
      width="500px"
    >
      <a-form layout="vertical">
        <a-form-item label="选择标准">
          <a-checkbox-group
            v-model:value="linkFormIds"
            class="flex flex-col gap-1 max-h-60 overflow-y-auto"
          >
            <a-checkbox v-for="s in standards" :key="s.id" :value="s.id">{{ s.name }}</a-checkbox>
          </a-checkbox-group>
          <div v-if="standards.length === 0" class="text-gray-400">暂无标准，请先创建工作标准</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
