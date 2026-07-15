// 移动端调试工具，仅在开发环境启用
// 钉钉内置浏览器无法查看 console，vConsole 提供悬浮调试面板
import VConsole from 'vconsole'

export function initVConsole() {
  if (import.meta.env.DEV) {
    new VConsole({
      defaultPlugins: ['system', 'network', 'element', 'storage'],
      maxLogNumber: 5000,
    })
  }
}
