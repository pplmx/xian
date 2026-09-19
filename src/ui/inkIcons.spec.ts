/**
 * 图标判据
 *
 * 图标是「全局古风」里最后换掉的一层,换的时候有三个坑,这一份就是拦它们的:
 *
 * 一 **常驻那几处必须是水墨版**。底部导航五项与顶栏三项每一屏都在,是全站最常被看到的
 *    图形;它们要是退回几何线性图标,换与不换就没区别了。
 * 二 **同名键不许有两个来源**。注册表用展开语法铺水墨那八枚,铺的先后决定谁生效 ——
 *    第一版铺在最前面,被后面的 lucide 同名项整个盖掉,界面上依然是旧图标(改完还得
 *    打开真界面才发现)。故这里直接问注册表:这八个名字拿到的是不是水墨版。
 * 三 **写死的名字都登记过**。`iconOf` 对不认识的名字回退成星芒 —— 不报错、不留痕,
 *    于是「镇压中的地界」那一处标着 shield-check 却一直显示星芒。这条把它量出来。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ICONS } from './icons'
import { INK_ICONS } from './inkIcons'

const ROOT = resolve(__dirname, '../..')
/** 常驻界面:底部导航 + 顶栏。它们的图标最该先换,也最不该退回旧图形 */
const CHROME = ['src/components/common/BottomNavigation.vue', 'src/components/common/TopStatusBar.vue']

/**
 * 笔路从源码文本里读 —— 不额外导出 INK_PATHS 给判据用:那种"只为 spec 存在"的导出
 * 正是 deadExportAudit 要拦的东西(判据自己也不该成为死代码的理由)。
 */
function inkPathsFromSource(): Record<string, string> {
  const text = readFileSync(resolve(ROOT, 'src/ui/inkIcons.ts'), 'utf-8')
  const out: Record<string, string> = {}
  for (const m of text.matchAll(/'([MLHVCASmlhvcasZz0-9 .,-]*M[MLHVCASmlhvcasZz0-9 .,-]*)'/g)) out[m[1]!] = m[1]!
  return out
}

function iconNamesIn(file: string): string[] {
  const text = readFileSync(resolve(ROOT, file), 'utf-8')
  // 两种写法都要认:页签表里的 `icon: 'mountain'`,模板里的 `<GameIcon name="gem">`
  return [
    ...[...text.matchAll(/icon: '([a-z-]+)'/g)].map(m => m[1]!),
    ...[...text.matchAll(/<GameIcon\s+name="([a-z-]+)"/g)].map(m => m[1]!)
  ]
}

/** 界面上真会用到的图标名 —— 数据里的 icon 字段 + 模板里写死的(含三元里的字面量) */
function usedIconNames(): Set<string> {
  const names = new Set<string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
        const text = readFileSync(path, 'utf-8')
        for (const m of text.matchAll(/icon: '([a-z-]+)'/g)) names.add(m[1]!)
        for (const m of text.matchAll(/<GameIcon[^>]*?\bname="'?([a-z-]+)'?"/g)) names.add(m[1]!)
        for (const m of text.matchAll(/<GameIcon[^>]*?:name="([^"]+)"/g)) {
          for (const lit of m[1]!.matchAll(/'([a-z-]+)'/g)) names.add(lit[1]!)
        }
      }
    }
  }
  walk(resolve(ROOT, 'src'))
  return names
}

describe('图标 · 常驻的那几处', () => {
  it('底部导航与顶栏画的都是水墨版,而且注册表里没被别的来源盖掉', () => {
    const names = CHROME.flatMap(iconNamesIn)
    expect(names.length).toBe(8)
    for (const name of names) {
      expect(Object.keys(INK_ICONS), `${name} 还不是水墨版`).toContain(name)
      expect(ICONS[name], `${name} 在注册表里被别的来源盖掉了(铺水墨那一步要放最后)`).toBe(INK_ICONS[name])
    }
  })

  it('常驻那八枚只是水墨集合的一部分(后来又把内容图标也换了过来)', () => {
    const chrome = [...new Set(CHROME.flatMap(iconNamesIn))].sort()
    for (const name of chrome) expect(Object.keys(INK_ICONS)).toContain(name)
    expect(Object.keys(INK_ICONS).length).toBeGreaterThan(chrome.length)
  })

  it('每一枚水墨图标都真在界面上用得到 —— 画了没人用只是多出来的第二种语言', () => {
    const used = usedIconNames()
    const dead = Object.keys(INK_ICONS).filter(name => !used.has(name))
    expect(dead, '这些水墨图标没有任何数据或模板引用').toEqual([])
  })
})

describe('图标 · 笔路', () => {
  it('每一笔都画在 24 网格里 —— 越界就是画飞了', () => {
    const paths = Object.keys(inkPathsFromSource())
    expect(paths.length, '一条笔路都没读到,判据在空集上假绿了').toBeGreaterThanOrEqual(8)
    const out = paths
      .flatMap(d => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0])))
      .filter(n => n < 0 || n > 24.5)
    expect(out, `有笔路越出 24 画布:${out.join(', ')}`).toEqual([])
  })
})

describe('图标 · 名字都登记过', () => {
  it('数据与模板里写死的图标名,注册表里都找得到(找不到会静静变成星芒)', () => {
    const missing = new Set<string>()
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
          const text = readFileSync(path, 'utf-8')
          for (const m of text.matchAll(/icon: '([a-z-]+)'/g)) if (!ICONS[m[1]!]) missing.add(m[1]!)
          // 模板里 :name="… ? 'x' : …" 这种(如镇压中的地界签)
          for (const m of text.matchAll(/<GameIcon[^>]*:name="([^"]+)"/g)) {
            for (const lit of m[1]!.matchAll(/'([a-z-]+)'/g)) if (!ICONS[lit[1]!]) missing.add(lit[1]!)
          }
        }
      }
    }
    walk(resolve(ROOT, 'src'))
    expect([...missing]).toEqual([])
  })
})
