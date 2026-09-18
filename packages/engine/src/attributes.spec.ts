import { describe, expect, it } from 'vitest'
import { attributeDefs, createAttributeSystem } from './attributes'

function makeSystem() {
  return createAttributeSystem({
    defs: attributeDefs({})
  })
}

describe('属性系统 —— 换皮不改机制', () => {
  it('改名只改展示名,机制键一个不变', () => {
    const renamed = attributeDefs({ rename: { attack: '术法', critRate: '会心率' } })
    const base = attributeDefs({})
    expect(renamed.map(d => d.key)).toEqual(base.map(d => d.key))
    const sys = createAttributeSystem({ defs: renamed })
    expect(sys.name('attack')).toBe('术法')
    expect(sys.name('critRate')).toBe('会心率')
    expect(sys.name('defense')).toBe('防御')
  })

  it('普通词条同键相加', () => {
    const sys = makeSystem()
    const merged = sys.mergeMods([{ attackPct: 0.1 }, { attackPct: 0.05 }, { critRate: 0.02 }])
    expect(merged.attackPct).toBeCloseTo(0.15, 10)
    expect(merged.critRate).toBeCloseTo(0.02, 10)
  })

  it('递减词条按贡献降序以 1/0.75/0.5/0.25 计入', () => {
    const sys = makeSystem()
    const merged = sys.mergeMods([{ counterRate: 0.08 }, { counterRate: 0.12 }, { counterRate: 0.04 }])
    expect(merged.counterRate).toBeCloseTo(0.12 + 0.08 * 0.75 + 0.04 * 0.5, 10)
  })

  it('软阈值:越线部分按 diminish 折算', () => {
    const sys = makeSystem()
    const merged = sys.mergeMods([{ critRate: 0.5 }, { critRate: 0.45 }])
    // cap 0.75,超出 0.2 按 0.5 计入 → 0.85
    expect(merged.critRate).toBeCloseTo(0.85, 10)
    expect(sys.isSoftCapped(merged, 'critRate')).toBe(true)
  })

  it('明细与合计对得上:软阈值折算摊回各来源', () => {
    const sys = makeSystem()
    const { mods, effective } = sys.mergeModsDetailed([{ critRate: 0.5 }, { critRate: 0.45 }])
    const sum = effective.reduce((acc, row) => acc + (row.critRate ?? 0), 0)
    expect(sum).toBeCloseTo(mods.critRate ?? 0, 10)
  })

  it('最终属性 = (本值 + 平铺) × 百分比 × 另乘', () => {
    const sys = makeSystem()
    const out = sys.compute({
      base: { attack: 100, defense: 50, maxHp: 1000 },
      flat: { attack: 20 },
      modSources: [{ attackPct: 0.5 }],
      onTop: [{ name: '转世', mult: { attack: 2 } }]
    })
    expect(out.final.attack).toBeCloseTo((100 + 20) * 1.5 * 2, 6)
    expect(out.final.defense).toBeCloseTo(50, 6)
    expect(out.power).toBeCloseTo((out.final.attack ?? 0) * 3 + (out.final.defense ?? 0) * 2 + (out.final.maxHp ?? 0) * 0.15, 4)
  })

  it('未登记的词条键不影响结算,也不会被当成核心本值', () => {
    const sys = makeSystem()
    const out = sys.compute({ base: { attack: 10 }, modSources: [{ 未知词条: 1 }] })
    expect(out.final.attack).toBe(10)
    expect(out.mods['未知词条']).toBe(1)
  })

  it('构筑深度只算构筑词条,不算核心三围百分比', () => {
    const sys = makeSystem()
    const depth = sys.modDepth({ attackPct: 0.5, critRate: 0.1, dodgeRate: 0.05 })
    expect(depth).toBeCloseTo(0.15, 10)
  })
})
