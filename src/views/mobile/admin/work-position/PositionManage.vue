<script setup lang="ts">
import { message } from 'ant-design-vue'
import { getPositions, createPosition, updatePosition, getWorkPlans, type PositionItem, type WorkPlanItem } from '@/axios/interface'
import { useUserStore } from '@/stores/counter'

const props = defineProps<{ pid: number }>()
const userStore = useUserStore()
const positions = ref<PositionItem[]>([])
const allWorks = ref<WorkPlanItem[]>([])
const loading = ref(false)


async function fetchData() {
  const pid = props.pid
  if (!pid) return
  loading.value = true
  try {
    const [pRes, wRes] = await Promise.all([getPositions(pid), getWorkPlans(pid)])
    if (pRes.code === 200) positions.value = pRes.result
    if (wRes.code === 200) allWorks.value = wRes.result
  } catch { /* ignore */ }
  finally { loading.value = false }
}
fetchData()
watch(() => props.pid, () => fetchData())

const distinctWorks = computed(() => {
  const seen = new Set<string>()
  return allWorks.value.filter(w => {
    const gk = w.group_key || `_id_${w.id}`
    if (seen.has(gk)) return false
    seen.add(gk)
    return true
  })
})

// 编辑
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive({ name: '', group_keys: [] as string[] })

function openCreate() {
  editId.value = null
  form.name = ''; form.group_keys = []
  modalOpen.value = true
}

function openEdit(p: PositionItem) {
  editId.value = p.id
  form.name = p.name
  form.group_keys = p.works.map((id: number) => allWorks.value.find(w => w.id === id)?.group_key).filter(Boolean) as string[]
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.name.trim()) { message.warning('请输入岗位名称'); return }
  submitting.value = true
  try {
    const pid = props.pid
    const payload = { name: form.name, group_keys: form.group_keys }
    if (editId.value) await updatePosition(editId.value, { ...payload, project_id: pid })
    else await createPosition(pid, payload)
    modalOpen.value = false
    fetchData()
  } catch { message.error('保存失败') }
  finally { submitting.value = false }
}

function groupWorkNames(names: string[]): string[] {
  const count: Record<string, number> = {}
  for (const n of names) count[n] = (count[n] || 0) + 1
  return [...new Set(names)].map(n => count[n]! > 1 ? `${n} ×${count[n]}` : n)
}

defineExpose({ openCreate })
</script>

<template>
  <div class="flex-1 overflow-y-auto p-3">
    <a-spin :spinning="loading">
      <div v-if="positions.length === 0" class="flex-center py-16">
        <a-empty description="暂无岗位" />
      </div>
      <div v-for="p in positions" :key="p.id" class="mb-3 bg-white rounded border p-3">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="font-bold text-sm">{{ p.name }}</div>
            <div class="mt-2 flex gap-1 flex-wrap">
              <a-tag v-for="n in groupWorkNames(p.work_names)" :key="n" size="small" class="text-xs">{{ n }}</a-tag>
            </div>
            <div class="text-xs text-gray-400 mt-1">{{ p.created_at?.slice(0, 10) }}</div>
          </div>
          <a-tag :color="p.status === 0 ? 'green' : 'red'" size="small">{{ p.status === 0 ? '正常' : '停用' }}</a-tag>
        </div>
        <div class="flex gap-2 mt-2">
          <a-button size="small" @click="openEdit(p)">编辑</a-button>
        </div>
      </div>
    </a-spin>

    <a-modal v-model:open="modalOpen" :title="editId ? '编辑岗位' : '创建岗位'" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="90%" :mask-closable="false">
      <a-form layout="vertical" size="small">
        <a-form-item label="岗位名称" required><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="关联工作">
          <a-checkbox-group v-model:value="form.group_keys" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
            <a-checkbox v-for="w in distinctWorks" :key="w.group_key || w.id" :value="w.group_key">{{ w.work_name }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
