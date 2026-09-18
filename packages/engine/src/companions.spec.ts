import { describe, expect, it } from 'vitest'
import { createCompanionSystem } from './companions.js'

const NEUTRAL = { exploreDurMult: 1, dangerMult: 1, dropLuck: 0, lossReduction: 0 }

const SYSTEM = createCompanionSystem({
  neutral: NEUTRAL,
  traits: [
    { id: 'greedy', name: '贪宝', mods: { dangerMult: 1.05, dropLuck: 0.06 } },
    { id: 'steady', name: '慢稳', mods: { exploreDurMult: 1.1, lossReduction: 0.02 } }
  ],
  companions: [
    { id: 'fox', name: '狐', traitId: 'greedy', mods: { luck: 0.05 } },
    { id: 'turtle', name: '龟', traitId: 'steady' },
    { id: 'stray', name: '流浪猫' }
  ]
})

describe('伙伴系统 —— 性格系数与自身词条', () => {
  it('性格系数是**绝对取值**叠加在中性基线上', () => {
    expect(SYSTEM.effectsOf('fox')).toEqual({ exploreDurMult: 1, dangerMult: 1.05, dropLuck: 0.06, lossReduction: 0 })
    expect(SYSTEM.effectsOf('turtle')).toEqual({ exploreDurMult: 1.1, dangerMult: 1, dropLuck: 0, lossReduction: 0.02 })
  })

  it('没带伙伴、伙伴没性格、id 不认识 —— 一律中性', () => {
    expect(SYSTEM.effectsOf(null)).toEqual(NEUTRAL)
    expect(SYSTEM.effectsOf('stray')).toEqual(NEUTRAL)
    expect(SYSTEM.effectsOf('不存在')).toEqual(NEUTRAL)
    // 返回的是拷贝:改它不影响下一次
    const once = SYSTEM.effectsOf(null)
    once.dangerMult = 99
    expect(SYSTEM.effectsOf(null).dangerMult).toBe(1)
  })

  it('自身词条与性格分开取,合并时两者都在', () => {
    expect(SYSTEM.modsOf('fox')).toEqual({ luck: 0.05 })
    expect(SYSTEM.modsOf(null)).toEqual({})
    expect(SYSTEM.activeMods(['fox'])).toEqual({ ...NEUTRAL, dangerMult: 1.05, dropLuck: 0.06, luck: 0.05 })
  })

  it('带多只时逐只叠加,重复 id 只算一次;性格系数是覆盖式而非相乘', () => {
    expect(SYSTEM.activeMods(['fox', 'fox', 'turtle']).luck).toBe(0.05)
    // 后一只有性格就覆盖该键 —— 免得出现 1.05×1.1 这种没人预期过的数
    expect(SYSTEM.activeMods(['fox', 'turtle']).exploreDurMult).toBe(1.1)
  })

  it('多只时怎么合由作品定:默认覆盖,也可"各自相对中性那一份相加"', () => {
    const additive = createCompanionSystem({
      neutral: NEUTRAL,
      stack: 'add-relative',
      traits: [
        { id: 'greedy', mods: { dangerMult: 1.05, dropLuck: 0.06 } },
        { id: 'steady', mods: { exploreDurMult: 1.1, dropLuck: 0.02 } }
      ],
      companions: [
        { id: 'fox', name: '狐', traitId: 'greedy' },
        { id: 'turtle', name: '龟', traitId: 'steady' }
      ]
    })
    const both = additive.activeMods(['fox', 'turtle'])
    // 倍率类:1 + (0.05 + 0.10) = 1.15;加法类:0 + (0.06 + 0.02) = 0.08
    expect(both.dangerMult).toBeCloseTo(1.05, 10)
    expect(both.exploreDurMult).toBeCloseTo(1.1, 10)
    expect(both.dropLuck).toBeCloseTo(0.08, 10)
    // 单只时两种模式结果相同(没有可叠的对象)
    expect(additive.activeMods(['fox']).dropLuck).toBeCloseTo(0.06, 10)
    expect(SYSTEM.activeMods(['fox']).dropLuck).toBeCloseTo(0.06, 10)
  })

  it('配置错误当场报错:重复 id、指向不存在的性格、性格用了没有中性值的键', () => {
    expect(() => createCompanionSystem({ neutral: NEUTRAL, traits: [], companions: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] })).toThrow(/重复/)
    expect(() => createCompanionSystem({ neutral: {}, traits: [], companions: [{ id: 'a', name: 'A', traitId: 'ghost' }] })).toThrow(/未定义的性格/)
    expect(() => createCompanionSystem({ neutral: {}, traits: [{ id: 't', mods: { x: 1 } }], companions: [] })).toThrow(/中性值/)
  })
})
