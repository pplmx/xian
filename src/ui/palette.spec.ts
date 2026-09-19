/**
 * 调色板判据
 *
 * 颜色只有一份事实源(`src/style.css` 的语义色变量 + `tailwind.config.js` 的转发),
 * 界面与数据层一律引用变量。判据盯的是五类只在"改颜色"时才现形的事故:
 *
 * 一 **两处对不上**:tailwind 配了、CSS 变量没定义(或反过来),产物里那类名不生成,
 *    而模板照写不误 —— 改配置不生效就是这么来的。
 * 二 **同值异名**:两个 token 是同一个 RGB(`azure`/`qinghua` 曾经如此),其中必有一个
 *    是没人记得的死 token;改配色时改一个漏一个,两处就不是一个颜色了。
 * 三 **裸 hex 回流**:颜色手抄进数据层(`qualities`/`souls`/`linggen`/`talents` 曾经
 *    各抄一份),换肤换不到它,漂了也不报错。故数据层禁裸 hex。
 * 四 **小字读不清**:每一档颜色按**它自己的角色**过线 ——
 *    承载文字的(增益、品阶名、次级正文)在纸上要 ≥4.5:1;
 *    当印面托奶油字的(深朱)按奶油字 ≥4.5:1 算。两类算法不同,故分开核。
 * 五 **品阶色阶糊成一团**:九档颜色两两要分得开(CIE76 色差),压深之后尤其容易撞。
 *
 * 另有两处手抄关系单独核:浏览器 chrome 色(`core/theme.ts`)与独立成篇的
 * `public/privacy.html` —— 它们不能引用 CSS 变量,只能抄,故用判据代替人眼。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { QUALITIES } from '@/data/qualities'

const ROOT = resolve(__dirname, '../..')
const CSS = readFileSync(resolve(ROOT, 'src/style.css'), 'utf-8')
const TAILWIND = readFileSync(resolve(ROOT, 'tailwind.config.js'), 'utf-8')
const THEME_TS = readFileSync(resolve(ROOT, 'src/core/theme.ts'), 'utf-8')
const PRIVACY = readFileSync(resolve(ROOT, 'public/privacy.html'), 'utf-8')
const INDEX_HTML = readFileSync(resolve(ROOT, 'index.html'), 'utf-8')

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
  return new Set(
    [...bodyOf(/:root \{([\s\S]*?)\n\}/).matchAll(/--color-([a-z0-9-]+):\s*rgb\(var\(--color-[a-z0-9-]+-rgb\)\)/g)].map(m => m[1]!)
  )
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

/**
 * 铺字的底,按主题各算一遍。**卡片那一张是最难的**:夜间主题里卡片
 * (`--color-paper-lifted`)比页面底色亮,浅色的字放上去对比度反而最低 ——
 * 这一档是拿真浏览器量出来的(scripts/layout-check.mjs 的正文对比度那条),
 * 本体只按纸与纸深算时漏了它,量出来 151 144 123 在卡片上只有 4.07:1。
 */
function surfacesOf(theme: 'light' | 'dark'): { name: string; rgb: Rgb }[] {
  const scope = theme === 'light' ? /:root \{([\s\S]*?)\n\}/ : /html\[data-theme='dark'\] \{([\s\S]*?)\n\}/
  const lifted = /--color-paper-lifted-rgb:\s*(\d+)\s+(\d+)\s+(\d+);/.exec(bodyOf(scope))
  const p = theme === 'light' ? LIGHT : DARK
  const card: Rgb = [Number(lifted![1]), Number(lifted![2]), Number(lifted![3])]
  return [
    { name: '纸', rgb: p.get('paper')! },
    { name: '纸深', rgb: p.get('paper-deep')! },
    { name: '卡片', rgb: card }
  ]
}

/** 纯底色:它们不承载文字,自然不参与文字对比度考核 */
const SURFACES = new Set(['paper', 'paper-deep', 'paper-dark'])
/** 印面:它当"底"用,上面是固定奶油字(.btn-seal 的 color 写死 #f6f1e5),算法见下 */
const SEAL = 'cinnabar-deep'
/** .btn-seal 上那行固定奶油字,与 style.css 里的字面量必须一致 */
const SEAL_INK: Rgb = [246, 241, 229]
const TEXT_TOKENS = [...LIGHT.keys()].filter(name => !SURFACES.has(name) && name !== SEAL)

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

