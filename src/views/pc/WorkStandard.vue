<script setup lang="ts">
import { message } from 'ant-design-vue'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { getStandards, createStandard, updateStandard, deleteStandard, getWorkPlans, type WorkStandardItem, type WorkPlanItem } from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<WorkStandardItem[]>([])
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const formProjectId = ref<number>(-1)
const allWorks = ref<WorkPlanItem[]>([])

const form = reactive({ name: '', group_keys: [] as string[] })

// 按 group_key 去重：同组只显示第一条的工作名称
function groupWorkNames(names: string[]): string[] {
  const count: Record<string, number> = {}
  for (const n of names) count[n] = (count[n] || 0) + 1
  return [...new Set(names)].map(n => count[n]! > 1 ? `${n} ×${count[n]}` : n)
}

const distinctWorks = computed(() => {
  const seen = new Set<string>()
  return allWorks.value.filter(w => {
    const gk = w.group_key || `_id_${w.id}`
    if (seen.has(gk)) return false
    seen.add(gk)
    return true
  })
})
const contentItems = ref<string[]>([])

const columns = [
  { title: '标准名称', dataIndex: 'name', key: 'name', width: 140 },
  { title: '标准内容', key: 'content', width: 200 },
  { title: '关联工作', key: 'works', width: 200 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 100 },
  { title: '操作', key: 'action', width: 120 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [sRes, wRes] = await Promise.all([getStandards(appCache.currentProject), getWorkPlans(appCache.currentProject)])
    if (sRes.code === 200) dataSource.value = sRes.result
    if (wRes.code === 200) allWorks.value = wRes.result
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

function addContent() { contentItems.value.push('') }
function removeContent(i: number) { contentItems.value.splice(i, 1) }

async function openCreate() {
  editId.value = null
  formProjectId.value = appCache.currentProject
  form.name = ''; form.group_keys = []; contentItems.value = ['']
  await loadWorks(formProjectId.value)
  modalOpen.value = true
}

async function loadWorks(pid: number) {
  try { const res = await getWorkPlans(pid); if (res.code === 200) allWorks.value = res.result }
  catch { allWorks.value = [] }
}
watch(formProjectId, (pid) => { if (modalOpen.value) loadWorks(pid) })

async function openEdit(r: WorkStandardItem | Record<string, unknown>) {
  const item = r as WorkStandardItem
  editId.value = item.id
  form.name = item.name
  // 确保已加载对应项目的工作列表
  formProjectId.value = appCache.currentProject
  if (allWorks.value.length === 0 || !allWorks.value.some(w => item.work_ids.includes(w.id))) {
    await loadWorks(appCache.currentProject)
  }
  form.group_keys = item.work_ids
    .map((id: number) => allWorks.value.find(w => w.id === id)?.group_key)
    .filter(Boolean) as string[]
  contentItems.value = (Array.isArray(item.content) ? item.content : [item.content]).filter(Boolean)
  if (contentItems.value.length === 0) contentItems.value.push('')
  modalOpen.value = true
}

const submitting = ref(false)

async function handleSubmit() {
  if (!form.name.trim()) { message.warning('请输入标准名称'); return }
  submitting.value = true
  try {
    const arr = contentItems.value.filter(v => v.trim())
    const base = { name: form.name, content: arr, group_keys: form.group_keys }
    if (editId.value) {
      await updateStandard(editId.value, base)
    } else {
      await createStandard(formProjectId.value, { ...base, project_id: formProjectId.value })
    }
    modalOpen.value = false
    fetchData()
  } catch { message.error('保存失败') }
  finally { submitting.value = false }
}

async function handleDelete(id: number) {
  try { await deleteStandard(id); fetchData() }
  catch { message.error('删除失败') }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="工作标准" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>创建工作标准</a-button>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table :columns="columns" :data-source="dataSource" :loading="loading" :pagination="{ pageSize: 20 }" :scroll="{ y: 'calc(100vh - 320px)' }" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'content'">
            <div class="text-xs text-gray-600">
              <div v-for="(c, i) in (Array.isArray(record.content) ? record.content : [record.content])" :key="i">{{ i + 1 }}. {{ c }}</div>
            </div>
          </template>
          <template v-else-if="column.key === 'works'">
            <a-space wrap><a-tag v-for="n in groupWorkNames(record.work_names as string[])" :key="n">{{ n }}</a-tag></a-space>
          </template>
          <template v-else-if="column.key === 'created_at'">{{ record.created_at?.slice(0, 10) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="openEdit(record)"><EditOutlined /></a-button>
              <a-popconfirm title="确定删除？" @confirm="handleDelete(record.id)">
                <a-button size="small" danger><DeleteOutlined /></a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editId ? '编辑' : '创建' + '工作标准'" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="560px" :mask-closable="false">
      <a-form layout="vertical">
        <a-form-item label="所属项目">
          <a-tree-select v-model:value="formProjectId" :tree-data="appCache.projectList" :field-names="{ value: 'id' }" tree-node-filter-prop="label" :dropdown-match-select-width="false" :dropdown-style="{ minWidth: '260px' }" />
        </a-form-item>
        <a-form-item label="标准名称" required>
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="关联工作">
          <a-checkbox-group v-model:value="form.group_keys" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
            <a-checkbox v-for="w in distinctWorks" :key="w.group_key || w.id" :value="w.group_key">{{ w.work_name }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item label="标准内容">
          <div class="flex flex-col gap-2">
            <div v-for="(_, i) in contentItems" :key="i" class="flex items-center gap-2">
              <span class="text-gray-400 w-6">{{ i + 1 }}</span>
              <a-input v-model:value="contentItems[i]" placeholder="请输入标准条目" class="flex-1" />
              <a-button size="small" danger @click="removeContent(i)" :disabled="contentItems.length <= 1">删除</a-button>
            </div>
            <a-button type="dashed" block @click="addContent">+ 添加条目</a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
