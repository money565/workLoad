<script setup lang="ts">
import { message } from 'ant-design-vue'
import { getWorkPlans, createWorkPlan, updateWorkPlan, type WorkPlanItem, type WorkPlanCreateParams } from '@/axios/interface'
import { useUserStore } from '@/stores/counter'

const props = defineProps<{ pid: number }>()
const userStore = useUserStore()
const works = ref<(WorkPlanItem & { children?: WorkPlanItem[] })[]>([])
const loading = ref(false)

// 获取项目ID

async function fetchWorks() {
  const pid = props.pid
  if (!pid) return
  loading.value = true
  try {
    const res = await getWorkPlans(pid)
    if (res.code === 200) {
      // 按 group_key 分组
      const groupMap = new Map<string, (WorkPlanItem & { children?: WorkPlanItem[] })[]>()
      const singles: (WorkPlanItem & { children?: WorkPlanItem[] })[] = []
      for (const w of res.result) {
        if (w.group_key) {
          if (!groupMap.has(w.group_key)) groupMap.set(w.group_key, [])
          groupMap.get(w.group_key)!.push(w)
        } else { singles.push(w) }
      }
      const grouped: (WorkPlanItem & { children?: WorkPlanItem[] })[] = []
      for (const [, items] of groupMap) {
        if (items.length > 1) items[0]!.children = items
        grouped.push(items[0]!)
      }
      works.value = [...grouped, ...singles]
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

fetchWorks()
watch(() => props.pid, () => fetchWorks())
defineExpose({ openCreate })

// 创建/编辑
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive({ work_name: '', price: 0, salary: 0, unit: '', number: 0, work_cycle: 0, exec_time: -1, start_time: '', end_time: '' })

function openCreate() { editId.value = null; Object.assign(form, { work_name: '', price: 0, salary: 0, unit: '', number: 0, work_cycle: 0, exec_time: -1, start_time: '07:00', end_time: '18:00' }); modalOpen.value = true }
function openEdit(w: WorkPlanItem) {
  editId.value = w.id
  Object.assign(form, { work_name: w.work_name, price: w.price, salary: w.salary, unit: w.unit, number: w.number, work_cycle: w.work_cycle, exec_time: w.exec_time, start_time: w.start_time?.slice(0, 5) || '07:00', end_time: w.end_time?.slice(0, 5) || '18:00' })
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.work_name.trim()) { message.warning('请输入工作名称'); return }
  submitting.value = true
  try {
    const pid = props.pid
    if (!pid) { message.error('无法获取项目'); return }
    const payload = { work_name: form.work_name, price: form.price, salary: form.salary, unit: form.unit, number: form.number, work_cycle: form.work_cycle, exec_time: form.exec_time, start_time: form.start_time, end_time: form.end_time }
    if (editId.value) await updateWorkPlan(editId.value, payload)
    else await createWorkPlan(pid, payload)
    modalOpen.value = false
    fetchWorks()
  } catch { message.error('保存失败') }
  finally { submitting.value = false }
}

async function toggleStatus(w: WorkPlanItem) {
  try {
    await updateWorkPlan(w.id, { status: w.status === 0 ? 1 : 0 } as WorkPlanCreateParams)
    fetchWorks()
  } catch { message.error('操作失败') }
}

const WORK_CYCLE_MAP: Record<number, string> = { 0: '每日', 1: '每周', 2: '每月' }
const WEEKDAY_MAP: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
const FULL_WEEKDAY_MAP: Record<number, string> = { 1: '星期一', 2: '星期二', 3: '星期三', 4: '星期四', 5: '星期五', 6: '星期六', 7: '星期日' }
</script>

<template>
  <div class="flex-1 overflow-y-auto p-3">
      <a-spin :spinning="loading">
        <div v-if="works.length === 0" class="flex-center py-16">
          <a-empty description="暂无工作" />
        </div>
          <a-card v-for="w in works" :key="w.id" class="mb-3" size="small" :class="{ 'opacity-50': w.status === 1 }">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="font-bold text-sm">{{ w.work_name }}</div>
                <div class="flex gap-2 mt-1 flex-wrap text-xs">
                  <a-tag :color="w.work_cycle === 0 ? 'blue' : w.work_cycle === 1 ? 'green' : 'orange'">{{ WORK_CYCLE_MAP[w.work_cycle] }}</a-tag>
                  <span class="text-gray-500">¥{{ w.price }} / {{ w.unit }}×{{ w.number }}</span>
                  <span class="text-gray-400">{{ w.start_time?.slice(0, 5) || '—' }}~{{ w.end_time?.slice(0, 5) || '—' }}</span>
                </div>
                <div v-if="w.children && w.children.length > 0" class="mt-1">
                  <template v-if="w.work_cycle === 0">
                    <a-tag v-for="c in w.children" :key="c.id" size="small" class="text-xs">{{ c.start_time?.slice(0, 5) || '—' }}</a-tag>
                  </template>
                  <template v-else-if="w.work_cycle === 1">
                    <a-tag v-for="c in w.children" :key="c.id" size="small" class="text-xs">{{ FULL_WEEKDAY_MAP[c.exec_time] || c.exec_time }}</a-tag>
                  </template>
                  <template v-else>
                    <a-tag v-for="c in w.children" :key="c.id" size="small" class="text-xs">每月{{ c.exec_time }}日</a-tag>
                  </template>
                </div>
              </div>
              <a-tag :color="w.status === 0 ? 'green' : 'red'" size="small">{{ w.status === 0 ? '正常' : '停用' }}</a-tag>
            </div>
            <div class="flex gap-2 mt-2">
              <a-button size="small" @click="openEdit(w)">编辑</a-button>
              <a-button size="small" @click="toggleStatus(w)">{{ w.status === 0 ? '停用' : '启用' }}</a-button>
            </div>
          </a-card>
      </a-spin>
    </div>

    <!-- 创建/编辑对话框 -->
    <a-modal v-model:open="modalOpen" :title="editId ? '编辑工作' : '创建工作'" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="90%" :mask-closable="false">
      <a-form layout="vertical" size="small">
        <a-form-item label="工作名称" required><a-input v-model:value="form.work_name" /></a-form-item>
        <a-row :gutter="8">
          <a-col :span="8"><a-form-item label="工资"><a-input-number v-model:value="form.salary" :min="0" class="w-full" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="单价"><a-input-number v-model:value="form.price" :min="0" disabled class="w-full" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="单位"><a-input v-model:value="form.unit" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="数量"><a-input-number v-model:value="form.number" :min="0" class="w-full" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="8">
          <a-col :span="12"><a-form-item label="工作周期">
            <a-select v-model:value="form.work_cycle">
              <a-select-option :value="0">每日</a-select-option>
              <a-select-option :value="1">每周</a-select-option>
              <a-select-option :value="2">每月</a-select-option>
            </a-select>
          </a-form-item></a-col>
          <a-col :span="12">
            <a-form-item v-if="form.work_cycle === 0" label="执行时间">每天</a-form-item>
            <a-form-item v-else-if="form.work_cycle === 1" label="执行时间">
              <a-select v-model:value="form.exec_time">
                <a-select-option v-for="d in 7" :key="d" :value="d">{{ WEEKDAY_MAP[d] }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-else label="执行时间">
              <a-select v-model:value="form.exec_time">
                <a-select-option v-for="d in 31" :key="d" :value="d">{{ d }}日</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="8">
          <a-col :span="12"><a-form-item label="开始时间"><a-input v-model:value="form.start_time" placeholder="07:00" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="结束时间"><a-input v-model:value="form.end_time" placeholder="18:00" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
</template>
