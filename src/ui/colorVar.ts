/**
 * 语义色引用在 JS 这一侧的两件小事(展示层专用,数据层只交出 `var(--color-x)`)。
 *
 * 一 叠透明度。调色板的变量存的是**完整颜色**(`--color-qing: rgb(44 90 125)`),
 *    所以 `color + '55'` 会拼出 `var(--color-qing)55` —— 非法值,整条声明被浏览器
 *    丢掉,边框与底色静默消失(不报错、不留痕,正是最难查的那类)。斜杠透明度必须
 *    走通道值变量:`rgb(var(--color-qing-rgb) / 0.33)`。
 *
 * 二 兼容非 token 的颜色。有些颜色来自存档里的旧数据或用户导入的文本,拿到的仍是
 *    `#RRGGBB`,那种就照老办法拼十六进制 alpha,别把颜色弄丢。
 */
const TOKEN_RE = /^var\(--color-([a-z0-9-]+)\)$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** 把 `var(--color-x)` / `#RRGGBB` 叠上 0..1 的透明度;认不出来的原样返回 */
export function colorWithAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  const value = color.trim()
  const token = TOKEN_RE.exec(value)
  if (token) return `rgb(var(--color-${token[1]}-rgb) / ${a})`
  if (HEX_RE.test(value)) {
    const byte = Math.round(a * 255)
      .toString(16)
      .padStart(2, '0')
    return `${value}${byte}`
  }
  return value
}
