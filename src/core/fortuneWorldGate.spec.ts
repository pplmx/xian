/**
 * 机缘的界域门(扩界审计)
 *
 * 机缘的主判据是**区域标签**(见 eventEngine.pickEventFor),不是 minRealm。
 * 扩界引进了三个界域标签(immortal / god / chaos),于是多了两条必须守住的线:
 *
 *   1. 每条机缘的标签至少被一处区域引用 —— 否则它永远碰不到,是一行死数据
 *   2. 仙界及以上的机缘不得与人间界区域共享标签 —— 否则神界机缘会漏到炼气期
 *   3. 反过来也得堵:人间界的机缘(剑痕/丹方/幼兽/高人/秘术)带的是 'general'
 *      这类人间界标签,而界外区域同样带 'general' —— 只靠标签它们会一路漏到
 *      道祖面前,故这五条一律声明 maxRealm = 渡劫(见 eventRealmBand.spec)
 */
import { describe, expect, it } from 'vitest'
import { FORTUNE_EVENTS } from '@/data/events'
import { MORTAL_REGIONS, REGIONS } from '@/data/regions'
import { WORLD_BREAK_MAJOR } from '@/data/realms'

const ALL_TAGS = new Set(REGIONS.flatMap(r => r.eventTags))
const MORTAL_TAGS = new Set(MORTAL_REGIONS.flatMap(r => r.eventTags))
const WORLD_TAGS = ['immortal', 'god', 'chaos'] as const

describe('机缘 · 界域门', () => {
  it('每条机缘的标签都被至少一处区域引用(无死机缘)', () => {
    for (const ev of FORTUNE_EVENTS) {
      const reachable = ev.tags.some(t => ALL_TAGS.has(t))
      expect(reachable, `${ev.id} 的标签 ${ev.tags.join('/')} 没有任何区域引用`).toBe(true)
    }
  })

  it('仙界及以上的机缘只在对应界域出现,不会漏到人间界', () => {
    const high = FORTUNE_EVENTS.filter(ev => ev.tags.some(t => (WORLD_TAGS as readonly string[]).includes(t)))
    expect(high.length).toBeGreaterThan(0)
    for (const ev of high) {
      const leaked = ev.tags.filter(t => MORTAL_TAGS.has(t))
      expect(leaked, `${ev.id} 的标签 ${leaked.join('/')} 与人间界区域重合,会漏到低界`).toEqual([])
    }
  })

  it('每个界域都至少有一条自己的机缘', () => {
    for (const tag of WORLD_TAGS) {
      const own = FORTUNE_EVENTS.filter(ev => ev.tags.includes(tag))
      expect(own.length, `${tag} 界域没有专属机缘`).toBeGreaterThanOrEqual(2)
    }
  })

  it('人间界机缘不被高界标签污染(反向不漏)', () => {
    const mortal = FORTUNE_EVENTS.filter(ev => ev.tags.some(t => ['general', 'ruin', 'forest', 'dark'].includes(t)))
    expect(mortal.length).toBeGreaterThan(0)
    for (const ev of mortal) {
      const leaked = ev.tags.filter(t => (WORLD_TAGS as readonly string[]).includes(t))
      expect(leaked, `${ev.id} 同时带了人间界与高界标签`).toEqual([])
    }
  })

  it('人间界机缘收在人间界以内(只靠标签它们会漏到道祖面前)', () => {
    const mortal = FORTUNE_EVENTS.filter(ev => ev.tags.some(t => MORTAL_TAGS.has(t)))
    for (const ev of mortal) {
      expect(
        ev.maxRealm,
        `${ev.id} 带的是人间界标签,却没声明上限 —— 界外区域同样带 'general',它会漏到仙界及以上`
      ).toBeDefined()
      expect(ev.maxRealm!, `${ev.id} 的上限越过了人间界`).toBeLessThan(WORLD_BREAK_MAJOR)
    }
  })
})
