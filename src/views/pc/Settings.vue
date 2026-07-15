<script setup lang="ts">
const bgColor = ref(localStorage.getItem('app-bg-color') || '#f0f2f5')
const fontSize = ref(Number(localStorage.getItem('app-font-size') || 14))
const textSelectable = ref(localStorage.getItem('app-text-selectable') !== 'false')

const colorOptions = ['#f0f2f5', '#ffffff', '#f5f0e8', '#e8f4f0', '#f0e8f5', '#1a1a2e']

function applyBg() {
  const el = document.querySelector('#app') as HTMLElement
  if (el) el.style.background = bgColor.value
  localStorage.setItem('app-bg-color', bgColor.value)
}

function applyFont() {
  document.documentElement.style.fontSize = `${fontSize.value}px`
  localStorage.setItem('app-font-size', String(fontSize.value))
}

function applyTextSelect() {
  document.documentElement.style.userSelect = textSelectable.value ? '' : 'none'
  localStorage.setItem('app-text-selectable', String(textSelectable.value))
}

onMounted(() => { applyBg(); applyFont(); applyTextSelect() })
</script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="设置" @back="() => $router.back()" />
    <a-card class="flex-1 overflow-y-auto space-y-6">
      <div>
        <div class="font-bold mb-3">背景颜色</div>
        <div class="flex gap-3 flex-wrap">
          <div
            v-for="c in colorOptions" :key="c"
            class="w-10 h-10 rounded-full cursor-pointer border-2"
            :style="{ background: c, borderColor: bgColor === c ? '#1677ff' : '#d9d9d9' }"
            @click="bgColor = c; applyBg()"
          />
        </div>
      </div>
      <a-divider />
      <div>
        <div class="font-bold mb-3">文本选择</div>
        <a-switch v-model:checked="textSelectable" @change="applyTextSelect" checked-children="可选中" un-checked-children="不可选" />
      </div>
      <a-divider />
      <div>
        <div class="font-bold mb-3">字体大小: {{ fontSize }}px</div>
        <div class="flex items-center gap-3">
          <span class="text-xs">小</span>
          <a-slider v-model:value="fontSize" :min="12" :max="20" :step="1" class="flex-1" @change="applyFont" />
          <span class="text-base">大</span>
        </div>
        <div class="mt-2 p-3 rounded" :style="{ background: bgColor }">
          <span :style="{ fontSize: `${fontSize}px` }">预览文字效果</span>
        </div>
      </div>
    </a-card>
  </div>
</template>
