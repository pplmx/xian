import { describe, expect, it } from 'vitest'
import { createHoldingSystem } from './holding.js'
import { createIntake } from './intake.js'

interface Item {
  uid: string
  name: string
  worth: number
}

const item = (uid: string, worth = 1): Item => ({ uid, name: uid, worth })

describe('入库漏斗 —— 收不下怎么办', () => {
  const holding = createHoldingSystem<Item>({ capacity: 2 })

  it('收得下就收下,不折算', () => {
    const intake = createIntake<Item, string>({ holding, fallback: i => ({ line: `${i.name} 化了` }) })
    const result = intake.admit(holding.create(), item('a'))
    expect(result.admitted).toBe(true)
    expect(result.lines).toEqual([])
    expect(result.holding.items.map(i => i.uid)).toEqual(['a'])
  })

  it('先见证再裁决:被拒收的那件也算"见过"(收不收是另一件事)', () => {
    const seen: string[] = []
    const intake = createIntake<Item, string>({
      holding,
      accept: i => i.worth >= 5,
      witness: i => seen.push(i.uid),
      fallback: i => ({ line: `${i.name} 化了` })
    })
    const result = intake.admit(holding.create(), item('junk', 1))
    expect(result.admitted).toBe(false)
    expect(result.reason).toBe('rejected') // 两条文案靠它区分
    expect(seen).toEqual(['junk']) // 见证发生在裁决之前
    expect(result.lines).toEqual(['junk 化了'])
  })

  it('force 跳过裁决(新手馈赠不受自动规则约束),但见证照旧', () => {
    const seen: string[] = []
    const intake = createIntake<Item, string>({
      holding,
      accept: () => false,
      witness: i => seen.push(i.uid),
      fallback: i => ({ line: `${i.name} 化了` })
    })
    expect(intake.admit(holding.create(), item('gift'), { force: true }).admitted).toBe(true)
    expect(seen).toEqual(['gift'])
  })

  it('满了:只有值得留的新件才腾位;被挤掉的也走同一条折算账', () => {
    const intake = createIntake<Item, string>({
      holding,
      evictable: (items, incoming) => (incoming.worth >= 5 ? [...items].sort((a, b) => a.worth - b.worth)[0] : undefined),
      fallback: i => ({ line: `${i.name} 化了` })
    })
    const full = holding.create([item('old', 1), item('older', 0)])

    // 新件不值得留 → 不腾位,它自己走
    const weak = intake.admit(full, item('weak', 1))
    expect(weak.admitted).toBe(false)
    expect(weak.evicted).toBeUndefined()
    expect(weak.holding.items.map(i => i.uid)).toEqual(['old', 'older'])

    // 新件值得留 → 挤掉最差的那件,自己进包
    const strong = intake.admit(full, item('strong', 9))
    expect(strong.admitted).toBe(true)
    expect(strong.evicted?.uid).toBe('older')
    expect(strong.holding.items.map(i => i.uid)).toEqual(['old', 'strong'])
    expect(strong.lines).toEqual(['older 化了']) // 被挤掉的也折算
  })

  it('腾位失败不追回:旧件已经折算就是折算了,新件按"收不下"这条路走', () => {
    // 一个"加了也不占位"的怪容器:腾位后仍然加不进去,逼出那条兜底
    const stubborn = {
      add: () => ({ ok: false as const, holding: holding.create(), reason: 'full' as const }),
      isFull: () => true,
      remove: (h: { items: Item[] }, uid: string) => ({ holding: { items: h.items.filter(i => i.uid !== uid) }, removed: h.items.find(i => i.uid === uid) })
    }
    const intake = createIntake<Item, string>({
      holding: stubborn,
      evictable: items => items[0],
      fallback: i => ({ line: `${i.name} 化了` })
    })
    const result = intake.admit(holding.create([item('victim'), item('other')]), item('newcomer'))
    expect(result.admitted).toBe(false)
    expect(result.reason).toBe('full')
    expect(result.evicted?.uid).toBe('victim')
    // 两条折算都记着:被挤掉的与收不下的
    expect(result.lines).toEqual(['victim 化了', 'newcomer 化了'])
  })

  it('没有腾位策略时,满了就直接折算新件', () => {
    const intake = createIntake<Item, number>({ holding, fallback: i => ({ line: `${i.name} 化了`, yield: i.worth }) })
    const result = intake.admit(holding.create([item('a'), item('b')]), item('c', 3))
    expect(result.admitted).toBe(false)
    expect(result.reason).toBe('full') // 收不下
    expect(result.yields).toEqual([{ item: expect.objectContaining({ uid: 'c' }), line: 'c 化了', yield: 3 }])
    expect(result.holding.items.length).toBe(2) // 容器原样
  })
})
