<script setup lang="ts">
import { LoadingOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useUpload } from '@/composables/useUpload'

const props = defineProps<{ modelValue?: string; title?: string }>()
const emit = defineEmits(['update:modelValue'])

const { initCos, upload, remove, generatePath } = useUpload()
const loading = ref(false)
const ready = ref(false)

onMounted(() => { initCos().then(() => { ready.value = true }) })

async function handleUpload(file: File) {
  loading.value = true
  try {
    const key = generatePath(`${Date.now()}_${file.name}`, 'workload')
    const url = await upload(file, key)
    emit('update:modelValue', url)
    message.success('上传成功')
  } catch { /* handled in upload */ }
  finally { loading.value = false }
}

async function handleRemove() {
  if (props.modelValue) {
    const key = props.modelValue.split('/').slice(-3).join('/')
    try { await remove(key) } catch { /* ignore */ }
  }
  emit('update:modelValue', '')
}
</script>

<template>
  <div>
    <a-upload
      name="file"
      list-type="picture-card"
      :show-upload-list="false"
      :before-upload="(f: File) => { handleUpload(f); return false }"
    >
      <div v-if="modelValue" class="relative">
        <img :src="modelValue" class="w-24 h-24 object-cover rounded" />
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition rounded">
          <DeleteOutlined class="text-white text-lg cursor-pointer" @click.stop="handleRemove" />
        </div>
      </div>
      <div v-else class="w-24 h-24 flex flex-col items-center justify-center text-gray-400">
        <LoadingOutlined v-if="loading" />
        <PlusOutlined v-else />
        <span class="text-xs mt-1">{{ title || '上传' }}</span>
      </div>
    </a-upload>
  </div>
</template>
