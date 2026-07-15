<script setup lang="ts">
interface TreeNodeData { id: number; label: string; children?: TreeNodeData[] }
defineProps<{ node: TreeNodeData; currentId: number; expandedNodes: Set<number> }>()
const emit = defineEmits<{ toggle: [id: number]; select: [node: { id: number; label: string }] }>()
</script>

<template>
  <div>
    <div class="flex items-center py-2 px-1 border-b border-gray-50" :style="{ paddingLeft: '4px' }">
      <span v-if="node.children && node.children.length > 0" class="w-6 text-center text-gray-400 cursor-pointer shrink-0" @click="emit('toggle', node.id)">{{ expandedNodes.has(node.id) ? '▼' : '▶' }}</span>
      <span v-else class="w-6 shrink-0" />
      <span class="flex-1 cursor-pointer text-sm" :class="{ 'text-blue-500 font-bold': node.id === currentId }" @click="emit('select', node)">{{ node.label }}</span>
    </div>
    <div v-if="node.children && expandedNodes.has(node.id)" style="margin-left: 16px">
      <TreeNode v-for="child in node.children" :key="child.id" :node="child" :current-id="currentId" :expanded-nodes="expandedNodes" @toggle="emit('toggle', $event)" @select="emit('select', $event)" />
    </div>
  </div>
</template>
