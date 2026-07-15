import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  darkMode: 'class', // 通过 html.dark 切换暗色模式
  presets: [
    presetUno(),
    presetAttributify(), // 支持属性化写法 <div m-2 p-4>
    presetIcons({
      scale: 1.2,
    }),
  ],
  shortcuts: {
    // 快捷组合
    'btn': 'px-4 py-2 rounded inline-block cursor-pointer transition-colors',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600',
    'btn-danger': 'btn bg-red-500 text-white hover:bg-red-600',
    'mobile-page': 'min-h-screen bg-gray-100',
    'pc-page': 'min-h-screen bg-[#f0f2f5]',
    'flex-center': 'flex items-center justify-center',
    'text-ellipsis': 'overflow-hidden text-ellipsis whitespace-nowrap',
  },
  theme: {
    colors: {
      primary: '#1677ff',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
    },
  },
  // 安全列表：确保动态生成的 class 也被编译
  safelist: ['i-mdi-home', 'i-mdi-account', 'i-mdi-cog'],
})
