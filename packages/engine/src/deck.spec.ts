import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { deckPool, drawFrom, entryAllowed, inBand } from './deck'

const ENTRIES = [
  { id: 'a', tags: ['forest'], weight: 100, min: 0, max: 3 },
  { id: 'b', tags: ['forest'], weight: 10, min: 4 },
  { id: 'c', tags: ['water'], weight: 50 },
  { id: 'd', weight: 5, once: true },
  { id: 'e', tags: ['forest'], weight: 0 }
]

describe('内容牌堆 —— 区间、标签、一次性、权重', () => {
  it('等级区间含端点,两端可省', () => {
    expect(inBand(3, { min: 0, max: 3 })).toBe(true)
    expect(inBand(4, { min: 0, max: 3 })).toBe(false)
    expect(inBand(-999, {})).toBe(true)
    expect(inBand(2, { min: 3 })).toBe(false)
  })

  it('筛池:区间 + 场所标签 + 一次性,三件事各管各的', () => {
    const forestEarly = deckPool(ENTRIES, { level: 1, tags: ['forest'] })
    expect(forestEarly.map(e => e.id)).toEqual(['a', 'd', 'e'])
    const forestLate = deckPool(ENTRIES, { level: 6, tags: ['forest'] })
    expect(forestLate.map(e => e.id)).toEqual(['b', 'd', 'e'])
    const water = deckPool(ENTRIES, { level: 1, tags: ['water'] })
    // e 挂着 forest 标签,故不进水的池子 —— 这是区间/标签的事,与它是 0 权重无关
    expect(water.map(e => e.id)).toEqual(['c', 'd'])
    expect(deckPool(ENTRIES, { level: 1, tags: ['forest'], seen: ['d'] }).map(e => e.id)).toEqual(['a', 'e'])
    expect(entryAllowed({ id: 'x', weight: 1 }, { level: 0, tags: [] })).toBe(true)
    expect(entryAllowed({ id: 'x', tags: [], weight: 1 }, { level: 0, tags: ['forest'] })).toBe(true)
    expect(entryAllowed({ id: 'x', tags: ['water'], weight: 1 }, { level: 0, tags: ['forest'] })).toBe(false)
  })

  it('抽牌:按权重,池空返回 null', () => {
    const rng = createRng(7)
    const counts = new Map<string, number>()
    for (let i = 0; i < 2000; i += 1) {
      const got = drawFrom(ENTRIES, { level: 1, tags: ['forest'] }, rng)
      counts.set(got!.id, (counts.get(got!.id) ?? 0) + 1)
    }
    expect(counts.get('a')!).toBeGreaterThan(counts.get('d') ?? 0)
    expect(counts.get('e') ?? 0).toBe(0)
    expect(drawFrom(ENTRIES, { level: 1, tags: ['none'] }, rng)).toBeTruthy()
    expect(drawFrom([{ id: 'z', tags: ['void'], weight: 1 }], { level: 0, tags: ['forest'] }, rng)).toBeNull()
  })

  it('情境加权是"倾向"不是"门槛";权重全为 0 时退回均匀而不是抽空', () => {
    const rng = createRng(11)
    let a = 0
    let d = 0
    for (let i = 0; i < 2000; i += 1) {
      const got = drawFrom(ENTRIES, { level: 1, tags: ['forest'] }, rng, {
        weightMultiplier: entry => (entry.id === 'a' ? 0.01 : entry.id === 'd' ? 100 : 1)
      })
      if (got!.id === 'a') a += 1
      if (got!.id === 'd') d += 1
    }
    expect(d).toBeGreaterThan(a)
    expect(drawFrom([{ id: 'only', weight: 0 }], { level: 0, tags: [] }, rng)?.id).toBe('only')
  })
})
