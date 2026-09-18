/* eslint-disable no-console */
/**
 * 消融实验 —— 保底到底把"出货"变成了什么样。
 *
 * 上一份用例(`pity.spec.ts`)钉的是**语义**:概率怎么涨、第几次必出、保底照样掷骰。
 * 这一份量的是**手感**:拿一份典型抽卡内容跑一遍,看平均数落在哪、最差能差到哪、
 * 软保底把中位数拉低多少 —— 这些数字是内容作者真正要拿来定 step / cap / hardAt 的依据。
 *
 * 三件被量的事:
 *   ① **硬保底是硬上限**:两万次抽取里最差也不会超过 hardAt(这不是"大概",是判据);
 *   ② **保底把期望拉低了多少**:基础 0.6%(自然期望 167 抽)配 90 抽必出,平均落在哪;
 *   ③ **软保底值不值**:同样一份基础概率,加一段"从第 75 抽起每抽 +6%"之后中位数与
 *      最差怎样变 —— 顺带证明"软保底不封顶"的危害(不封顶就直接撞到硬保底)。
 *
 * 另外钉一条**结构性质**:保底没触发之前,随机流与"完全没有保底"逐抽相同 ——
 * 这是"保底改写结果、不跳过掷骰"在模拟层面的样子(与掉落层同一条纪律)。
 */
import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import { createPityCounter, softChance } from './pity.js'

const BASE = 0.006
const HARD_AT = 90
/** 典型的"从第 75 抽开始给软保底" */
const SOFT_FROM = 75
const SOFT = { step: 0.06, cap: 0.6, from: SOFT_FROM, ceil: 1 } as const

/** 抽到出货为止,返回用了几抽(1 起算) */
function pullsUntilHit(seed: number, mode: 'plain' | 'hard' | 'soft'): number {
  const rng = createRng(seed)
  const counter = createPityCounter(mode === 'plain' ? {} : { hardAt: HARD_AT })
  let state = { counters: {} as Record<string, number> }
  for (let pulls = 1; pulls <= 5000; pulls += 1) {
    const soft = mode === 'soft' ? SOFT : undefined
    const out = counter.roll(state, 'banner', rng, BASE, soft)
    state = out.state
    if (out.hit) return pulls
  }
  return Number.POSITIVE_INFINITY
}

/** 掷点固定的随机源(会数骰子):用来把"必出"这件事变成确定性的判据 */
function fixedRng(value: number): { rng: Rng; draws: () => number } {
  let draws = 0
  return {
    rng: {
      next: () => (draws += 1, value),
      int: () => (draws += 1, 0),
      float: () => (draws += 1, value),
      chance: p => (draws += 1, value < p),
      pick: arr => (draws += 1, arr[0]!),
      weighted: items => (draws += 1, items[0]!)
    },
    draws: () => draws
  }
}

function stats(seedFrom: number, runs: number, mode: 'plain' | 'hard' | 'soft') {
  const results: number[] = []
  for (let i = 0; i < runs; i += 1) results.push(pullsUntilHit(seedFrom + i, mode))
  const sorted = [...results].sort((a, b) => a - b)
  const sum = results.reduce((a, b) => a + b, 0)
  return {
    mean: sum / runs,
    median: sorted[Math.floor(runs / 2)]!,
    p90: sorted[Math.floor(runs * 0.9)]!,
    worst: sorted[sorted.length - 1]!
  }
}

const RUNS = 20_000

