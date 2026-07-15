<script setup lang="ts">
import { searchManager, type EmployeeItem } from '@/axios/interface'

const value = ref<number | undefined>(undefined)
const options = ref<{ label: string; value: number; item: EmployeeItem }[]>([])
const loading = ref(false)

async function handleSearch(keyword: string) {
  if (!keyword.trim()) {
    options.value = []
    return
  }
  loading.value = true
  try {
    const res = await searchManager({ k: keyword.trim(), pid: -1 })
    if (res.code === 200) {
      options.value = res.result.map(item => ({
        label: item.title, // "姓名-部门-职位"
        value: item.id,
        item,
      }))
    }
  } catch {
    console.warn('搜索失败')
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header
      class="shrink-0"
      title="员工详情"
      @back="() => $router.back()"
    />
    <a-card>
      <a-select
        v-model:value="value"
        show-search
        size="large"
        class="w-full"
        placeholder="输入姓名搜索..."
        :filter-option="false"
        :loading="loading"
        :options="options"
        :not-found-content="loading ? undefined : null"
        @search="handleSearch"
      />
    </a-card>
  </div>
</template>
