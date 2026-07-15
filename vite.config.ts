import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import UnoCSS from 'unocss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/workload/',
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    UnoCSS(),
    AutoImport({
      // Auto-import Vue Composition API, Vue Router, Pinia
      imports: [
        'vue',
        'vue-router',
        {
          pinia: ['defineStore', 'storeToRefs', 'acceptHMRUpdate'],
        },
      ],
      // Generate TypeScript declaration for auto-imports
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      // Automatically register components from src/components/
      dirs: ['src/components'],
      // Allow subdirectory resolution (e.g. src/components/foo/Bar.vue → <FooBar />)
      directoryAsNamespace: true,
      // Generate TypeScript declaration for component auto-imports
      dts: 'src/components.d.ts',
      // Ant Design Vue 组件自动按需导入
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // 手动引入样式，避免按需样式冲突
        }),
      ],
    }),
  ],
  server: {
    host: true, // 监听所有网络接口，允许通过 IP 地址访问
    proxy: {
      '/publicMesg': {
        target: 'https://www.cdxcwy.cn',
        changeOrigin: true,
      },
      '/api': {
        target: 'https://www.cdxcwy.cn',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
