<script setup lang="ts">
import html2canvas from 'html2canvas'

const props = defineProps<{ items: { group_key: string; name: string }[] }>()
const visible = defineModel<boolean>({ default: false })

const paperSizes = [
  { label: 'A4 (210×297mm)', width: 210, height: 297 },
  { label: 'A3 (297×420mm)', width: 297, height: 420 },
]
const paperIndex = ref(0)
const qrSize = ref(40)
const titleSize = ref(10)
const colGap = ref(5)
const rowGap = ref(5)
const loading = ref(false)
const qrCodes = ref<{ url: string; name: string }[]>([])
const previewRef = ref<HTMLElement>()

const paperPreview = computed(() => {
  const p = paperSizes[paperIndex.value]!
  const maxW = 580
  const maxH = 480
  let w = p.width * 2.2
  let h = p.height * 2.2
  if (h > maxH) {
    const r = maxH / h
    w *= r
    h = maxH
  }
  if (w > maxW) w = maxW
  return { width: Math.round(w), height: Math.round(h) }
})

const moduleWidth = computed(() => qrSize.value + 16)

function generateQRCodes() {
  loading.value = true
  const list: { url: string; name: string }[] = []
  const size = qrSize.value * 3
  const base = window.location.origin
  for (const d of props.items) {
    const url = `${base}/#/mobile/scan-work?group_key=${d.group_key}`
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=2`
    list.push({ url: qr, name: d.name })
  }
  qrCodes.value = list
  loading.value = false
}

watch(
  () => [qrSize.value, titleSize.value],
  () => generateQRCodes(),
)
watch(visible, (v) => {
  if (v) generateQRCodes()
})

async function handleExportPNG() {
  const el = previewRef.value
  if (!el) return
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '二维码导出.png'
    a.click()
    URL.revokeObjectURL(url)
  })
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    title="导出二维码"
    width="920px"
    :body-style="{ height: '560px' }"
  >
    <div class="flex gap-4" style="height: 100%">
      <div class="flex flex-col gap-3 p-4 bg-gray-50 rounded shrink-0" style="width: 240px">
        <div class="text-sm font-bold">纸张选择</div>
        <a-select v-model:value="paperIndex" size="small">
          <a-select-option v-for="(p, i) in paperSizes" :key="i" :value="i">{{
            p.label
          }}</a-select-option>
        </a-select>
        <div class="text-sm font-bold mt-1">二维码大小</div>
        <div class="flex items-center gap-2">
          <a-slider v-model:value="qrSize" :min="10" :max="200" :step="5" class="flex-1" />
          <span class="text-xs w-12 text-right">{{ qrSize }}px</span>
        </div>
        <div class="text-sm font-bold mt-1">标题字号</div>
        <div class="flex items-center gap-2">
          <a-slider v-model:value="titleSize" :min="5" :max="30" :step="1" class="flex-1" />
          <span class="text-xs w-12 text-right">{{ titleSize }}px</span>
        </div>
        <div class="text-sm font-bold mt-1">列间距</div>
        <div class="flex items-center gap-2">
          <a-slider v-model:value="colGap" :min="5" :max="60" :step="2" class="flex-1" />
          <span class="text-xs w-12 text-right">{{ colGap }}px</span>
        </div>
        <div class="text-sm font-bold mt-1">行间距</div>
        <div class="flex items-center gap-2">
          <a-slider v-model:value="rowGap" :min="5" :max="60" :step="2" class="flex-1" />
          <span class="text-xs w-12 text-right">{{ rowGap }}px</span>
        </div>
      </div>
      <div class="flex-1 flex items-start justify-center overflow-auto">
        <div
          ref="previewRef"
          class="paper-preview"
          :style="{
            width: `${paperPreview.width}px`,
            minHeight: `${paperPreview.height}px`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: `${rowGap}px ${colGap}px`,
            justifyContent: 'flex-start',
            alignContent: 'flex-start',
            padding: '20px',
            background: '#fff',
          }"
        >
          <div v-if="loading" class="flex-center w-full h-full">
            <a-spin />
          </div>
          <div
            v-for="(item, i) in qrCodes"
            :key="i"
            class="qr-module"
            :style="{
              width: `${moduleWidth}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }"
          >
            <img
              :src="item.url"
              :style="{ width: `${qrSize}px`, height: `${qrSize}px` }"
              alt="QR"
            />
            <div
              :style="{
                fontSize: `${titleSize}px`,
                fontWeight: 'bold',
                textAlign: 'center',
                lineHeight: 1.2,
                wordBreak: 'break-all',
              }"
            >
              {{ item.name }}
            </div>
            <div
              :style="{
                fontSize: `${Math.max(titleSize - 2, 6)}px`,
                color: '#666',
                textAlign: 'center',
                lineHeight: 1.2,
              }"
            >
              工作明细
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <a-button @click="visible = false">关闭</a-button>
      <a-button type="primary" @click="handleExportPNG">导出PNG</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.paper-preview {
  border: 1px solid #ddd;
  border-radius: 2px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  transition:
    width 0.3s,
    height 0.3s;
}
.qr-module {
  break-inside: avoid;
}
</style>
