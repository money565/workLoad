<script setup lang="ts">
import { useUserStore } from '@/stores/counter'

const userStore = useUserStore()
</script>

<template>
  <div>
    <a-card v-if="userStore.loginReady" title="工作负载">
      <p>{{ userStore.userInfo.username }}，欢迎</p>
    </a-card>
    <a-spin v-else tip="登录中...">
      <div style="height: 80px" />
    </a-spin>
  </div>
</template>
