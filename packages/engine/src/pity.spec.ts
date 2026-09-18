import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import { createPityCounter, softChance } from './pity.js'

/** 会数骰子的随机源 */
function counter(seed: number, value = false): { rng: Rng; draws: () => number } {
  const base = createRng(seed)
  let draws = 0
  return {
    rng: {
      next: () => {
        draws += 1
        return value ? 0.99 : base.next()
      },
      int: (min, max) => {
        draws += 1
        return base.int(min, max)
      },
      float: (min, max) => {
        draws += 1
        return base.float(min, max)
      },
      chance: p => {
        draws += 1
        return value ? 0.999999 < p : base.chance(p)
      },
      pick: arr => {
        draws += 1
        return base.pick(arr)
      },
      weighted: (items, weightOf) => {
        draws += 1
        return base.weighted(items, weightOf)
      }
    },
    draws: () => draws
  }
}

const empty = { counters: {} }

describe('软保底 —— 见得多了概率涨,但涨幅封顶', () => {
  it('基础概率 + 每多一次加一点,并夹在上下限里', () => {
    const soft = { step: 0.03, cap: 0.35, floor: 0.04, ceil: 0.9 }
    expect(softChance(0.2, 0, soft)).toBeCloseTo(0.2, 12)
    expect(softChance(0.2, 1, soft)).toBeCloseTo(0.23, 12)
    expect(softChance(0.2, 5, soft)).toBeCloseTo(0.35, 12)
    // 涨幅封顶:加满 0.35 之后不再涨
    expect(softChance(0.2, 100, soft)).toBeCloseTo(0.55, 12)
    // 上下限:基础概率太低 / 太高时都被夹住
    expect(softChance(0.001, 0, soft)).toBeCloseTo(0.04, 12)
    expect(softChance(0.89, 10, soft)).toBeCloseTo(0.9, 12)
  })

  it('默认上下限就是 [0, 1]:叠出来的概率不会再变成 1.8 或 -0.2', () => {
    expect(softChance(1.8, 0, { step: 0.1, cap: 1 })).toBe(1)
    expect(softChance(-0.5, 0, { step: 0.1, cap: 1 })).toBe(0)
    expect(softChance(0.5, 100, { step: 0.1, cap: 1 })).toBe(1)
  })

  it('与"照面次数保底"那类写法同形:逐点等于手写公式', () => {
    for (const rank of [1, 3, 9]) {
      for (const level of [0, 40, 100]) {
        const base = 0.2 + level / 260 - (rank - 1) * 0.018
        for (const seen of [0, 1, 3, 12, 40]) {
          const manual = Math.max(0.04, Math.min(0.9, base + Math.min(0.35, seen * 0.03)))
          expect(softChance(base, seen, { step: 0.03, cap: 0.35, floor: 0.04, ceil: 0.9 })).toBe(manual)
        }
      }
    }
  })

  it('坏值当 0:负数 / NaN 的"次数"不该把概率拉下去或拉成 NaN', () => {
    expect(softChance(0.2, -5, { step: 0.03, cap: 0.35 })).toBeCloseTo(0.2, 12)
    expect(softChance(0.2, Number.NaN, { step: 0.03, cap: 0.35 })).toBeCloseTo(0.2, 12)
    expect(Number.isFinite(softChance(Number.NaN, 3, { step: 0.03, cap: 0.35 }))).toBe(true)
  })
})

describe('硬保底 —— 第 N 次必出,而且照样掷骰', () => {
  const gacha = createPityCounter({ hardAt: 90 })

  it('第 90 次必出:第 89 次还按概率,第 90 次概率就是 1', () => {
    expect(gacha.chanceOf({ counters: { banner: 88 } }, 'banner', 0.006)).toBeCloseTo(0.006, 12)
    expect(gacha.chanceOf({ counters: { banner: 89 } }, 'banner', 0.006)).toBe(1)
    expect(gacha.countOf({ counters: { banner: 89 } }, 'banner')).toBe(89)
  })

  it('hardAt: 1 就是每次都必出(内容写歪时的极端形状也得有确定行为)', () => {
    const every = createPityCounter({ hardAt: 1 })
    expect(every.chanceOf(empty, 'banner', 0.006)).toBe(1)
    expect(every.roll(empty, 'banner', counter(1).rng, 0.006).hit).toBe(true)
  })

  it('保底也照样掷骰:开不开保底,随机消耗一样(不然后续随机流错位)', () => {
    const withPity = createPityCounter({ hardAt: 3 })
    const without = createPityCounter({})
    const a = counter(7)
    const b = counter(7)
    let sa = { counters: {} as Record<string, number> }
    let sb = { counters: {} as Record<string, number> }
    for (let i = 0; i < 10; i += 1) {
      sa = withPity.roll(sa, 'g', a.rng, 0).state
      sb = without.roll(sb, 'g', b.rng, 0).state
    }
    expect(a.draws()).toBe(b.draws())
    expect(a.draws()).toBe(10)
  })

  it('保底顶出来的那一次:hit 与 pity 都是 true', () => {
    const out = gacha.roll({ counters: { banner: 89 } }, 'banner', counter(3).rng, 0.006)
    expect(out.hit).toBe(true)
    expect(out.pity).toBe(true)
    expect(out.chance).toBe(1)
    expect(out.state.counters.banner).toBe(0) // 出货即清(默认口径)
  })

  it('没出货:计数加一,state 是新的(入参不动)', () => {
    const start = { counters: { banner: 4 } }
    const out = gacha.roll(start, 'banner', counter(5, true).rng, 0.0000001)
    expect(out.hit).toBe(false)
    expect(out.pity).toBe(false)
    expect(out.state.counters.banner).toBe(5)
    expect(start.counters.banner).toBe(4)
  })

  it('自然出货:默认清账;选了 resetOn:"pity" 时不清(保底额度不算用掉)', () => {
    const natural = createPityCounter({ hardAt: 10, resetOn: 'hit' })
    const strict = createPityCounter({ hardAt: 10, resetOn: 'pity' })
    const hitAt = counter(11, false)
    const naturalOut = natural.roll({ counters: { p: 3 } }, 'p', hitAt.rng, 1)
    const strictOut = strict.roll({ counters: { p: 3 } }, 'p', counter(11).rng, 1)
    expect(naturalOut.hit).toBe(true)
    expect(naturalOut.state.counters.p).toBe(0)
    expect(strictOut.hit).toBe(true)
    expect(strictOut.state.counters.p).toBe(4) // 只加一,不清
    // 保底顶出来的那一次:两种口径都清
    expect(strict.roll({ counters: { p: 9 } }, 'p', counter(1).rng, 0).state.counters.p).toBe(0)
  })

  it('池子分开记:换池不影响另一个池子的保底', () => {
    const out = gacha.roll({ counters: { banner: 50, weapon: 89 } }, 'weapon', counter(2).rng, 0.006)
    expect(out.state.counters.banner).toBe(50)
    expect(out.state.counters.weapon).toBe(0)
  })

  it('手动清零:换池 / 活动结束由调用方决定', () => {
    expect(gacha.reset({ counters: { banner: 30 } }, 'banner')).toEqual({ counters: { banner: 0 } })
  })

  it('坏值当 0:NaN / 负数 / 小数的计数不该渗进保底判定', () => {
    expect(gacha.countOf({ counters: { p: Number.NaN } }, 'p')).toBe(0)
    expect(gacha.countOf({ counters: { p: -3 } }, 'p')).toBe(0)
    expect(gacha.countOf({ counters: { p: 3.7 } }, 'p')).toBe(3)
  })
})
