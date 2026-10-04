/**
 * 主题服务 —— 日间 / 夜间 / 跟随系统
 * 夜间通过 html[data-theme='dark'] 覆盖 style.css 中的调色板变量,
 * 全站工具类与组件层基于这些变量,切换后整体换肤。
 */
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** 浏览器 chrome(地址栏 / PWA 标题栏)的颜色 —— 得跟页面底色走,暗色玩家不该看到亮米色衬底 */
const THEME_CHROME = { light: '#F3EFE4', dark: '#211F1C' } as const

function syncChromeColor(dark: boolean): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = dark ? THEME_CHROME.dark : THEME_CHROME.light
}

/** 首帧主题锁(仅显式选择):index.html 的内联脚本在绘制前读它定暗/亮 ——
 * 存档分片是加密的,首帧读不到;主题偏好不是敏感数据,单独落一枚不加密小键。
 * auto 不写(首帧按系统偏好走);键字面量与 head 内联脚本同一枚。 */
const BOOT_THEME_KEY = 'xuanshu.boot-theme'
function syncBootTheme(theme: 'auto' | 'light' | 'dark'): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (theme === 'auto') localStorage.removeItem(BOOT_THEME_KEY)
    else localStorage.setItem(BOOT_THEME_KEY, theme)
  } catch {
    /* 存/取不到就算了(隐私模式/空间满):首帧退回按系统偏好 */
  }
}

export function applyTheme(theme: 'auto' | 'light' | 'dark'): void {
  const dark = theme === 'dark' || (theme === 'auto' && typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(DARK_QUERY).matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  syncChromeColor(dark)
  syncBootTheme(theme)
}

type ThemeMode = 'auto' | 'light' | 'dark'

/** 挂载主题:立即应用一次,并监听系统深浅切换(auto 模式下实时跟随) */
export function initTheme(getTheme: () => ThemeMode): () => void {
  const noop = (): void => undefined
  applyTheme(getTheme())
  if (typeof globalThis.matchMedia !== 'function') return noop
  const mq = globalThis.matchMedia(DARK_QUERY)
  const onChange = (): void => {
    if (getTheme() === 'auto') applyTheme('auto')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
