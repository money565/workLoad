<script setup lang="ts">
import { useUserStore } from '@/stores/counter'

const userStore = useUserStore()
const router = useRouter()

onMounted(async () => {
  await userStore.login()
  if (userStore.userRank > 0) {
    router.replace('/mobile/admin')
  } else {
    router.replace('/mobile/employee')
  }
})
</script>

<template>
  <div class="min-h-screen flex-center bg-gray-100">
    <a-spin size="large" tip="加载中..." />
  </div>
</template>
