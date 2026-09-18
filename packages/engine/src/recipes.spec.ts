import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import type { CraftCost } from './recipes.js'
import { createRecipeRunner } from './recipes.js'

interface Ctx {
  herb: number
  stone: number
  known: boolean
  rate: number
  bonus?: number
}

/** 会数骰子的随机源:掷点固定为 value */
function fixed(value: number): { rng: Rng; draws: () => number } {
  let draws = 0
  return {
    rng: {
      next: () => (draws += 1, value),
      int: () => (draws += 1, 1),
      float: () => (draws += 1, value),
      chance: p => (draws += 1, value < p),
      pick: arr => (draws += 1, arr[0]!),
      weighted: items => (draws += 1, items[0]!)
    },
    draws: () => draws
  }
}

const runner = createRecipeRunner<Ctx>({
  costs: () => [
    { key: 'herb', amount: 10 },
    { key: 'stone', amount: 100 }
  ],
  blocked: (_id, ctx) => (ctx.known ? undefined : '不知此方'),
  affordable: (_id, ctx) => (ctx.herb >= 10 ? undefined : '灵草不足'),
  // 失败时灵草保下一半、灵石不退(取整之类的算术由内容自己做)
  spentOnFail: cost => (cost.key === 'herb' ? cost.amount - 5 : cost.amount),
  rate: (_id, ctx) => ctx.rate,
  bonus: (_id, ctx) => ctx.bonus ?? 0,
  bonusCap: 0.8
})

const rich: Ctx = { herb: 99, stone: 999, known: true, rate: 0.5 }
const spentOf = (out: { spent: readonly CraftCost[] }): Record<string, number> =>
  Object.fromEntries(out.spent.map(c => [c.key, c.amount]))

describe('配方执行 —— 开炉、扣料、成败与双成', () => {
  it('成功:全额扣料,产出 1 件', () => {
    const out = runner.run('p1', { ...rich, rate: 1 }, fixed(0.5).rng)
    expect(out).toMatchObject({ fired: true, reason: '', succeeded: true, produced: 1, extra: false, chance: 1 })
    expect(spentOf(out)).toEqual({ herb: 10, stone: 100 })
  })

  it('失败:灵草保一半、灵石不退(每条花费各自说明)', () => {
    const out = runner.run('p1', { ...rich, rate: 0 }, fixed(0.5).rng)
    expect(out).toMatchObject({ fired: true, succeeded: false, produced: 0, extra: false })
    expect(spentOf(out)).toEqual({ herb: 5, stone: 100 })
  })

  it('"没开炉"与"开炉失败"是两回事:门槛没过什么都不发生', () => {
    const out = runner.run('p1', { ...rich, known: false }, fixed(0.5).rng)
    expect(out).toMatchObject({ fired: false, reason: '不知此方', succeeded: false, produced: 0, chance: 0 })
    expect(out.spent).toEqual([])
  })

  it('材料不足也不开炉,而且门槛先于材料(先报哪句话由顺序定)', () => {
    const short = runner.run('p1', { ...rich, herb: 3 }, fixed(0.5).rng)
    expect(short).toMatchObject({ fired: false, reason: '灵草不足' })
    const bothFailing: Ctx = { ...rich, herb: 3, known: false }
    expect(runner.run('p1', bothFailing, fixed(0.5).rng).reason).toBe('不知此方')
  })

  it('随机只在真开炉时消耗:没开炉一颗骰子都不掷', () => {
    const idle = fixed(0.5)
    runner.run('p1', { ...rich, known: false }, idle.rng)
    expect(idle.draws()).toBe(0)
    const fired = fixed(0.5)
    runner.run('p1', rich, fired.rng)
    expect(fired.draws()).toBeGreaterThanOrEqual(1)
  })

  it('双成在成功之后再掷一次,并夹到上限', () => {
    // 成功率 1、双成率 0.9 → 被夹到 0.8;掷点 0.79 落在 0.8 之内 → 双成
    const out = runner.run('p1', { ...rich, rate: 1, bonus: 0.9 }, fixed(0.79).rng)
    expect(out.extra).toBe(true)
    expect(out.produced).toBe(2)
    // 掷点 0.85 超过 0.8 → 双成没中(说明上限真的起了作用)
    const miss = runner.run('p1', { ...rich, rate: 1, bonus: 0.9 }, fixed(0.85).rng)
    expect(miss.extra).toBe(false)
    expect(miss.produced).toBe(1)
  })

  it('失败之后不再掷双成(失败的那一次只花一颗骰子)', () => {
    const rng = fixed(0.999)
    runner.run('p1', { ...rich, rate: 0, bonus: 1 }, rng.rng)
    expect(rng.draws()).toBe(1)
  })

  it('成功率被夹到 [0,1]:叠出来的概率不会传出去', () => {
    expect(runner.run('p1', { ...rich, rate: 1.8 }, fixed(0.5).rng).chance).toBe(1)
    expect(runner.run('p1', { ...rich, rate: -0.4 }, fixed(0.5).rng).chance).toBe(0)
    expect(runner.run('p1', { ...rich, rate: Number.NaN }, fixed(0.5).rng).chance).toBe(0)
  })

  it('不配双成 / 不配失败保料时,口径都退化成最简单的那种', () => {
    const plain = createRecipeRunner<Ctx>({ costs: () => [{ key: 'herb', amount: 3 }], rate: () => 0 })
    const out = plain.run('p1', rich, fixed(0.5).rng)
    expect(out.succeeded).toBe(false)
    expect(spentOf(out)).toEqual({ herb: 3 }) // 失败也全额扣:没有"保料"这回事
  })

  it('基础产出可以不是 1(双成时再加 1)', () => {
    const multi = createRecipeRunner<Ctx>({
      costs: () => [{ key: 'herb', amount: 1 }],
      rate: () => 1,
      bonus: () => 1,
      baseYield: () => 3
    })
    expect(multi.run('p1', rich, fixed(0).rng).produced).toBe(4)
  })

  it('产出与花费的回报是"实际发生时"的那一份(调用方照它记账即可)', () => {
    // 同一份内容,成功与失败各自回报自己的扣法:调用方不需要再算一遍
    const win = runner.run('p1', { ...rich, rate: 1 }, createRng(3))
    const lose = runner.run('p1', { ...rich, rate: 0 }, createRng(3))
    expect(spentOf(win)).toEqual({ herb: 10, stone: 100 })
    expect(spentOf(lose)).toEqual({ herb: 5, stone: 100 })
    expect(win.produced).toBeGreaterThan(lose.produced)
  })
})
