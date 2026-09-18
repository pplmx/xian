/**
 * 掉落表 —— "这一场给不给、给几份"。
 *
 * 看起来只是几条 `if (rng.chance(...))`,但真实作品里踩过两个坑,都由这一层负责:
 *
 *   一 **概率必须先钳到 [0,1]**:`rng.chance(p)` 的实现通常是 `rand() < p`,
 *      而 p 是"基础概率 × 福缘 × 首领 × 词条 × 活动"叠出来的 —— 一旦叠过 1 就变成
 *      "必然掉落",叠到负数就"永不掉落",而且界面上完全看不出来。故所有乘法做完之后、
 *      进判定之前,一定先夹到 `[0,1]`(还可给 `chanceCap` 单独设上限,如"再高也不超过 90%")。
 *   二 **保底要能表达**:"首领第一抽必出"这类规则若靠 `||` 短路写着,既难看见也难改。
 *      这里写成条目上的 `guaranteed` + 调用方的 `guarantee` 开关(默认关),
 *      并且**每次尝试照样掷一次骰子**(保底只改写结果)—— 这样"开不开保底"不影响
 *      后面的随机流,与 `rng.chance(p) || 保底` 的手写写法逐个随机数一致。
 *
 * 另外几处口径也由这一层定清楚:
 *   · "战利品翻倍"翻的是**份数**,不是掷骰次数 —— 掷骰次数一变,概率的含义就跟着变;
 *   · `attempts` 是"试几次",默认**不吃** `countMult`(要"多掷几次"就显式开
 *     `scalesWithAttempts`,本作的装备掉落正是这种:多一倍就多抽一次);
 *   · 每次命中给 `count` 份,默认吃 `countMult`(`scalesWithCount: false` 可关);
 *   · **顺序即声明顺序** —— 想让掉落表不改变随机流,就按声明顺序掷(逐条 `rollOne`),
 *     需要额外随机(生成装备、抽内容池)时用 `onHit` **在命中当场**做,别攒到最后。
 */
import type { Rng } from './rng.js'

export interface DropEntry {
  /** 掉落键(资源键、实物键都行 —— 库里不解释它是什么) */
  key: string
  /** 基础概率(会先钳到 [0,1],再乘 `chanceMult`) */
  chance: number
  /** 概率上限(可选):例如"再高也不超过 90%" */
  chanceCap?: number
  /** 概率是否吃 `chanceMult`(默认吃 —— 有些基础掉落不该被福缘放大) */
  scalesWithChance?: boolean
  /** 试几次(默认 1;默认不吃 `countMult`) */
  attempts?: number
  /** 试的次数是否吃 `countMult`(默认**不吃** —— 翻倍通常翻的是份数) */
  scalesWithAttempts?: boolean
  /** 每次命中给几份:固定数或 `[min, max]` 闭区间(默认 1) */
  count?: number | readonly [number, number]
  /** 份数是否吃 `countMult`(默认吃) */
  scalesWithCount?: boolean
  /** 保底:调用方开 `guarantee` 时,这条的**第一次尝试必中** */
  guaranteed?: boolean
}

export interface DropHit {
  key: string
  /** 试了几次里中了几次 */
  hits: number
  /** 一共给了几份(命中次数 × 每次份数) */
  count: number
}

export interface DropOptions {
  /** 概率倍率(福缘 / 幸运 / 活动) */
  chanceMult?: number
  /** 数量倍率(战利品翻倍 / 首领) */
  countMult?: number
  /** 开保底(首领第一抽必出这类规则) */
  guarantee?: boolean
  /**
   * 命中当场处理 —— 第二参是**这一次命中得到的份数**。
   *
   * 存在的理由只有一个:生成装备、抽内容池这类后续动作**自己也要掷骰**。
   * 若等整张表掷完再统一生成,那些掷骰就会挤到别的判定之后,随机流与手写实现
   * 从此错位("明明只改了掉落表的写法,战斗后半段的随机结果全变了")。
   */
  onHit?: (entry: DropEntry, count: number) => void
}

export function createDropTable(entries: readonly DropEntry[]) {
  const effectiveChance = (entry: DropEntry, opts: DropOptions): number => {
    const mult = (entry.scalesWithChance ?? true) ? (opts.chanceMult ?? 1) : 1
    const raw = (entry.chance || 0) * mult
    const capped = entry.chanceCap === undefined ? raw : Math.min(entry.chanceCap, raw)
    // 进判定之前一定先夹到 [0,1]:叠出来的概率不能不合法
    return Math.min(1, Math.max(0, capped))
  }

  const attemptsOf = (entry: DropEntry, opts: DropOptions): number => {
    const base = Math.max(0, Math.floor(entry.attempts ?? 1))
    const mult = (entry.scalesWithAttempts ?? false) ? (opts.countMult ?? 1) : 1
    return Math.max(0, Math.floor(base * mult))
  }

  const countPerHit = (entry: DropEntry, rng: Rng, opts: DropOptions): number => {
    const spec = entry.count ?? 1
    const rolled = typeof spec === 'number' ? spec : rng.int(spec[0], spec[1])
    const mult = (entry.scalesWithCount ?? true) ? (opts.countMult ?? 1) : 1
    return Math.max(0, Math.floor(rolled * mult))
  }

  /** 掷一条(供"掷一条、处理一条"的用法 —— 这样随机流顺序与手写一致) */
  const rollOne = (entry: DropEntry, rng: Rng, opts: DropOptions = {}): DropHit => {
    const chance = effectiveChance(entry, opts)
    const attempts = attemptsOf(entry, opts)
    let hits = 0
    let count = 0
    for (let i = 0; i < attempts; i += 1) {
      // 先掷、再看保底:保底是"改写这一次的结果",不是"跳过这一次的骰子"
      const rolled = rng.chance(chance)
      const forced = i === 0 && entry.guaranteed === true && (opts.guarantee ?? false)
      if (rolled || forced) {
        const gained = countPerHit(entry, rng, opts)
        hits += 1
        count += gained
        opts.onHit?.(entry, gained)
      }
    }
    return { key: entry.key, hits, count }
  }

  /** 掷整张表(没有额外随机时用;顺序即声明顺序) */
  const roll = (rng: Rng, opts: DropOptions = {}): DropHit[] =>
    entries.map(entry => rollOne(entry, rng, opts)).filter(hit => hit.hits > 0)

  return { entries, rollOne, roll, effectiveChance }
}

export type DropTable = ReturnType<typeof createDropTable>
