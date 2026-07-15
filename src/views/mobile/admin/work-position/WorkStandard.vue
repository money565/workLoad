<script setup lang="ts">
import { message } from 'ant-design-vue'
import { getStandards, createStandard, updateStandard, getWorkPlans, type WorkPlanItem, type WorkStandardItem } from '@/axios/interface'
import { useUserStore } from '@/stores/counter'

const props = defineProps<{ pid: number }>()
const userStore = useUserStore()
const standards = ref<WorkStandardItem[]>([])
const allWorks = ref<WorkPlanItem[]>([])
const loading = ref(false)


async function fetchData() {
  const pid = props.pid
  if (!pid) return
  loading.value = true
  try {
    const [sRes, wRes] = await Promise.all([getStandards(pid), getWorkPlans(pid)])
    if (sRes.code === 200) standards.value = sRes.result
    if (wRes.code === 200) allWorks.value = wRes.result
  } catch { /* ignore */ }
  finally { loading.value = false }
}
fetchData()
watch(() => props.pid, () => fetchData())

// 去重显示
const distinctWorks = computed(() => {
  const seen = new Set<string>()
  return allWorks.value.filter(w => {
    const gk = w.group_key || `_id_${w.id}`
    if (seen.has(gk)) return false
    seen.add(gk)
    return true
  })
})

// 创建/编辑
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive({ name: '', group_keys: [] as string[] })
const contentItems = ref<string[]>([''])

function addContent() { contentItems.value.push('') }
function removeContent(i: number) { contentItems.value.splice(i, 1) }

function openCreate() {
  editId.value = null
  form.name = ''; form.group_keys = []; contentItems.value = ['']
  modalOpen.value = true
}

function openEdit(s: WorkStandardItem) {
  editId.value = s.id
  form.name = s.name
  form.group_keys = s.work_ids.map((id: number) => allWorks.value.find(w => w.id === id)?.group_key).filter(Boolean) as string[]
  contentItems.value = parseContent(s.content).filter(Boolean)
  if (contentItems.value.length === 0) contentItems.value.push('')
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.name.trim()) { message.warning('请输入标准名称'); return }
  submitting.value = true
  try {
    const pid = props.pid
    const arr = contentItems.value.filter(v => v.trim())
    const base = { name: form.name, content: arr, group_keys: form.group_keys }
    if (editId.value) await updateStandard(editId.value, base)
    else await createStandard(pid, { ...base, project_id: pid })
    modalOpen.value = false
    fetchData()
  } catch { message.error('保存失败') }
  finally { submitting.value = false }
}

function parseContent(content: string): string[] {
  try { return JSON.parse(content) } catch { return content ? [content] : [] }
}

defineExpose({ openCreate })
</script>

<template>
  <div class="flex-1 overflow-y-auto p-3">
    <a-spin :spinning="loading">
      <div v-if="standards.length === 0" class="flex-center py-16">
        <a-empty description="暂无标准" />
      </div>
      <div v-for="s in standards" :key="s.id" class="mb-3 bg-white rounded border p-3">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="font-bold text-sm">{{ s.name }}</div>
            <div v-if="s.content" class="text-xs text-gray-500 mt-1">
              <div v-for="(c, i) in parseContent(s.content)" :key="i">{{ i + 1 }}. {{ c }}</div>
            </div>
            <div class="mt-2 flex gap-1 flex-wrap">
              <a-tag v-for="n in s.work_names" :key="n" size="small" class="text-xs">{{ n }}</a-tag>
            </div>
            <div class="text-xs text-gray-400 mt-1">{{ s.created_at?.slice(0, 10) }}</div>
          </div>
          <a-tag :color="s.status === 0 ? 'green' : 'red'" size="small">{{ s.status === 0 ? '正常' : '停用' }}</a-tag>
        </div>
        <div class="flex gap-2 mt-2">
          <a-button size="small" @click="openEdit(s)">编辑</a-button>
        </div>
      </div>
    </a-spin>

    <a-modal v-model:open="modalOpen" :title="editId ? '编辑标准' : '创建标准'" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="90%" :mask-closable="false">
      <a-form layout="vertical" size="small">
        <a-form-item label="标准名称" required><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="关联工作">
          <a-checkbox-group v-model:value="form.group_keys" class="flex flex-col gap-1 max-h-32 overflow-y-auto">
            <a-checkbox v-for="w in distinctWorks" :key="w.group_key || w.id" :value="w.group_key">{{ w.work_name }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item label="标准内容">
          <div v-for="(_, i) in contentItems" :key="i" class="flex items-center gap-2 mb-1">
            <span class="text-gray-400 text-xs w-4">{{ i + 1 }}</span>
            <a-input v-model:value="contentItems[i]" size="small" class="flex-1" />
            <a-button size="small" @click="removeContent(i)" :disabled="contentItems.length <= 1">删</a-button>
          </div>
          <a-button type="dashed" size="small" block @click="addContent">+ 添加条目</a-button>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
