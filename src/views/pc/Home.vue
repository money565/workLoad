<script setup lang="ts">
import {
  TeamOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons-vue'

// 统计数据（后续从后端接口获取）
const stats = [
  { title: '总员工数', value: 0, icon: TeamOutlined, color: 'bg-blue-50 text-blue-500' },
  { title: '项目数', value: 0, icon: ProjectOutlined, color: 'bg-green-50 text-green-500' },
  { title: '本月已完成', value: 0, icon: CheckCircleOutlined, color: 'bg-cyan-50 text-cyan-500' },
  { title: '待处理', value: 5, icon: ClockCircleOutlined, color: 'bg-orange-50 text-orange-500' },
]

const columns = [
  { title: '序号', dataIndex: 'id', key: 'id', width: 60 },
  { title: '事项', dataIndex: 'title', key: 'title' },
  { title: '发起人', dataIndex: 'from', key: 'from', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '时间', dataIndex: 'time', key: 'time', width: 160 },
]

const todoData = [
  { id: 1, title: '2024年Q3 工作量数据待审核', from: '张三', status: '待处理', time: '2024-07-10 14:30' },
  { id: 2, title: '新员工工作量定额配置', from: '李四', status: '待处理', time: '2024-07-09 10:20' },
  { id: 3, title: '项目 HC-2024-008 结项申请', from: '王五', status: '待处理', time: '2024-07-08 16:45' },
  { id: 4, title: '月度考勤异常申诉', from: '赵六', status: '处理中', time: '2024-07-07 09:00' },
]
</script>

<template>
  <div class="flex flex-col h-full space-y-4">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-4 shrink-0">
      <a-card v-for="item in stats" :key="item.title" hoverable>
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-lg flex-center"
            :class="item.color"
          >
            <component :is="item.icon" class="text-2xl" />
          </div>
          <div>
            <div class="text-2xl font-bold text-gray-800">{{ item.value }}</div>
            <div class="text-sm text-gray-500">{{ item.title }}</div>
          </div>
        </div>
      </a-card>
    </div>

    <!-- 待办列表 -->
    <a-card title="待办事项" :bordered="false" class="flex-1 overflow-hidden flex flex-col">
      <template #extra>
        <a-button type="link" size="small">查看全部</a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="todoData"
        :pagination="false"
        :scroll="{ y: 'calc(100vh - 380px)' }"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === '待处理' ? 'orange' : 'blue'">
              {{ record.status }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