describe('消融实验 —— 保底把出货变成了什么样', () => {
  it('三份内容各跑两万次:看平均、中位数、九成位与最差', () => {
    const plain = stats(1, RUNS, 'plain')
    const hard = stats(1, RUNS, 'hard')
    const soft = stats(1, RUNS, 'soft')
    const show = (label: string, s: ReturnType<typeof stats>, from: number): void =>
      console.log(
        `  ${label}:平均 ${s.mean.toFixed(1)} 抽(理论 ${from.toFixed(0)})· 中位 ${s.median} · 九成位 ${s.p90} · 最差 ${s.worst}`
      )
    show('只有基础概率', plain, 1 / BASE)
    show(`配 ${HARD_AT} 抽必出`, hard, hard.mean)
    show(`再加软保底(第 ${SOFT_FROM} 抽起每抽 +${SOFT.step * 100}%)`, soft, soft.mean)

    // ① 硬保底是硬上限 —— 两万次里最差也只会到 hardAt
    expect(hard.worst).toBe(HARD_AT)
    // 软保底通常更早就出货了,所以它的"最差"只会更小
    expect(soft.worst).toBeLessThanOrEqual(HARD_AT)
    // ② 保底把期望从自然期望(167 抽)拉下来一大截
    expect(plain.mean).toBeGreaterThan(150)
    expect(plain.mean).toBeLessThan(185)
    expect(hard.mean).toBeLessThan(70)
    expect(hard.mean).toBeGreaterThan(50)
    // ③ 软保底把中位数与九成位都往下推(而最差仍然由硬保底兜着)
    expect(soft.median).toBeLessThan(hard.median)
    expect(soft.p90).toBeLessThan(hard.p90)
    expect(soft.mean).toBeLessThan(hard.mean)
  })

  it('不封顶的软保底 = 偷偷换成硬保底(这条正是"涨幅封顶"要防的事)', () => {
    // 从第 75 抽起每抽 +6%、不封顶:到第 92 抽时加成已经 1.08 → 概率被 ceil 夹成 1
    const uncapped = { step: 0.06, cap: 99, from: SOFT_FROM } as const
    const capped = { step: 0.06, cap: 0.6, from: SOFT_FROM } as const
    console.log(
      `  第 92 抽的概率:不封顶 = ${(softChance(BASE, 92, uncapped) * 100).toFixed(0)}%(必出)· 封顶 0.6 = ${(softChance(BASE, 92, capped) * 100).toFixed(1)}%(还是概率)`
    )
    expect(softChance(BASE, 92, uncapped)).toBe(1)
    expect(softChance(BASE, 92, capped)).toBeLessThan(1)
    expect(softChance(BASE, 92, capped)).toBeLessThanOrEqual(BASE + 0.6 + 1e-12)
  })

  it('保底没触发之前随机流与"完全没有保底"逐抽相同;触发那一次也只是改写结果', () => {
    const withPity = createPityCounter({ hardAt: HARD_AT })
    const without = createPityCounter({})
    const a = fixedRng(0.999) // 掷点固定:前 89 抽必然"没出"
    const b = fixedRng(0.999)
    let sa = { counters: {} as Record<string, number> }
    let sb = { counters: {} as Record<string, number> }
    for (let pulls = 1; pulls < HARD_AT; pulls += 1) {
      const outA = withPity.roll(sa, 'banner', a.rng, BASE, SOFT)
      const outB = without.roll(sb, 'banner', b.rng, BASE, SOFT)
      sa = outA.state
      sb = outB.state
      expect(outA.hit).toBe(outB.hit) // 逐抽一致
      expect(outA.chance).toBe(outB.chance)
    }
    expect(a.draws()).toBe(b.draws()) // 两者掷的骰子一样多(保底没触发,两边都在掷)
    expect(a.draws()).toBe(HARD_AT - 1)
    // 第 90 抽:保底顶出来(而"没有保底"的那份还是要看概率)
    const finalA = withPity.roll(sa, 'banner', a.rng, BASE, SOFT)
    expect(finalA.hit).toBe(true)
    expect(finalA.pity).toBe(true)
    expect(a.draws()).toBe(HARD_AT) // 保底那一次**照样掷了骰子**
    expect(without.roll(sb, 'banner', b.rng, BASE, SOFT).hit).toBe(false) // 没有保底的还是没出
  })

  it('软保底要"从第几抽开始"由调用方算 —— 同一份曲线,窗口不同就是不同内容', () => {
    // 从第 1 抽就涨 vs 从第 75 抽开始涨:同样是第 80 抽,概率不同
    const fromStart = softChance(BASE, 80, { step: 0.06, cap: 0.6 })
    const fromSeventyFifth = softChance(BASE, 80, SOFT)
    expect(fromStart).toBeGreaterThan(fromSeventyFifth)
    expect(fromSeventyFifth).toBeCloseTo(BASE + 6 * SOFT.step, 12)
    console.log(`  第 80 抽的概率:一开始就涨 = ${(fromStart * 100).toFixed(1)}% · 从第 75 抽起涨 = ${(fromSeventyFifth * 100).toFixed(1)}%`)
  })
})
