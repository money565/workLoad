<script setup lang="ts">
import { message } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/counter'
import { useAppCacheStore } from '@/stores/appCache'

const userStore = useUserStore()
const appCache = useAppCacheStore()
const loading = ref(false)
const dataSource = ref<{ id: number; name: string; depName: string; userid: string; rank: number; permission_id: number | null }[]>([])
const keyword = ref('')

const myRank = computed(() => userStore.userRank)

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
  { title: '部门', dataIndex: 'depName', key: 'dep', width: 160 },
  { title: '级别', key: 'rank', width: 100 },
  { title: '操作', key: 'action', width: 180 },
]

async function fetchData() {
  loading.value = true
  try {
    const kw = keyword.value.trim()
    const pid = appCache.currentProject
    const res = await fetch(`/api/workLoad/permissions?kw=${kw}&pid=${pid}`).then(r => r.json())
    if (res.code === 200) dataSource.value = res.result
  } catch { message.error('获取失败') }
  finally { loading.value = false }
}

async function setRank(uid: string, rank: number) {
  try {
    const res = await fetch('/api/workLoad/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: uid, rank, my_userid: userStore.userInfo.userid }),
    }).then(r => r.json())
    if (res.code === 200) { message.success('设置成功'); fetchData() }
    else message.error(res.msg || '设置失败')
  } catch { message.error('请求失败') }
}

async function removeRank(uid: string) {
  try {
    await fetch('/api/workLoad/permissions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: uid }),
    })
    message.success('已移除'); fetchData()
  } catch { message.error('操作失败') }
}

watch([keyword, () => appCache.currentProject], () => { fetchData() }, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="用户管理" :sub-title="appCache.currentProjectName" @back="() => $router.back()">
      <template #extra>
        <span class="text-sm text-gray-500">我的等级: {{ myRank }}级</span>
      </template>
    </a-page-header>
    <a-card class="flex-1 overflow-hidden flex flex-col">
      <div class="mb-3">
        <a-input v-model:value="keyword" placeholder="搜索姓名" allow-clear>
          <template #prefix><SearchOutlined /></template>
        </a-input>
      </div>
      <a-table
        :columns="columns" :data-source="dataSource" :loading="loading"
        :pagination="{ pageSize: 30 }" :scroll="{ y: 'calc(100vh - 380px)' }"
        row-key="id" size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'rank'">
            <a-tag v-if="record.rank >= 0" :color="record.rank >= 3 ? 'red' : record.rank >= 1 ? 'blue' : ''">{{ record.rank }}级</a-tag>
            <span v-else class="text-gray-400">未设置</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                v-for="r in [0,1,2]" :key="r"
                v-show="myRank > r && record.rank < myRank"
                size="small"
                :type="record.rank === r ? 'primary' : 'default'"
                :disabled="record.rank === r"
                @click="setRank(record.userid, r)"
              >{{ r }}级</a-button>
              <a-button
                v-if="record.rank === 3 && myRank > 3"
                size="small"
                @click="setRank(record.userid, 3)"
              >3级</a-button>
              <a-button v-if="record.rank >= 0 && myRank > record.rank" size="small" danger @click="removeRank(record.userid)">移除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
