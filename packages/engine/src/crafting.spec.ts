import { describe, expect, it } from 'vitest'
import {
  averageLore,
  composeCraftRate,
  leverFactor,
  overReachFactor,
  proficiencyFromExp,
  stageNameOf,
  weightedSkill
} from './crafting.js'

const FORMULA = {
  baseRate: 0.95,
  mastery: { floor: 0.22, span: 0.78 },
  lore: { floor: 0.42, span: 0.58 },
  skill: { floor: 0.3, span: 0.7 },
  overReach: { table: [1, 0.6, 0.35, 0.18], decay: 0.45 }
}

describe('炼制/技艺 —— 熟练度、乘区、越级', () => {
  it('熟练度双曲饱和:逼近上限而不到顶,经验为负按 0', () => {
    expect(proficiencyFromExp(0, 600)).toBe(0)
    expect(proficiencyFromExp(600, 600)).toBeCloseTo(50, 10)
    expect(proficiencyFromExp(5400, 600)).toBeCloseTo(90, 10)
    expect(proficiencyFromExp(1e9, 600)).toBeLessThan(100)
    expect(proficiencyFromExp(-5, 600)).toBe(0)
    // scale 非法时不假装能练:直接给到上限
    expect(proficiencyFromExp(100, 0)).toBe(100)
  })

  it('分档:读名字不读数字,低过所有档给兜底', () => {
    const stages = [
      { min: 85, name: '通玄' },
      { min: 40, name: '小成' },
      { min: 0, name: '生疏' }
    ]
    expect(stageNameOf(90, stages)).toBe('通玄')
    expect(stageNameOf(40, stages)).toBe('小成')
    expect(stageNameOf(-1, stages, '未入门')).toBe('未入门')
  })

  it('加权技艺:权重缺失的项不参与,全无权重时为 0', () => {
    const levels: Record<string, number> = { a: 80, b: 40, c: 100 }
    expect(weightedSkill({ a: 2, b: 1 }, id => levels[id] ?? 0)).toBeCloseTo((80 * 2 + 40) / 3, 10)
    expect(weightedSkill({ a: undefined, b: 0 }, id => levels[id] ?? 0)).toBe(0)
    expect(weightedSkill({}, () => 50)).toBe(0)
  })

  it('平均认知度:按上限归一,空列表视为全懂,超上限按上限算', () => {
    expect(averageLore([], () => 0, 3)).toBe(1)
    expect(averageLore(['a', 'b'], id => (id === 'a' ? 3 : 0), 3)).toBeCloseTo(0.5, 10)
    expect(averageLore(['a'], () => 99, 3)).toBe(1)
    expect(averageLore(['a'], () => -5, 3)).toBe(0)
  })

  it('越级:表内查表、表外指数衰减、没越级为 1', () => {
    expect(overReachFactor(0, FORMULA.overReach)).toBe(1)
    expect(overReachFactor(-2, FORMULA.overReach)).toBe(1)
    expect(overReachFactor(1, FORMULA.overReach)).toBe(0.6)
    expect(overReachFactor(3, FORMULA.overReach)).toBe(0.18)
    expect(overReachFactor(5, FORMULA.overReach)).toBeCloseTo(0.18 * 0.45 ** 2, 10)
  })

  it('乘区有下限:四项全弱也不归零', () => {
    expect(leverFactor(0, FORMULA.mastery)).toBe(0.22)
    expect(leverFactor(1, FORMULA.mastery)).toBe(1)
    expect(leverFactor(5, FORMULA.mastery)).toBe(1)
    const worst = composeCraftRate({ mastery: 0, lore: 0, skill: 0, overReach: 4 }, FORMULA)
    expect(worst).toBeGreaterThan(0)
    expect(worst).toBeLessThan(0.05)
  })

  it('各项皆满、不越级时贴着基准率', () => {
    const best = composeCraftRate({ mastery: 1, lore: 1, skill: 1, overReach: 0 }, FORMULA)
    expect(best).toBeCloseTo(0.95, 10)
  })
})
