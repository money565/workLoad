<script setup lang="ts">
import { message } from 'ant-design-vue'
import { SearchOutlined, TeamOutlined } from '@ant-design/icons-vue'
import {
  getStaffDispatches, createStaffDispatch, updateStaffDispatch,
  getEmpListByProject, getPositions,
  type StaffDispatchItem, type EmpFullInfo, type PositionItem,
} from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<StaffDispatchItem[]>([])
const allPositions = ref<PositionItem[]>([])
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const formProjectId = ref<number>(-1)
const empKeyword = ref('')
const empResults = ref<EmpFullInfo[]>([])
const selectedEmps = ref<EmpFullInfo[]>([])
const selectedPosIds = ref<number[]>([])
const currentPositionName = ref('')

// 所有岗位 + 已安排人员
const positionView = computed(() => {
  const dispatchMap = new Map<string, Set<string>>()
  const dispatchStatusMap = new Map<string, number>()
  for (const d of dataSource.value) {
    for (const pn of d.position_names) {
      if (!dispatchMap.has(pn)) dispatchMap.set(pn, new Set())
      for (const en of d.emp_names) dispatchMap.get(pn)!.add(en)
      dispatchStatusMap.set(pn, d.status)
    }
  }
  return allPositions.value.map(p => ({
    id: p.id,
    position: p.name,
    emps: [...(dispatchMap.get(p.name) || [])],
    status: dispatchStatusMap.get(p.name) ?? 0,
  }))
})

const columns = [
  { title: '岗位', dataIndex: 'position', key: 'position', width: 200 },
  { title: '安排人员', key: 'emps', width: 300 },
  { title: '操作', key: 'action', width: 120 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [dispatchRes, posRes] = await Promise.all([
      getStaffDispatches(appCache.currentProject),
      getPositions(appCache.currentProject),
    ])
    if (dispatchRes.code === 200) dataSource.value = dispatchRes.result
    if (posRes.code === 200) allPositions.value = posRes.result
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

async function openAssign(positionName: string, positionId: number) {
  editId.value = null
  currentPositionName.value = positionName
  // 查找已有调配记录
  const existing = dataSource.value.find(d => d.position_names.includes(positionName))
  if (existing) {
    editId.value = existing.id
    selectedPosIds.value = [...existing.position_ids]
    try {
      const empRes = await getEmpListByProject(existing.project_id)
      if (empRes.code === 200) {
        selectedEmps.value = empRes.result.filter(e => existing.emp_ids.includes(e.id))
      }
    } catch { selectedEmps.value = [] }
  } else {
    selectedPosIds.value = [positionId]
    selectedEmps.value = []
  }
  formProjectId.value = appCache.currentProject
  empKeyword.value = ''
  empResults.value = []
  try {
    const posRes = await getPositions(appCache.currentProject)
    if (posRes.code === 200) allPositions.value = posRes.result
  } catch { /* ignore */ }
  modalOpen.value = true
}

// 开发环境搜索全部项目的人员，生产环境仅搜索当前项目
async function searchEmps() {
  if (formProjectId.value === -1) return
  try {
    const kw = empKeyword.value.trim()
    const projectIds = import.meta.env.DEV
      ? appCache.projectList.flatMap(n => [n.id, ...(n.children || []).map(c => c.id)])
      : [formProjectId.value]
    const results: EmpFullInfo[] = []
    for (const pid of projectIds) {
      const res = await getEmpListByProject(pid)
      if (res.code === 200) {
        for (const e of res.result) {
          if (results.find(r => r.id === e.id)) continue
          if (!kw || e.name.includes(kw)) results.push(e)
        }
      }
    }
    empResults.value = results.filter(e => !selectedEmps.value.find(s => s.id === e.id))
  } catch { /* ignore */ }
}

function selectEmp(emp: EmpFullInfo) {
  selectedEmps.value.push(emp)
  empResults.value = empResults.value.filter(e => e.id !== emp.id)
  empKeyword.value = ''
}

function removeEmp(index: number) { selectedEmps.value.splice(index, 1) }

const submitting = ref(false)

async function handleSubmit() {
  if (formProjectId.value === -1) return
  submitting.value = true
  try {
    const payload = { emp_ids: selectedEmps.value.map(e => e.id), position_ids: selectedPosIds.value }
    if (editId.value) {
      await updateStaffDispatch(editId.value, payload)
    } else {
      await createStaffDispatch(formProjectId.value, payload)
    }
    modalOpen.value = false
    fetchData()
  } catch { message.error('保存失败') }
  finally { submitting.value = false }
}

async function removeEmpFromPosition(position: string, emp: string) {
  for (const d of dataSource.value) {
    if (d.position_names.includes(position) && d.emp_names.includes(emp)) {
      const newEmpIds = d.emp_ids.filter((_, i) => d.emp_names[i] !== emp)
      try {
        await updateStaffDispatch(d.id, { emp_ids: newEmpIds })
        fetchData()
      } catch { message.error('操作失败') }
      return
    }
  }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="人员调配" :sub-title="appCache.currentProjectName" @back="() => $router.back()" />
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :columns="columns" :data-source="positionView" :loading="loading"
        :pagination="{ pageSize: 20 }" :scroll="{ y: 'calc(100vh - 320px)' }"
        row-key="position" size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'position'">
            <a-tag color="blue">{{ record.position }}</a-tag>
          </template>
          <template v-else-if="column.key === 'emps'">
            <a-space wrap>
              <a-tag v-for="emp in record.emps" :key="emp" closable @close="removeEmpFromPosition(record.position, emp)">{{ emp }}</a-tag>
              <span v-if="record.emps.length === 0" class="text-gray-400">暂无安排</span>
            </a-space>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="primary" @click="openAssign(record.position, record.id)">
              <template #icon><TeamOutlined /></template>
              安排人员
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="`安排人员 — ${currentPositionName}`" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="600px">
      <a-form layout="vertical">
        <a-form-item label="搜索人员">
          <a-input-search v-model:value="empKeyword" placeholder="输入姓名搜索" @search="searchEmps" @focus="searchEmps">
            <template #prefix><SearchOutlined /></template>
          </a-input-search>
          <div v-if="empResults.length > 0" class="mt-2 max-h-40 overflow-y-auto border rounded p-2">
            <div v-for="e in empResults" :key="e.id" class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 rounded px-2" @click="selectEmp(e)">
              <span>{{ e.name }} - {{ e.depName }}</span>
              <a-tag color="green">添加</a-tag>
            </div>
          </div>
          <div v-if="selectedEmps.length > 0" class="mt-2">
            <a-tag v-for="(e, i) in selectedEmps" :key="e.id" closable @close="removeEmp(i)">{{ e.name }}</a-tag>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
