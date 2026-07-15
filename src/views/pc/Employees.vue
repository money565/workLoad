<script setup lang="ts">
import { UserOutlined } from '@ant-design/icons-vue'
import { getEmpListByProject, type EmpFullInfo } from '@/axios/interface'
import { useAppCacheStore } from '@/stores/appCache'

const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<EmpFullInfo[]>([])
const typeMap = ref<Record<number, number>>({})
const typeEntries = ref<Record<number, number>>({})
const typeLoading = ref<Record<number, boolean>>({})

const columns = [
  { title: '序号', key: 'index', width: 60, align: 'center' as const },
  { title: '头像', key: 'avatar', width: 60 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '部门', dataIndex: 'depName', key: 'depName', width: 160 },
  { title: '职务', dataIndex: 'posit', key: 'posit', width: 100 },
  { title: '手机号', dataIndex: 'mobile', key: 'mobile', width: 120 },
  { title: '类型', key: 'empType', width: 100 },
]

async function fetchEmployees() {
  if (appCache.currentProject === -1) return
  loading.value = true
  try {
    const [empRes, typeRes] = await Promise.all([
      getEmpListByProject(appCache.currentProject),
      fetch(`/api/workLoad/empTypes/${appCache.currentProject}`).then(r => r.json()),
    ])
    if (empRes.code === 200) dataSource.value = empRes.result
    if (typeRes.code === 200) {
      const tm: Record<number, number> = {}
      const te: Record<number, number> = {}
      for (const t of typeRes.result) { tm[t.emp_id] = t.type; te[t.emp_id] = t.id }
      typeMap.value = tm; typeEntries.value = te
    }
  } catch { console.warn('获取失败') }
  finally { loading.value = false }
}

async function handleTypeChange(empId: number, newType: number) {
  const entryId = typeEntries.value[empId]
  typeLoading.value[empId] = true
  try {
    if (newType === 3) {
      if (entryId) {
        await fetch(`/api/workLoad/empType/${entryId}`, { method: 'DELETE' })
        delete typeMap.value[empId]; delete typeEntries.value[empId]
      }
    } else {
      if (entryId) {
        const r = await fetch(`/api/workLoad/empType/${entryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: newType }) }).then(r => r.json())
        console.log('PUT result:', r)
      } else {
        const res = await fetch(`/api/workLoad/empTypes/${appCache.currentProject}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp_id: empId, type: newType }) }).then(r => r.json())
        console.log('POST result:', res)
        if (res.code === 200) typeEntries.value[empId] = res.id
      }
      typeMap.value[empId] = newType
    }
  } catch (e) { console.error('类型保存失败:', e) }
  finally { typeLoading.value[empId] = false }
}

watch(() => appCache.currentProject, fetchEmployees, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="员工列表" :sub-title="appCache.currentProjectName" @back="() => $router.back()" />
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <a-table :columns="columns" :data-source="dataSource" :loading="loading" :pagination="{ pageSize: 20, showTotal: (t: number) => `共 ${t} 人` }" :scroll="{ y: 'calc(100vh - 310px)' }" row-key="id" size="middle" sticky>
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-if="column.key === 'avatar'">
            <a-avatar :size="32" :src="record.avatar"><template #icon><UserOutlined /></template></a-avatar>
          </template>
          <template v-else-if="column.key === 'empType'">
            <a-select :value="typeMap[record.id] ?? 3" size="small" class="w-20" :loading="!!typeLoading[record.id]" @change="(v: any) => { if (v != null) handleTypeChange(record.id, Number(v)) }">
              <a-select-option :value="3">其他</a-select-option>
              <a-select-option :value="1">社保</a-select-option>
              <a-select-option :value="2">合同</a-select-option>
            </a-select>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
