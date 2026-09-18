/* eslint-disable no-console */
/**
 * 消融实验 —— 开一炉的期望账:平均花多少料、出多少丹。
 *
 * `recipes.spec.ts` 钉的是语义(没开炉 ≠ 开炉失败、失败按条折减、成功后才掷双成、不真开炉不掷骰);
 * 这一份把**一炉的期望**算出来 —— 内容作者调"成功率 / 保料率 / 双成率"时真正要看的数。
 *
 * 三条量出来的结论:
 *   ① **期望产出 = 成功率 × (1 + 双成率)**:成功率 55%、双成 35% → 平均一炉 0.74 件
 *      (不是 0.55,也不是 0.9 —— "失败无产出、双成才多一件"两头都要算);
 *   ② **期望花费按"成败两条腿"加权**:灵草 4(失败保 2)在 55% 成功率下平均一炉 3.10 株,
 *      而门槛费 20(失败全退)平均一炉 11.00 —— **保料率越高,失败越"只是慢",不是"亏"**;
 *   ③ **没开炉与开炉失败在随机流上完全不同**:没开炉一颗骰子不掷(实测消耗 0),
 *      开炉则先掷成败(1 颗),成功了才掷双成(再 1 颗)—— 这条是"同种子可复现"的前提。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { Rng } from './rng.js'
import { createRecipeRunner } from './recipes.js'

const RUNS = 20_000

/** 一炉丹药:灵草 4 株(失败保 2)、灵石 20(门槛费,失败全退) */
const RECIPE = {
  herbs: 4,
  fee: 20
}

const runner = createRecipeRunner<{ rate: number; bonus: number }, number>({
  costs: () => [
    { key: 'herb', amount: RECIPE.herbs },
    { key: 'stone', amount: RECIPE.fee }
  ],
  rate: (_id, ctx) => ctx.rate,
  bonus: (_id, ctx) => ctx.bonus,
  bonusCap: 0.8,
  baseYield: () => 1,
  // 失败时:灵草保下两株(只赔一半),门槛费全退
  spentOnFail: cost => (cost.key === 'herb' ? 2 : 0)
})

/** 多跑几炉,把期望摊出来 */
function furnace(ctx: { rate: number; bonus: number }): {
  successRate: number
  bonusRate: number
  yieldPerRun: number
  herbPerRun: number
  stonePerRun: number
} {
  const rng = createRng('一炉')
  let ok = 0
  let extra = 0
  let produced = 0
  let herb = 0
  let stone = 0
  for (let i = 0; i < RUNS; i += 1) {
    const outcome = runner.run('pill', ctx, rng)
    if (outcome.succeeded) {
      ok += 1
      if (outcome.extra) extra += 1
      produced += outcome.produced
    }
    for (const spent of outcome.spent) {
      if (spent.key === 'herb') herb += spent.amount
      if (spent.key === 'stone') stone += spent.amount
    }
  }
  return {
    successRate: ok / RUNS,
    bonusRate: ok > 0 ? extra / ok : 0,
    yieldPerRun: produced / RUNS,
    herbPerRun: herb / RUNS,
    stonePerRun: stone / RUNS
  }
}

