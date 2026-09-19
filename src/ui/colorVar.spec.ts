/**
 * 语义色叠透明度
 *
 * 这条判据守的是一个**静默失效**:调色板的变量存的是完整颜色
 * (`--color-qing: rgb(44 90 125)`),所以 `color + '55'` 会拼出
 * `var(--color-qing)55` —— 非法值,浏览器丢掉整条声明,边框与底色就这么没了,
 * 控制台一声不吭。叠透明度必须走通道值变量。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { colorWithAlpha } from './colorVar'

describe('colorWithAlpha', () => {
  it('语义色变量走通道值变量,而不是在 var() 后面拼尾巴', () => {
    expect(colorWithAlpha('var(--color-qing)', 0.33)).toBe('rgb(var(--color-qing-rgb) / 0.33)')
    expect(colorWithAlpha('var(--color-ink-faint)', 0.06)).toBe('rgb(var(--color-ink-faint-rgb) / 0.06)')
  })

  it('不是 token 的颜色(存档里的旧数据)照老办法拼 hex alpha,别把颜色弄丢', () => {
    expect(colorWithAlpha('#4F7699', 0.33)).toBe('#4F769954')
    expect(colorWithAlpha('#4F7699', 0.06)).toBe('#4F76990f')
  })

  it('透明度夹回 0..1,认不出来的字符串原样返回', () => {
    expect(colorWithAlpha('var(--color-qing)', 2)).toBe('rgb(var(--color-qing-rgb) / 1)')
    expect(colorWithAlpha('var(--color-qing)', -1)).toBe('rgb(var(--color-qing-rgb) / 0)')
    expect(colorWithAlpha('currentColor', 0.5)).toBe('currentColor')
  })
})

describe('调用点', () => {
  it('源码里不再有 `.color + \'xx\'` 这种拼法', () => {
    const ROOT = resolve(__dirname, '../..')
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
          for (const m of readFileSync(path, 'utf-8').matchAll(/\.color\s*\+\s*['"`]/g)) {
            offenders.push(`${path.slice(ROOT.length + 1)} → ${m[0]}`)
          }
        }
      }
    }
    walk(resolve(ROOT, 'src'))
    expect(offenders).toEqual([])
  })
})
