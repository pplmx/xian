/**
 * 调色板判据
 *
 * 颜色只有一份事实源(`src/style.css` 的语义色变量 + `tailwind.config.js` 的转发),
 * 界面与数据层一律引用变量。这几条判据盯的是四类只在"改颜色"时才现形的事故:
 *
 * 一 **两处对不上**:tailwind 配了、CSS 变量没定义(或反过来),产物里那类名不生成,
 *    而模板照写不误 —— 改配置不生效就是这么来的。
 * 二 **同值异名**:两个 token 是同一个 RGB(`azure`/`qinghua` 曾经如此),其中必有一个
 *    是没人记得的死 token;改配色时改一个漏一个,两处就不是一个颜色了。
 * 三 **裸 hex 回流**:颜色手抄进数据层(`qualities`/`souls`/`linggen`/`talents` 曾经
 *    各抄一份),换肤换不到它,漂了也不报错。故数据层禁裸 hex。
 * 四 **小字读不清**:颜色在纸上的对比度。达标的一档记在 `AA_OK` 里,没达标的记在
 *    `DEBT` 里 —— 两个名单都不许悄悄变:新加一个不达标颜色会当场红,修好一档却忘
 *    从名单里划掉也会红(那份名单就是账目,不能记账不实)。
 *
 * 另有两处手抄关系单独核:浏览器 chrome 色(`core/theme.ts`)与独立成篇的
 * `public/privacy.html` —— 它们不能引用 CSS 变量,只能抄,故用判据代替人眼。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const CSS = readFileSync(resolve(ROOT, 'src/style.css'), 'utf-8')
const TAILWIND = readFileSync(resolve(ROOT, 'tailwind.config.js'), 'utf-8')
const THEME_TS = readFileSync(resolve(ROOT, 'src/core/theme.ts'), 'utf-8')
const PRIVACY = readFileSync(resolve(ROOT, 'public/privacy.html'), 'utf-8')

type Rgb = readonly [number, number, number]

function bodyOf(scope: RegExp): string {
  const body = scope.exec(CSS)?.[1]
  if (body === undefined) throw new Error('style.css 里找不到这段作用域')
  return body
}

/**
 * 语义色 token 名单 —— 以**浅色那份**为准:它既定义通道值、又派生出完整颜色。
 * `--color-paper-lifted-rgb` 这类只有通道值的中间量(给阴影与 color-mix 用)不算 token,
 * 故要求同作用域里存在 `--color-x: rgb(var(--color-x-rgb))` 才算。
 */
function tokenNames(): Set<string> {
  return new Set([...bodyOf(/:root \{([\s\S]*?)\n\}/).matchAll(/--color-([a-z0-9-]+):\s*rgb\(var\(--color-[a-z0-9-]+-rgb\)\)/g)].map(m => m[1]!))
}

