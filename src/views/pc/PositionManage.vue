<script setup lang="ts">
import { message } from 'ant-design-vue'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import {
  getPositions, createPosition, updatePosition, deletePosition,
  getWorkPlans, type WorkPlanItem, type PositionItem,
} from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<PositionItem[]>([])
const modalOpen = ref(false)
const modalTitle = ref('创建岗位')
const editId = ref<number | null>(null)
const formProjectId = ref<number>(-1)
const allWorks = ref<WorkPlanItem[]>([])
const allPositions = ref<PositionItem[]>([])

// 按 group_key 去重：同组只显示第一条
const distinctWorks = computed(() => {
  const seen = new Set<string>()
  return allWorks.value.filter(w => {
    const gk = w.group_key || `_id_${w.id}`
    if (seen.has(gk)) return false
    seen.add(gk)
    return true
  })
})

// 已分配的工作 group_key 集合（排除当前编辑的岗位）
const takenGroupKeys = computed(() => {
  const allTakenIds = new Set<number>()
  for (const p of allPositions.value) {
    if (p.id !== editId.value) {
      for (const wid of p.works) allTakenIds.add(wid)
    }
  }
  // 转为 group_key
  const keys = new Set<string>()
  for (const w of allWorks.value) {
    if (allTakenIds.has(w.id)) keys.add(w.group_key)
  }
  return keys
})

const availableWorks = computed(() => distinctWorks.value.filter(w => !takenGroupKeys.value.has(w.group_key)))
const takenWorks = computed(() => distinctWorks.value.filter(w => takenGroupKeys.value.has(w.group_key)))

// 工作ID → 岗位名 映射
function groupWorkNames(names: string[]): string[] {
  const count: Record<string, number> = {}
  for (const n of names) count[n] = (count[n] || 0) + 1
  return [...new Set(names)].map(n => count[n]! > 1 ? `${n} ×${count[n]}` : n)
}

const workPositionName = computed(() => {
  const map: Record<number, string> = {}
  for (const p of allPositions.value) {
    if (p.id !== editId.value) {
      for (const wid of p.works) map[wid] = p.name
    }
  }
  return map
})

const form = reactive({
  name: '',
  status: 0,
  group_keys: [] as string[],
})

const columns = [
  { title: '岗位名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '关联工作', key: 'works', width: 300 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '操作', key: 'action', width: 120 },
]

async function fetchData() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [posRes, worksRes] = await Promise.all([
      getPositions(appCache.currentProject),
      getWorkPlans(appCache.currentProject),
    ])
    if (posRes.code === 200) {
      dataSource.value = posRes.result
      allPositions.value = posRes.result
    }
    if (worksRes.code === 200) allWorks.value = worksRes.result
  } catch { console.warn('获取数据失败') }
  finally { loading.value = false }
}

async function loadWorksForProject(pid: number) {
  console.log('📂 loadWorksForProject pid:', pid)
  if (pid === -1) return
  try {
    const [worksRes, posRes] = await Promise.all([
      getWorkPlans(pid),
      getPositions(pid),
    ])
    console.log('📂 worksRes:', worksRes.code, worksRes.result.length, 'positionsRes:', posRes.code, posRes.result.length)
    if (worksRes.code === 200) {
      allWorks.value = worksRes.result
      console.log('📂 allWorks updated, count:', allWorks.value.length)
    }
    if (posRes.code === 200) {
      allPositions.value = posRes.result
      console.log('📂 allPositions updated, count:', allPositions.value.length)
    }
  } catch (e) {
    console.error('loadWorksForProject error:', e)
    message.error('加载工作列表失败')
  }
}

async function openCreate() {
  editId.value = null
  formProjectId.value = appCache.currentProject
  modalTitle.value = '创建岗位'
  form.name = ''
  form.status = 0
  form.group_keys = []
  await loadWorksForProject(appCache.currentProject)
  modalOpen.value = true
}

watch(formProjectId, (pid) => {
  console.log('🔄 formProjectId changed:', pid, 'modalOpen:', modalOpen.value)
  if (modalOpen.value) loadWorksForProject(pid)
})

async function openEdit(r: PositionItem | Record<string, unknown>) {
  const item = r as PositionItem
  editId.value = item.id
  formProjectId.value = item.project_id
  modalTitle.value = '编辑岗位'
  form.name = item.name
  form.status = item.status
  await loadWorksForProject(item.project_id)
  form.group_keys = item.works
    .map((id: number) => allWorks.value.find(w => w.id === id)?.group_key)
    .filter(Boolean) as string[]
  modalOpen.value = true
}

const submitting = ref(false)

async function handleSubmit() {
  if (formProjectId.value === -1) return
  if (!form.name.trim()) { message.warning('请输入岗位名称'); return }
  submitting.value = true
  try {
    const payload = { name: form.name, status: form.status, group_keys: form.group_keys }
    if (editId.value) {
      await updatePosition(editId.value, { ...payload, project_id: formProjectId.value })
    } else {
      await createPosition(formProjectId.value, payload)
    }
    modalOpen.value = false
    fetchData()
  } catch { console.warn('保存失败') }
  finally { submitting.value = false }
}

async function handleDelete(id: number) {
  try { await deletePosition(id); fetchData() }
  catch { console.warn('删除失败') }
}

watch(() => appCache.currentProject, fetchData, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="岗位管理" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>创建岗位</a-button>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table
        :columns="columns" :data-source="dataSource" :loading="loading"
        :pagination="{ pageSize: 20 }" :scroll="{ y: 'calc(100vh - 320px)' }"
        row-key="id" size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'works'">
            <a-space wrap>
              <a-tag v-for="name in groupWorkNames(record.work_names as string[])" :key="name">{{ name }}</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 0 ? 'green' : 'red'">{{ record.status === 0 ? '正常' : '停用' }}</a-tag>
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

    <a-modal v-model:open="modalOpen" :title="modalTitle" cancel-text="取消" ok-text="确定" :confirm-loading="submitting" @ok="handleSubmit" width="520px">
      <a-form layout="vertical">
        <a-form-item label="所属项目">
          <a-tree-select
            v-model:value="formProjectId"
            :tree-data="appCache.projectList"
            :field-names="{ children: 'children', title: 'label', value: 'id' } as any"
            tree-node-filter-prop="label"
            :dropdown-match-select-width="false"
            :dropdown-style="{ minWidth: '260px' }"
            placeholder="选择项目"
          />
        </a-form-item>
        <a-form-item label="岗位名称" required>
          <a-input v-model:value="form.name" placeholder="请输入岗位名称" />
        </a-form-item>
        <a-form-item label="未被关联">
          <a-checkbox-group v-model:value="form.group_keys" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
            <a-checkbox v-for="w in availableWorks" :key="w.group_key || w.id" :value="w.group_key">{{ w.work_name }}</a-checkbox>
          </a-checkbox-group>
          <div v-if="availableWorks.length === 0" class="text-gray-400">暂无可选工作</div>
        </a-form-item>
        <a-form-item v-if="takenWorks.length > 0" label="已被关联">
          <a-checkbox-group v-model:value="form.group_keys" class="flex flex-col gap-1 max-h-40 overflow-y-auto p-2 bg-orange-50 rounded">
            <a-checkbox v-for="w in takenWorks" :key="w.group_key || w.id" :value="w.group_key">
              {{ w.work_name }}
              <span class="text-orange-500 text-xs ml-1">（{{ workPositionName[w.id] }}）</span>
            </a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
