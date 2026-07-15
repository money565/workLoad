<script setup lang="ts">
import { useUserStore } from '@/stores/counter'
import { LoginOutlined } from '@ant-design/icons-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const userStore = useUserStore()
const logging = ref(true)
const notLoggedIn = ref(false)
const loginLoading = ref(false)

async function doLogin() {
  loginLoading.value = true
  try {
    const res = await userStore.login() as { result: boolean; mesg: string } | undefined
    notLoggedIn.value = !res || !res.result
  } catch {
    notLoggedIn.value = true
  } finally {
    loginLoading.value = false
  }
}

onMounted(async () => {
  await doLogin()
  logging.value = false
})
</script>

<template>
  <a-config-provider :locale="zhCN">
    <div v-if="logging" class="min-h-screen flex-center bg-gray-50 dark:bg-gray-950">
      <a-spin size="large" tip="正在登录..." />
    </div>
    <div
      v-else-if="notLoggedIn"
      class="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-6"
    >
      <img src="/favicon.ico" class="h-16 w-16" />
      <h2 class="text-2xl font-bold text-gray-700">细川量化工作</h2>
      <p class="text-gray-500">请点击下方按钮登录</p>
      <a-button
        type="primary"
        size="large"
        :loading="loginLoading"
        @click="doLogin"
      >
        <template #icon><LoginOutlined /></template>
        钉钉免登
      </a-button>
    </div>
    <router-view v-else />
  </a-config-provider>
</template>
