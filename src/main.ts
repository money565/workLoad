import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'virtual:uno.css'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

dayjs.locale('zh-cn')

// 全局覆盖 Ant Design Vue 默认为中文
import { message, Modal, notification } from 'ant-design-vue'
message.config({ top: '50px' })

import App from './App.vue'
import router from './router'
import { initVConsole } from './plugins/vconsole'

// 开发环境下启用移动端调试面板（钉钉内置浏览器无 DevTools）
initVConsole()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
