<script setup lang="ts">
const props = defineProps<{ pid: number }>()

interface EmpItem { id: number; name: string; depName: string; posit: string; mobile: string; avatar: string; userid: string; state: number }
const empList = ref<EmpItem[]>([])
const empLoading = ref(false)

async function fetchEmployees() {
  const pid = props.pid
  if (!pid || pid === -1) { empLoading.value = false; return }
  empLoading.value = true
  try {
    const res = await fetch(`/api/workLoad/empListByProject/${pid}`).then(r => r.json())
    if (res.code === 200) empList.value = res.result
  } catch { /* ignore */ }
  finally { empLoading.value = false }
}

fetchEmployees()
watch(() => props.pid, () => fetchEmployees())
</script>

<template>
  <a-spin :spinning="empLoading">
    <div v-if="empList.length === 0" class="flex-center py-16">
      <a-empty description="暂无人员数据" />
    </div>
    <div
      v-for="e in empList"
      :key="e.id"
      class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white"
    >
      <a-avatar :src="e.avatar" :size="40" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold truncate">{{ e.name }}</div>
        <div class="text-xs text-gray-400 truncate">{{ e.depName }} · {{ e.posit }}</div>
      </div>
      <a-tag :color="e.state === 0 ? 'green' : 'red'" size="small">{{ e.state === 0 ? '在职' : '离职' }}</a-tag>
    </div>
  </a-spin>
</template>