/** 某个作用域里的通道值;暗色那份不重复派生声明,故不要求它自带完整颜色 */
function paletteOf(scope: RegExp, names: Set<string>): Map<string, Rgb> {
  const out = new Map<string, Rgb>()
  for (const m of bodyOf(scope).matchAll(/--color-([a-z0-9-]+)-rgb:\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    if (names.has(m[1]!)) out.set(m[1]!, [Number(m[2]), Number(m[3]), Number(m[4])] as const)
  }
  return out
}

const TOKENS = tokenNames()
const LIGHT = paletteOf(/:root \{([\s\S]*?)\n\}/, TOKENS)
const DARK = paletteOf(/html\[data-theme='dark'\] \{([\s\S]*?)\n\}/, TOKENS)

/** 纯底色:它们不承载文字,自然不参与对比度考核 */
const SURFACES = new Set(['paper', 'paper-deep', 'paper-dark'])

function channel(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** 一档颜色在它那套主题的两张纸上的最差对比度(界面承载文字的底色只有这两张) */
function worstContrast(name: string, theme: 'light' | 'dark'): number {
  const p = theme === 'light' ? LIGHT : DARK
  const color = p.get(name)!
  return Math.min(contrast(color, p.get('paper')!), contrast(color, p.get('paper-deep')!))
}

function hueOf([r, g, b]: Rgb): number {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  if (d === 0) return 0
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return (h * 60 + 360) % 360
}

/**
 * 承载小字(10-14px)且已达 WCAG AA 4.5:1 的那一档 —— 只许增,不许减。
 * 减了就是把一个读得清的颜色改糊了。
 */
const AA_OK = ['ink', 'ink-soft', 'qing', 'indigo-ink'] as const

/**
 * 还没达标的账目:token → 在哪套主题下不达标(数字是写下这条时的实测最差比值)。
 * 名单必须与实测**完全一致**:修好一档就得从这里划掉,新欠一档就会红。
 * 这一批集中在"浅色系在暖纸上不够深",其中 dark 那三条是暗色主题下朱砂偏暗。
 */
const DEBT: Record<string, { theme: 'light' | 'dark' | 'both'; worst: number }> = {
  'ink-faint': { theme: 'light', worst: 3.14 },
  'ink-ghost': { theme: 'both', worst: 1.66 },
  'cinnabar': { theme: 'dark', worst: 3.51 },
  'cinnabar-deep': { theme: 'dark', worst: 4.29 },
  'jade': { theme: 'light', worst: 2.95 },
  'gold-ink': { theme: 'light', worst: 3.14 },
  'violet-ink': { theme: 'light', worst: 4.13 },
  'amber-ink': { theme: 'light', worst: 2.84 },
  zheshi: { theme: 'light', worst: 3.87 },
  tenghuang: { theme: 'light', worst: 1.9 },
  bise: { theme: 'light', worst: 3.04 },
  he: { theme: 'light', worst: 3.71 },
  cangqing: { theme: 'light', worst: 2.96 },
  tianqing: { theme: 'light', worst: 2.54 }
}

describe('调色板 · 一份事实源', () => {
  it('明暗两套主题的 token 一一对应(暗色只覆盖通道值,不许只在一边定义)', () => {
    expect([...DARK.keys()].sort()).toEqual([...LIGHT.keys()].sort())
  })

  it('每个 token 都在 tailwind 里有对应的语义色,且 tailwind 不留没定义的 token', () => {
    const declared = new Set([...TAILWIND.matchAll(/withAlpha\('--color-([a-z0-9-]+)-rgb'\)/g)].map(m => m[1]!))
    expect([...[...LIGHT.keys()]].sort()).toEqual([...declared].sort())
  })

  it('没有"同值异名"的两个 token(历史上 azure 与 qinghua 就是同一个 RGB)', () => {
    for (const [theme, p] of [
      ['light', LIGHT],
      ['dark', DARK]
    ] as const) {
      const seen = new Map<string, string>()
      for (const [name, rgb] of p) {
        const key = rgb.join(' ')
        const prev = seen.get(key)
        expect(prev, `${theme} 主题下 ${name} 与 ${prev} 是同一个颜色`).toBeUndefined()
        seen.set(key, name)
      }
    }
  })

  it('数据层不再出现裸 hex —— 颜色一律走语义色变量', () => {
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.ts$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
          const text = readFileSync(path, 'utf-8')
          for (const m of text.matchAll(/['"`]#[0-9a-fA-F]{3,8}['"`]/g)) offenders.push(`${path.slice(ROOT.length + 1)} → ${m[0]}`)
        }
      }
    }
    walk(resolve(ROOT, 'src/data'))
    expect(offenders).toEqual([])
  })
})

describe('调色板 · 青', () => {
  it('青在色板上,色相落在青的带里(180-220°)—— 不是灰蓝,也不是西式蓝', () => {
    expect(LIGHT.has('qing')).toBe(true)
    const hue = hueOf(LIGHT.get('qing')!)
    expect(hue).toBeGreaterThanOrEqual(180)
    expect(hue).toBeLessThanOrEqual(220)
  })

  it('两套主题下都过 AA —— 青要扛 10-11px 的小字', () => {
    expect(worstContrast('qing', 'light')).toBeGreaterThanOrEqual(4.5)
    expect(worstContrast('qing', 'dark')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('调色板 · 小字对比度账目', () => {
  it('达标的确实达标', () => {
    for (const name of AA_OK) {
      if (!LIGHT.has(name) || !DARK.has(name)) throw new Error(`${name} 不在色板上`)
      for (const theme of ['light', 'dark'] as const) {
        const worst = worstContrast(name, theme)
        expect(worst, `${name}@${theme} 实测 ${worst.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('没达标的账目与实测完全对得上(修好一档要划掉,欠一档会红)', () => {
    const failures = new Map<string, 'light' | 'dark' | 'both'>()
    for (const name of LIGHT.keys()) {
      if (SURFACES.has(name)) continue
      const light = worstContrast(name, 'light') < 4.5
      const dark = worstContrast(name, 'dark') < 4.5
      if (light || dark) failures.set(name, light && dark ? 'both' : light ? 'light' : 'dark')
    }
    const accounted = Object.fromEntries(Object.entries(DEBT).map(([k, v]) => [k, v.theme]))
    expect(Object.fromEntries(failures)).toEqual(accounted)
  })

  it('账目里的最差比值与实测一致(差得太多说明颜色动过,该重算这条注释)', () => {
    for (const [name, entry] of Object.entries(DEBT)) {
      const worst = Math.min(worstContrast(name, 'light'), worstContrast(name, 'dark'))
      expect(Math.abs(worst - entry.worst), `${name} 记 ${entry.worst},实测 ${worst.toFixed(2)}`).toBeLessThan(0.02)
    }
  })
})

describe('调色板 · 两处手抄关系', () => {
  it('浏览器 chrome 色跟的是纸色', () => {
    const m = /const THEME_CHROME = \{ light: '(#[0-9A-Fa-f]{6})', dark: '(#[0-9A-Fa-f]{6})' \}/.exec(THEME_TS)
    expect(m, 'core/theme.ts 里的 THEME_CHROME 变了形状,判据要跟着改').toBeTruthy()
    const hex = (rgb: Rgb): string => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    expect(m![1]!.toUpperCase()).toBe(hex(LIGHT.get('paper')!))
    expect(m![2]!.toUpperCase()).toBe(hex(DARK.get('paper')!))
  })

  it('public/privacy.html 手抄的那几个颜色与色板一致', () => {
    const body = /:root \{([\s\S]*?)\n {6}\}/.exec(PRIVACY)?.[1]
    expect(body, 'privacy.html 的色板块变了形状,判据要跟着改').toBeTruthy()
    const copied = [...body!.matchAll(/--([a-z-]+):\s*rgb\((\d+) (\d+) (\d+)\)/g)]
    expect(copied.length).toBeGreaterThan(5)
    for (const [, name, r, g, b] of copied) {
      const token = name!
      const mine = LIGHT.get(token)
      expect(mine, `privacy.html 抄了 --${token},色板上没有这个 token`).toBeTruthy()
      expect([Number(r), Number(g), Number(b)]).toEqual([...mine!])
    }
  })
})
