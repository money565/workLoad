<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue'
import WorkManage from './work-position/WorkManage.vue'
import WorkStandard from './work-position/WorkStandard.vue'
import PositionManage from './work-position/PositionManage.vue'
import StaffDispatch from './work-position/StaffDispatch.vue'

const props = defineProps<{ pid: number }>()
const section = ref('work-manage')
const workManageRef = ref<InstanceType<typeof WorkManage> | null>(null)
const workStandardRef = ref<InstanceType<typeof WorkStandard> | null>(null)
const positionManageRef = ref<InstanceType<typeof PositionManage> | null>(null)
const sectionOptions = [
  { label: '工作管理', value: 'work-manage' },
  { label: '工作标准', value: 'work-standard' },
  { label: '岗位管理', value: 'position-manage' },
  { label: '人员调配', value: 'staff-dispatch' },
]
function handleCreate() {
  if (section.value === 'work-manage') workManageRef.value?.openCreate()
  else if (section.value === 'work-standard') workStandardRef.value?.openCreate()
  else if (section.value === 'position-manage') positionManageRef.value?.openCreate()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-4 py-2 bg-white border-b">
      <a-select v-model:value="section" size="small" class="w-32" :options="sectionOptions" />
      <a-button v-if="section !== 'staff-dispatch'" type="primary" size="small" @click="handleCreate"><PlusOutlined /> 创建</a-button>
    </div>
    <div class="flex-1 overflow-y-auto">
      <WorkManage v-if="section === 'work-manage'" :pid="props.pid" ref="workManageRef" />
      <WorkStandard v-else-if="section === 'work-standard'" :pid="props.pid" ref="workStandardRef" />
      <PositionManage v-else-if="section === 'position-manage'" :pid="props.pid" ref="positionManageRef" />
      <StaffDispatch v-else :pid="props.pid" />
    </div>
  </div>
</template>