describe('消融实验 —— 开一炉的期望账', () => {
  it('期望产出 = 成功率 × (1 + 双成率)', () => {
    const stats = furnace({ rate: 0.55, bonus: 0.35 })
    console.log(
      `  成功率 55% / 双成 35% 跑 ${RUNS} 炉:实测成功 ${(stats.successRate * 100).toFixed(1)}% · 双成(在成功里)${(stats.bonusRate * 100).toFixed(1)}% · 平均一炉 ${stats.yieldPerRun.toFixed(4)} 件`
    )

    // ① 期望 = p × (1 + b) —— 两头都要算
    expect(stats.successRate).toBeCloseTo(0.55, 2)
    expect(stats.bonusRate).toBeCloseTo(0.35, 2)
    // 两万炉的采样波动在 ±0.02 量级,所以按绝对误差比(而不是钉死到小数点后两位)
    expect(Math.abs(stats.yieldPerRun - 0.55 * 1.35)).toBeLessThan(0.02)
    // 防空转:与前两种"想当然的算法"都不同(0.55 或 0.9)
    expect(stats.yieldPerRun).toBeGreaterThan(0.55)
    expect(stats.yieldPerRun).toBeLessThan(0.9)
  })

  it('期望花费按成败两条腿加权:灵草 3.10,门槛费 11.00', () => {
    const stats = furnace({ rate: 0.55, bonus: 0.35 })
    console.log(
      `  平均一炉消耗:灵草 ${stats.herbPerRun.toFixed(3)} 株 · 灵石 ${stats.stonePerRun.toFixed(3)}`
    )

    // ② 灵草:成功 4、失败保 2 → 0.55×4 + 0.45×2 = 3.10
    expect(Math.abs(stats.herbPerRun - (0.55 * 4 + 0.45 * 2))).toBeLessThan(0.05)
    // 门槛费:成功 20、失败 0 → 11.00
    expect(Math.abs(stats.stonePerRun - 0.55 * 20)).toBeLessThan(0.2)
    // 防空转:同一份内容若"失败全扣",灵草期望就是 4 而不是 3.10
    const harsh = createRecipeRunner<{ rate: number }, number>({
      costs: () => [{ key: 'herb', amount: 4 }],
      rate: (_id, ctx) => ctx.rate
    })
    const rng = createRng('硬口径')
    let herb = 0
    for (let i = 0; i < RUNS; i += 1) {
      for (const spent of harsh.run('pill', { rate: 0.55 }, rng).spent) herb += spent.amount
    }
    console.log(`  若失败也全扣,灵草期望是 ${(herb / RUNS).toFixed(3)}(保料把"亏"变成"慢")`)
    expect(herb / RUNS).toBeCloseTo(4, 2)
  })

  it('没开炉与开炉失败在随机流上完全不同:前者一颗骰子都不掷', () => {
    const counting = (): { rng: Rng; draws: () => number } => {
      const inner = createRng('数骰子')
      let draws = 0
      return {
        rng: {
          next: () => (draws += 1, inner.next()),
          int: (min, max) => (draws += 1, inner.int(min, max)),
          float: (min, max) => (draws += 1, inner.float(min, max)),
          chance: p => (draws += 1, inner.chance(p)),
          pick: arr => (draws += 1, inner.pick(arr)),
          weighted: (items, weightOf) => (draws += 1, inner.weighted(items, weightOf))
        },
        draws: () => draws
      }
    }
    // 没开炉:门槛没过
    const blockedRunner = createRecipeRunner<{ ok: boolean }, number>({
      costs: () => [{ key: 'herb', amount: 4 }],
      rate: () => 1,
      blocked: (_id, ctx) => (ctx.ok ? undefined : '还不知此方')
    })
    const a = counting()
    const blockedOutcome = blockedRunner.run('pill', { ok: false }, a.rng)
    const b = counting()
    const firedOutcome = runner.run('pill', { rate: 0.55, bonus: 0.35 }, b.rng)
    console.log(
      `  没开炉:${blockedOutcome.reason} → 掷了 ${a.draws()} 颗骰子 · 真开炉:掷了 ${b.draws()} 颗(成功会再多一颗)`
    )

    // ③ 没开炉 = 不掷骰、不扣料、不计失败
    expect(blockedOutcome.fired).toBe(false)
    expect(blockedOutcome.spent).toEqual([])
    expect(a.draws()).toBe(0)
    // 真开炉:先掷成败(1 颗);成功之后再掷双成(第 2 颗)
    expect(firedOutcome.fired).toBe(true)
    expect(b.draws()).toBe(firedOutcome.succeeded ? 2 : 1)
  })

  it('双成概率被夹到上限:声明 150% 也只有 80%', () => {
    const stats = furnace({ rate: 1, bonus: 1.5 })
    console.log(`  成功率 100%、双成声明 150%(上限 0.8):实测双成率 ${(stats.bonusRate * 100).toFixed(1)}% · 平均一炉 ${stats.yieldPerRun.toFixed(3)} 件`)

    // 双成概率夹到 bonusCap(0.8):不是"必双",也不是 100%
    expect(stats.bonusRate).toBeCloseTo(0.8, 2)
    expect(stats.yieldPerRun).toBeCloseTo(1.8, 2)
    // 防空转:把上限放开到 1,同一份内容就是"必双"
    const uncapped = createRecipeRunner<{ rate: number; bonus: number }, number>({
      costs: () => [],
      rate: (_id, ctx) => ctx.rate,
      bonus: (_id, ctx) => ctx.bonus,
      bonusCap: 1
    })
    const rng = createRng('放开上限')
    const outcomes = Array.from({ length: 50 }, () => uncapped.run('pill', { rate: 1, bonus: 1.5 }, rng))
    expect(outcomes.every(o => o.extra)).toBe(true)
  })
})
