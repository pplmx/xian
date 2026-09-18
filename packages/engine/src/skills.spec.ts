import { describe, expect, it } from 'vitest'
import { createSkillSystem } from './skills.js'

const SYSTEM = createSkillSystem({
  skills: [
    {
      id: 's_sword',
      name: '青锋诀',
      kind: '主修',
      maxLevel: 3,
      baseMods: { attackPct: 0.05, critRate: 0.01 },
      perLevelMods: { attackPct: 0.03, critDamage: 0.1 },
      requiredLevel: 2,
      costs: [
        { key: 'wudao', base: 10, growth: 1.5 },
        { key: 'page', base: 0, levelStep: 2, discountable: false }
      ],
      branches: [
        { id: 'b_fast', name: '疾锋', mods: { speed: 0.05 } },
        { id: 'b_heavy', name: '重锋', mods: { critDamage: 0.2 } }
      ]
    },
    { id: 's_qi', name: '敛息诀', kind: '辅修', maxLevel: 2, baseMods: { qiRegen: 0.05 }, perLevelMods: { qiRegen: 0.02 } }
  ]
})

describe('技能/功法 —— 等级曲线、消耗、满级分支、装配来源', () => {
  it('第 N 级 = 基础 + 每级 × (N-1);只有每级键在 1 级时也会以 0 出现', () => {
    expect(SYSTEM.modsAt('s_sword', 1)).toEqual({ attackPct: 0.05, critRate: 0.01, critDamage: 0 })
    expect(SYSTEM.modsAt('s_sword', 3).attackPct).toBeCloseTo(0.11, 10)
    expect(SYSTEM.modsAt('s_sword', 3).critDamage).toBeCloseTo(0.2, 10)
    // 等级小于 1 按 1 算,不产生负词条
    expect(SYSTEM.modsAt('s_sword', 0)).toEqual(SYSTEM.modsAt('s_sword', 1))
    expect(SYSTEM.modsAt('不存在', 3)).toEqual({})
  })

  it('升级消耗 = 基数 × 倍率^等级(再乘折扣),线性项按等级加,并有下限', () => {
    expect(SYSTEM.costAt('s_sword', 1)).toEqual([
      { key: 'wudao', amount: Math.ceil(10 * 1.5) },
      { key: 'page', amount: 2 }
    ])
    expect(SYSTEM.costAt('s_sword', 2)).toEqual([
      { key: 'wudao', amount: Math.ceil(10 * 1.5 ** 2) },
      { key: 'page', amount: 4 }
    ])
    // 折扣只作用于可折的那一项(page 声明了 discountable: false),且不低于下限 1
    expect(SYSTEM.costAt('s_sword', 1, { discount: 1 })).toEqual([
      { key: 'wudao', amount: 1 },
      { key: 'page', amount: 2 }
    ])
  })

  it('满级不再有升级消耗', () => {
    expect(SYSTEM.costAt('s_sword', 3)).toEqual([])
    expect(SYSTEM.costAt('s_sword', 9)).toEqual([])
  })

  it('满级分支:给了什么、没给什么', () => {
    expect(SYSTEM.branchesOf('s_sword').map(b => b.id)).toEqual(['b_fast', 'b_heavy'])
    expect(SYSTEM.branchMods('s_sword', 'b_heavy')).toEqual({ critDamage: 0.2 })
    expect(SYSTEM.branchMods('s_sword', '不存在')).toEqual({})
    expect(SYSTEM.branchesOf('s_qi')).toEqual([])
  })

  it('装配汇总:每部功法一份来源(不替作品合并),选项也算一份', () => {
    const sources = SYSTEM.sourcesOf([
      { skillId: 's_sword', level: 3, branchId: 'b_fast' },
      { skillId: 's_qi', level: 2 },
      { skillId: '不存在', level: 1 }
    ])
    expect(sources.length).toBe(3)
    expect(sources[0]!.attackPct).toBeCloseTo(0.11, 10)
    expect(sources[1]!).toEqual({ speed: 0.05 })
    expect(sources[2]!.qiRegen).toBeCloseTo(0.07, 10)
  })

  it('配置错误当场报错:id 重复、maxLevel 非正', () => {
    expect(() => createSkillSystem({ skills: [{ id: 'a', name: 'A', maxLevel: 1 }, { id: 'a', name: 'A2', maxLevel: 1 }] })).toThrow(/重复/)
    expect(() => createSkillSystem({ skills: [{ id: 'a', name: 'A', maxLevel: 0 }] })).toThrow(/maxLevel/)
  })

  it('消耗项可以自己接管数额(手调价目表),折扣与下限仍然生效', () => {
    const table = createSkillSystem({
      skills: [
        {
          id: 's',
          name: 'S',
          maxLevel: 4,
          costs: [{ key: 'coin', amount: lv => lv * lv + 1, discountable: true }]
        }
      ]
    })
    expect(table.costAt('s', 1)).toEqual([{ key: 'coin', amount: 2 }])
    expect(table.costAt('s', 3)).toEqual([{ key: 'coin', amount: 10 }])
    // 折扣照乘,但仍不低于下限 1
    expect(table.costAt('s', 3, { discount: 1 })).toEqual([{ key: 'coin', amount: 1 }])
  })

  it('词条曲线也能自己接管:modsFn 给你等级、你还一组词条', () => {
    const sys = createSkillSystem({
      skills: [
        {
          id: 's',
          name: 'S',
          maxLevel: 5,
          baseMods: { attackPct: 99 }, // 给了 modsFn 就该被忽略
          perLevelMods: { attackPct: 99 },
          modsFn: level => ({ attackPct: level <= 3 ? level * 0.05 : 0.15 + (level - 3) * 0.01 })
        }
      ]
    })
    expect(sys.modsAt('s', 1)).toEqual({ attackPct: 0.05 })
    expect(sys.modsAt('s', 3).attackPct).toBeCloseTo(0.15, 10)
    expect(sys.modsAt('s', 5).attackPct).toBeCloseTo(0.17, 10)
    // 返回的是拷贝:改它不影响下一次
    const once = sys.modsAt('s', 3)
    once.attackPct = 9
    expect(sys.modsAt('s', 3).attackPct).toBeCloseTo(0.15, 10)
  })

  it('分支可以互相有前置:选过某条道才解锁另一条;前置写错则永远选不了', () => {
    const sys = createSkillSystem({
      skills: [
        {
          id: 'a',
          name: 'A',
          maxLevel: 2,
          branches: [
            { id: 'b_base', mods: { attackPct: 0.05 } },
            { id: 'b_deep', mods: { critRate: 0.02 }, requires: ['b_base'] }
          ]
        },
        { id: 'c', name: 'C', maxLevel: 2, branches: [{ id: 'c_edge', mods: { maxHpPct: 0.03 }, requires: ['b_base'] }] }
      ]
    })
    // 什么都没选:只有无前置的那条可选
    expect(sys.availableBranches('a', []).map(b => b.id)).toEqual(['b_base'])
    // 选过 b_base 之后:本技能与别的技能的前置分支都解锁(集合是所有技能共用的)
    expect(sys.availableBranches('a', ['b_base']).map(b => b.id)).toEqual(['b_base', 'b_deep'])
    expect(sys.availableBranches('c', ['b_base']).map(b => b.id)).toEqual(['c_edge'])
    expect(sys.availableBranches('c', []).map(b => b.id)).toEqual([])
    // 前置指向不存在的分支:按永远选不了处理,不静默放过
    const typo = createSkillSystem({ skills: [{ id: 's', name: 'S', maxLevel: 1, branches: [{ id: 'x', mods: {}, requires: ['没有这条'] }] }] })
    expect(typo.availableBranches('s', ['没有这条'])).toEqual([])
  })
})
