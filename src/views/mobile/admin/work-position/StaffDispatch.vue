<script setup lang="ts">
import { message } from 'ant-design-vue'
import { getStaffDispatches, getEmpListByProject, getPositions, type EmpFullInfo, type PositionItem } from '@/axios/interface'
import { useUserStore } from '@/stores/counter'

const props = defineProps<{ pid: number }>()
const userStore = useUserStore()
const loading = ref(false)
const positions = ref<PositionItem[]>([])
const dispatches = ref<{ id: number; position_ids: number[]; position_names: string[]; emp_ids: number[]; emp_names: string[]; status: number }[]>([])

async function fetchData() {
  const pid = props.pid
  if (!pid) return
  loading.value = true
  try {
    const [dRes, pRes] = await Promise.all([
      fetch(`/api/workLoad/staffDispatch/${pid}`).then(r => r.json()),
      getPositions(pid),
    ])
    if (dRes.code === 200) dispatches.value = dRes.result
    if (pRes.code === 200) positions.value = pRes.result
  } catch { /* ignore */ }
  finally { loading.value = false }
}
fetchData()
watch(() => props.pid, () => fetchData())

const positionView = computed(() => {
  const dispatchMap = new Map<string, { emps: Set<string>; status: number; dispatchId: number }>()
  for (const d of dispatches.value) {
    for (const pn of d.position_names) {
      if (!dispatchMap.has(pn)) dispatchMap.set(pn, { emps: new Set(), status: d.status, dispatchId: d.id })
      for (const en of d.emp_names) dispatchMap.get(pn)!.emps.add(en)
    }
  }
  return positions.value.map(p => {
    const info = dispatchMap.get(p.name)
    return {
      id: p.id,
      name: p.name,
      emps: info ? [...info.emps] : [],
      status: info?.status ?? 0,
      dispatchId: info?.dispatchId ?? 0,
    }
  })
})

// 安排人员
const modalOpen = ref(false)
const dispatchPosId = ref(0)
const dispatchPosName = ref('')
const allEmps = ref<EmpFullInfo[]>([])
const selectedEmpIds = ref<number[]>([])
const submitting = ref(false)
const empKeyword = ref('')

async function openAssign(posId: number, posName: string) {
  dispatchPosId.value = posId
  dispatchPosName.value = posName
  empKeyword.value = ''
  // 获取项目所有员工
  const pid = props.pid
  const res = await fetch(`/api/workLoad/empListByProject/${pid}`).then(r => r.json())
  if (res.code === 200) allEmps.value = res.result
  // 已选员工
  const existing = positionView.value.find(p => p.id === posId)
  selectedEmpIds.value = existing ? allEmps.value.filter(e => existing.emps.includes(e.name)).map(e => e.id) : []
  modalOpen.value = true
}

function toggleEmp(id: number) {
  const idx = selectedEmpIds.value.indexOf(id)
  if (idx >= 0) selectedEmpIds.value.splice(idx, 1)
  else selectedEmpIds.value.push(id)
}

async function handleSubmit() {
  submitting.value = true
  try {
    const pid = props.pid
    // 将选中的员工ID和当前岗位ID传给后端
    const payload = { emp_ids: selectedEmpIds.value, position_ids: [dispatchPosId.value] }
    await fetch(`/api/workLoad/staffDispatch/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    modalOpen.value = false
    fetchData()
    message.success('安排成功')
  } catch { message.error('操作失败') }
  finally { submitting.value = false }
}

const filteredEmps = computed(() => {
  const kw = empKeyword.value.trim()
  return kw ? allEmps.value.filter(e => e.name.includes(kw)) : allEmps.value
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-3">
    <a-spin :spinning="loading">
      <div v-if="positionView.length === 0" class="flex-center py-16">
        <a-empty description="暂无岗位" />
      </div>
      <div v-for="pv in positionView" :key="pv.id" class="mb-3 bg-white rounded border p-3">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="font-bold text-sm">{{ pv.name }}</div>
            <div v-if="pv.emps.length > 0" class="mt-2 flex gap-1 flex-wrap">
              <a-tag v-for="e in pv.emps" :key="e" size="small">{{ e }}</a-tag>
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">暂未安排人员</div>
          </div>
          <a-tag :color="pv.status === 0 ? 'green' : 'red'" size="small">{{ pv.status === 0 ? '正常' : '停用' }}</a-tag>
        </div>
        <div class="flex gap-2 mt-2">
          <a-button type="primary" block @click="openAssign(pv.id, pv.name)">安排人员</a-button>
        </div>
      </div>
    </a-spin>

    <a-modal v-model:open="modalOpen" :title="`安排人员 — ${dispatchPosName}`" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="90%" :mask-closable="false">
      <a-input v-model:value="empKeyword" placeholder="搜索姓名" size="small" class="mb-3" />
      <div class="max-h-60 overflow-y-auto">
        <div
          v-for="e in filteredEmps"
          :key="e.id"
          class="flex items-center gap-2 py-2 px-1 border-b border-gray-100 cursor-pointer"
          :class="{ 'bg-blue-50': selectedEmpIds.includes(e.id) }"
          @click="toggleEmp(e.id)"
        >
          <a-checkbox :checked="selectedEmpIds.includes(e.id)" />
          <a-avatar :src="e.avatar" :size="28" />
          <div>
            <div class="text-sm">{{ e.name }}</div>
            <div class="text-xs text-gray-400">{{ e.depName }}</div>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>
