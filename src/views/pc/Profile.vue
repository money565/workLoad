<script setup lang="ts">
import { UserOutlined, PhoneOutlined, HomeOutlined, IdcardOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/counter'

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const permRank = ref<number | null>(null)

onMounted(async () => {
  if (userInfo.value.userid) {
    try {
      const res = await fetch(`/api/workLoad/permission/${userInfo.value.userid}`).then(r => r.json())
      if (res.code === 200) permRank.value = res.rank || 0
    } catch { permRank.value = null }
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-4">
    <a-page-header title="个人中心" @back="() => $router.back()" />

    <a-card>
      <div class="flex items-center gap-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <a-avatar :size="80" :src="userInfo.avatar">
          <template #icon><UserOutlined /></template>
        </a-avatar>
        <div>
          <h2 class="text-2xl font-bold mb-1">{{ userInfo.username }}</h2>
          <a-tag color="blue">{{ userInfo.position }}</a-tag>
        </div>
      </div>

      <div class="mt-6 space-y-4">
        <div class="flex items-center gap-3 text-sm">
          <IdcardOutlined class="text-gray-400 text-lg" />
          <span class="text-gray-500 w-16">UserID</span>
          <span class="font-mono">{{ userInfo.userid }}</span>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <HomeOutlined class="text-gray-400 text-lg" />
          <span class="text-gray-500 w-16">部门</span>
          <span>{{ userInfo.position || '—' }}</span>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <PhoneOutlined class="text-gray-400 text-lg" />
          <span class="text-gray-500 w-16">手机号</span>
          <span>{{ userInfo.depart || '—' }}</span>
        </div>
      </div>
    </a-card>

    <a-card title="账号信息">
      <a-descriptions :column="1" size="small">
        <a-descriptions-item label="用户等级">
          <a-tag v-if="permRank !== null" :color="permRank >= 3 ? 'red' : permRank >= 1 ? 'blue' : ''">{{ permRank }}级</a-tag>
          <span v-else class="text-gray-400">无登记</span>
        </a-descriptions-item>
        <a-descriptions-item label="部门ID">{{ userInfo.depid }}</a-descriptions-item>
        <a-descriptions-item label="部门">{{ userInfo.position }}</a-descriptions-item>
        <a-descriptions-item label="职位">{{ userInfo.mobile }}</a-descriptions-item>
        <a-descriptions-item label="手机号">{{ userInfo.depart }}</a-descriptions-item>
        <a-descriptions-item label="Token">
          <a-tooltip :title="userInfo.token">
            <span class="text-gray-400 cursor-pointer">{{ userInfo.token?.slice(0, 20) }}...</span>
          </a-tooltip>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>
