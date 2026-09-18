/**
 * 抽取保底 —— 软保底(抽得越多越容易出)与硬保底(第 N 次必出)。
 *
 * 掉落层(`drops.ts`)管的是**单次判定**,这里是**跨次数的那本账**。三条口径:
 *
 *   一 **软保底要涨,也要封顶**:见得 / 抽得多了概率该涨(本作"照面次数保底"就是这个),
 *      但涨幅必须封顶 —— 否则到了后期概率被抬到 1,那就成了硬保底的另一种写法,中间那些
 *      次数的意义全没了;上下限也要有,否则基础概率低到 0 时永远出不来;
 *   二 **硬保底 = 第 `hardAt` 次必出,而且照样掷一次骰子**:保底是**改写这一次的结果**,
 *      不是跳过随机 —— 否则"开不开保底"会让后续随机流整体错位(与掉落层同一条纪律,
 *      见 DEC-127);
 *   三 **计数什么时候清零是内容的选择**:出货就清(常见)、还是只在保底顶出来之后才清
 *      (更苛:自然出货不算把保底额度用掉)—— 两种作品都有,故写成 `resetOn`。
 *
 * 概率本身不进判定前的归一? —— 进:`softChance` 的上下限就是归一(默认 [0, 1]),
 * 叠出来的概率不该有 1.8 或 -0.2 这种值传到掷骰那一步。
 */
import type { Rng } from './rng.js'

export interface SoftPity {
  /** 每多一次(每多一份照面),概率加多少 */
  step: number
  /** 最多加多少 —— 涨幅封顶 */
  cap: number
  /** 概率下限(默认 0) */
  floor?: number
  /** 概率上限(默认 1) */
  ceil?: number
}

/**
 * 软保底:把基础概率按"已经几次"抬高,并夹在 `[floor, ceil]` 里。
 *
 * `tries` 是**已经经历了几次**,由调用方定义起算:本作的"照面次数"这次也算一次(1 起算),
 * 抽卡常见的软保底则是"这次还没抽"(0 起算)。两种都写得出,写法见下面两个用法。
 */
export function softChance(base: number, tries: number, pity: SoftPity): number {
  const seen = Number.isFinite(tries) ? Math.max(0, tries) : 0
  const bump = Math.min(Math.max(0, pity.cap), seen * pity.step)
  const raw = (Number.isFinite(base) ? base : 0) + bump
  return Math.min(pity.ceil ?? 1, Math.max(pity.floor ?? 0, raw))
}

export interface PityState {
  /** 各池子"已经抽了几次没出" */
  counters: Record<string, number>
}

export interface PityRoll {
  /** 掷过之后的账(出货按 `resetOn` 清账;没出则 +1) */
  state: PityState
  /** 这一次出没出 */
  hit: boolean
  /** 是不是硬保底顶出来的(界面可以明说"这一次是保底") */
  pity: boolean
  /** 这一次实际用的概率(硬保底顶出来时为 1) */
  chance: number
}

export interface PityConfig {
  /** 第几次必出(不配 = 只有软保底);`hardAt: 90` 就是第 90 抽必出 */
  hardAt?: number
  /**
   * 什么时候把计数清零:
   *   `'hit'`(默认)—— 出货就清(常见)
   *   `'pity'` —— 只在保底顶出来那一次清(自然出货不消耗保底额度)
   */
  resetOn?: 'hit' | 'pity'
}

export function createPityCounter(config: PityConfig = {}) {
  const hardAt = config.hardAt !== undefined && config.hardAt >= 1 ? Math.floor(config.hardAt) : undefined
  const resetOn: 'hit' | 'pity' = config.resetOn ?? 'hit'

  /** 这个池子已经几次没出(坏值当 0) */
  const countOf = (state: PityState, pool: string): number => {
    const raw = state.counters[pool]
    return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  }

  /** 这一次(第 `count + 1` 次)的概率:硬保底到点就是 1,否则走软保底 */
  const chanceOf = (state: PityState, pool: string, base: number, soft?: SoftPity): number => {
    const next = countOf(state, pool) + 1
    if (hardAt !== undefined && next >= hardAt) return 1
    return soft ? softChance(base, next, soft) : Math.min(1, Math.max(0, base))
  }

  /**
   * 掷一次:**保底也照样掷骰**(随机流与开不开保底无关)。
   * 没出 → 计数 +1;出了 → 按 `resetOn` 决定清不清。
   */
  const roll = (state: PityState, pool: string, rng: Rng, base: number, soft?: SoftPity): PityRoll => {
    const count = countOf(state, pool)
    const chance = chanceOf(state, pool, base, soft)
    const forced = hardAt !== undefined && count + 1 >= hardAt
    const rolled = rng.chance(chance) // 先掷、再看保底:保底改写这一次的结果,不跳过这颗骰子
    const hit = forced || rolled
    const clear = hit && (resetOn === 'hit' || forced)
    return {
      state: clear ? { counters: { ...state.counters, [pool]: 0 } } : { counters: { ...state.counters, [pool]: count + 1 } },
      hit,
      pity: forced,
      chance
    }
  }

  /** 手动清零(换池、活动结束这类事由调用方决定) */
  const reset = (state: PityState, pool: string): PityState => ({ counters: { ...state.counters, [pool]: 0 } })

  return { hardAt, resetOn, countOf, chanceOf, roll, reset }
}

export type PityCounter = ReturnType<typeof createPityCounter>
