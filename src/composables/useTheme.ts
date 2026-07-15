import { theme as antdTheme } from 'ant-design-vue'

type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'workload-theme'

const currentTheme = ref<ThemeMode>(
  (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light',
)

export function useTheme() {
  const isDark = computed(() => currentTheme.value === 'dark')

  const antdAlgorithm = computed(() =>
    isDark.value ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  )

  function toggle() {
    currentTheme.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, currentTheme.value)
    applyHtmlClass()
  }

  function setTheme(mode: ThemeMode) {
    currentTheme.value = mode
    localStorage.setItem(THEME_KEY, mode)
    applyHtmlClass()
  }

  function applyHtmlClass() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 初始化时应用
  applyHtmlClass()

  return {
    currentTheme,
    isDark,
    antdAlgorithm,
    toggle,
    setTheme,
  }
}