/**
 * 一档颜色在它那套主题上最难看的那一面。
 *
 * 除了三张底,还要算**自色浅底**:品阶方块那种「底色 = 它自己 6% 的墨」的画法,
 * 会让底色比卡片亮一点(浅色主题)/ 暗一点(暗色主题?) —— 实测是「亮一点」的那一支
 * 更伤对比度,故按 6% 叠一层再核一遍。
 */
function worstSurface(name: string, theme: 'light' | 'dark'): number {
  const color = (theme === 'light' ? LIGHT : DARK).get(name)!
  const surfaces = surfacesOf(theme)
  const card = surfaces.find(s => s.name === '卡片')!.rgb
  const selfTint: Rgb = [0, 1, 2].map(i => Math.round(color[i]! * 0.06 + card[i]! * 0.94)) as unknown as Rgb
  return Math.min(...[...surfaces.map(s => s.rgb), selfTint].map(bg => contrast(color, bg)))
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

/** CIE76 色差 —— 只用来问「两档品阶色是不是糊在一起了」 */
function deltaE(a: Rgb, b: Rgb): number {
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const lab = ([r, g, b]: Rgb): [number, number, number] => {
    const [R, G, B] = [channel(r), channel(g), channel(b)]
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
  }
  const [l1, a1, b1] = lab(a)
  const [l2, a2, b2] = lab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** 数据里的颜色引用 → 它引用的 token 在浅色/暗色下的值(数据只许引用变量) */
function tokenValueOf(colorRef: string, theme: 'light' | 'dark'): Rgb {
  const name = /^var\(--color-([a-z0-9-]+)\)$/.exec(colorRef)?.[1]
  if (name === undefined) throw new Error(`数据层出现了不是变量的颜色:${colorRef}`)
  const value = (theme === 'light' ? LIGHT : DARK).get(name)
  if (!value) throw new Error(`颜色引用了色板上没有的 token:${colorRef}`)
  return value
}

/** 扫源码文本,回报命中的文件(用于"某某名字不该再出现"这类判据) */
function filesMatching(dir: string, pattern: RegExp, ext: RegExp): string[] {
  const hits: string[] = []
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = resolve(d, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (ext.test(entry.name) && !entry.name.endsWith('.spec.ts') && pattern.test(readFileSync(path, 'utf-8'))) {
        hits.push(path.slice(ROOT.length + 1))
      }
    }
  }
  walk(dir)
  return hits
}

describe('调色板 · 一份事实源', () => {
  it('明暗两套主题的 token 一一对应(暗色只覆盖通道值,不许只在一边定义)', () => {
    expect([...DARK.keys()].sort()).toEqual([...LIGHT.keys()].sort())
  })

  it('每个 token 都在 tailwind 里有对应的语义色,且 tailwind 不留没定义的 token', () => {
    const declared = new Set([...TAILWIND.matchAll(/withAlpha\('--color-([a-z0-9-]+)-rgb'\)/g)].map(m => m[1]!))
    expect([...LIGHT.keys()].sort()).toEqual([...declared].sort())
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

describe('调色板 · 承载文字的色都过 AA', () => {
  it('每一档文字色在两套主题、两张纸上都 ≥4.5:1', () => {
    expect(TEXT_TOKENS.length).toBeGreaterThanOrEqual(15)
    const bad: string[] = []
    for (const name of TEXT_TOKENS) {
      for (const theme of ['light', 'dark'] as const) {
        const worst = worstSurface(name, theme)
        if (worst < 4.5) bad.push(`${name}@${theme} ${worst.toFixed(2)}:1`)
      }
    }
    expect(bad, '这些色还在承载 10-14px 的小字,达不到 AA 就别留在文字档上').toEqual([])
  })
})

describe('调色板 · 印面', () => {
  it('深朱当底时,上面那行奶油字照样 ≥4.5:1(两套主题)', () => {
    // 奶油字是 .btn-seal 里写死的字面量:改了色号却忘了这一处,判据要能喊住
    expect(CSS).toMatch(/\.btn-seal \{[^}]*color: #f6f1e5/)
    for (const [theme, p] of [
      ['light', LIGHT],
      ['dark', DARK]
    ] as const) {
      const ratio = contrast(p.get(SEAL)!, SEAL_INK)
      expect(ratio, `${theme} 主题下印面托不住奶油字:${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('印面只当底,不拿去当字色(它在暗色下当字并不达标,靠分工而不是靠运气)', () => {
    expect(filesMatching(resolve(ROOT, 'src'), /text-cinnabar-deep/, /\.(ts|vue)$/)).toEqual([])
  })

  it('暗色主题的印面确实是深的那一枚(亮朱当底会把奶油字压到 2.9:1)', () => {
    expect(CSS).toMatch(/html\[data-theme='dark'\] \.btn-seal \{[^}]*background: var\(--color-cinnabar-deep\)/)
  })
})

describe('调色板 · 纸上的墨只有三档', () => {
  it('ink-ghost 已经撤掉 —— 纸上放不下第四档还能读的字', () => {
    expect(LIGHT.has('ink-ghost')).toBe(false)
    expect(TAILWIND).not.toContain('ink-ghost')
    expect(filesMatching(resolve(ROOT, 'src'), /ink-ghost/, /\.vue$/)).toEqual([])
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
    expect(worstSurface('qing', 'light')).toBeGreaterThanOrEqual(4.5)
    expect(worstSurface('qing', 'dark')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('调色板 · 九品色阶分得开', () => {
  it('任意两档的色差 ≥10 —— 压深之后最容易糊在一起的就是相邻那两档', () => {
    const ladder = QUALITIES.map(q => ({ name: q.name, rgb: tokenValueOf(q.color, 'light'), rank: q.rank }))
    expect(ladder).toHaveLength(9)
    const tooClose: string[] = []
    for (let i = 0; i < ladder.length; i += 1) {
      for (let j = i + 1; j < ladder.length; j += 1) {
        const d = deltaE(ladder[i]!.rgb, ladder[j]!.rgb)
        if (d < 10) tooClose.push(`${ladder[i]!.name}-${ladder[j]!.name} ΔE ${d.toFixed(1)}`)
      }
    }
    expect(tooClose).toEqual([])
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
      const mine = LIGHT.get(name!)
      expect(mine, `privacy.html 抄了 --${name},色板上没有这个 token`).toBeTruthy()
      expect([Number(r), Number(g), Number(b)]).toEqual([...mine!])
    }
  })

  it('index.html 首帧那三个色也是手抄的,同样要对得上', () => {
    /*
     * 首帧占位必须在 CSS 到位之前就把颜色写进去(那时还没有变量),所以它是一处手抄。
     * 抄的是 paper / ink / cinnabar 三色,明暗各一套。
     */
    const pairs: [string, 'light' | 'dark'][] = [
      ['paper', 'light'],
      ['ink', 'light'],
      ['cinnabar', 'light'],
      ['paper', 'dark'],
      ['ink', 'dark'],
      ['cinnabar', 'dark']
    ]
    for (const [token, theme] of pairs) {
      // 先把两段作用域切出来:第一段是 :root 那半边,第二段是暗色媒体查询里那半边
      const scope = theme === 'light' ? /#app \{([\s\S]*?)\n {6}\}/.exec(INDEX_HTML)?.[1] : /@media \(prefers-color-scheme: dark\) \{[\s\S]*?#app \{([\s\S]*?)\n {8}\}/.exec(INDEX_HTML)?.[1]
      expect(scope, `index.html 的首帧色块变了形状(${theme}),判据要跟着改`).toBeTruthy()
      const value = new RegExp(`--boot-${token}:\\s*(\\d+) (\\d+) (\\d+);`).exec(scope!)
      expect(value, `index.html 首帧少了 --boot-${token}(${theme})`).toBeTruthy()
      const mine = (theme === 'light' ? LIGHT : DARK).get(token)!
      expect([Number(value![1]), Number(value![2]), Number(value![3])]).toEqual([...mine])
    }
  })
})
