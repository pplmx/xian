import { describe, expect, it } from 'vitest'
import type { GoalEnv } from './goals.js'
import { evalGoal, goalProgress } from './goals.js'

function env(over: Partial<GoalEnv> & { counters?: Record<string, number> } = {}): GoalEnv {
  const counters = over.counters ?? {}
  return {
    counter: key => counters[key] ?? 0,
    level: () => 0,
    ...over
  }
}

describe('目标/条件 —— 判定与进度', () => {
  it('计数型:够了才算,进度按比例', () => {
    const e = env({ counters: { kill: 3 } })
    expect(evalGoal({ type: 'counter', key: 'kill', value: 10 }, e)).toBe(false)
    expect(evalGoal({ type: 'counter', key: 'kill', value: 3 }, e)).toBe(true)
    expect(goalProgress({ type: 'counter', key: 'kill', value: 10 }, e)).toEqual({ done: false, ratio: 0.3, current: 3, target: 10 })
    // 超出目标时比例封顶 1,但当前值照实报(不替调用方截断)
    expect(goalProgress({ type: 'counter', key: 'kill', value: 2 }, e)).toEqual({ done: true, ratio: 1, current: 3, target: 2 })
  })

  it('目标为 0 时不会除零:视为已达成', () => {
    expect(goalProgress({ type: 'counter', key: 'x', value: 0 }, env())).toEqual({ done: true, ratio: 1, current: 0, target: 0 })
  })

  it('等级型与位阶型:大阶优先,小阶只在同阶时比', () => {
    const e = env({ level: () => 3, subLevel: () => 2 })
    expect(evalGoal({ type: 'level', min: 3 }, e)).toBe(true)
    expect(evalGoal({ type: 'level', min: 4 }, e)).toBe(false)
    expect(evalGoal({ type: 'position', major: 3, sub: 2 }, e)).toBe(true)
    expect(evalGoal({ type: 'position', major: 3, sub: 3 }, e)).toBe(false)
    expect(evalGoal({ type: 'position', major: 2, sub: 9 }, e)).toBe(true)
    // 省略 sub 即只看大阶
    expect(evalGoal({ type: 'position', major: 3 }, e)).toBe(true)
  })

  it('品阶型与自定义:环境没提供就当不成立', () => {
    expect(evalGoal({ type: 'rank', min: 3 }, env())).toBe(false)
    expect(evalGoal({ type: 'custom', key: '渡劫' }, env())).toBe(false)
    const rich = env({ rank: () => 5, custom: key => key === '渡劫' })
    expect(evalGoal({ type: 'rank', min: 3 }, rich)).toBe(true)
    expect(evalGoal({ type: 'custom', key: '渡劫' }, rich)).toBe(true)
    expect(evalGoal({ type: 'custom', key: '飞升' }, rich)).toBe(false)
  })

  it('进度视图:不可量化的那类只答达成与否;自定义没环境时返回 null', () => {
    expect(goalProgress({ type: 'position', major: 2 }, env({ level: () => 1 }))).toEqual({ done: false, ratio: null, current: null, target: null })
    expect(goalProgress({ type: 'rank', min: 3 }, env({ rank: () => 2 }))).toEqual({ done: false, ratio: null, current: 2, target: 3 })
    expect(goalProgress({ type: 'custom', key: 'x' }, env())).toBeNull()
  })

  it('组合条件:全部 / 任一,可嵌套;空数组的语义写清', () => {
    const e = env({ counters: { kill: 5, explore: 1 }, level: () => 2, custom: k => k === '渡劫' })
    const kill5 = { type: 'counter', key: 'kill', value: 5 } as const
    const kill9 = { type: 'counter', key: 'kill', value: 9 } as const
    const lv3 = { type: 'level', min: 3 } as const
    const tribulation = { type: 'custom', key: '渡劫' } as const

    expect(evalGoal({ type: 'all', of: [kill5, { type: 'level', min: 2 }] }, e)).toBe(true)
    expect(evalGoal({ type: 'all', of: [kill5, lv3] }, e)).toBe(false)
    expect(evalGoal({ type: 'any', of: [kill9, lv3, tribulation] }, e)).toBe(true)
    expect(evalGoal({ type: 'any', of: [kill9, lv3] }, e)).toBe(false)
    // 嵌套:（杀够 5 且到 2 级）或 渡过劫
    expect(evalGoal({ type: 'any', of: [{ type: 'all', of: [kill5, { type: 'level', min: 2 }] }, lv3] }, e)).toBe(true)
    // 空数组:all 成立(没有要求),any 不成立(没有一条路)
    expect(evalGoal({ type: 'all', of: [] }, e)).toBe(true)
    expect(evalGoal({ type: 'any', of: [] }, e)).toBe(false)
  })

  it('组合条件的进度:自己不给比例,但把每个子的进度摊开', () => {
    const e = env({ counters: { kill: 5 }, level: () => 2 })
    const p = goalProgress({ type: 'all', of: [{ type: 'counter', key: 'kill', value: 10 }, { type: 'level', min: 3 }] }, e)
    expect(p?.done).toBe(false)
    expect(p?.ratio).toBeNull()
    expect(p?.parts?.length).toBe(2)
    expect(p?.parts?.[0]).toEqual({ done: false, ratio: 0.5, current: 5, target: 10 })
    expect(p?.parts?.[1]?.done).toBe(false)
  })
})
