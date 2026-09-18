/**
 * 周期(天时 / 每日 / 赛季)—— "每隔一段游戏时间,世界换一种样子"。
 *
 * 放置 / 养成类游戏几乎都有这一层:每日运势、节气、月相、赛季规则、限时天气。
 * 写起来都不难,但**踩的坑一模一样**,这个模块就负责把坑填掉:
 *
 *   一 **确定性**:同一个周期序号必须永远是同一个结果 —— 刷新不换、回放不换、离线一致。
 *      做法是"由周期序号派生一个**独立的**随机源",而不是去消耗那条全局随机流
 *      (消耗全局流的话,今天是什么天时取决于玩家在此之前掷过多少次骰子);
 *   二 **不依赖现实时间**:周期序号来自"游戏内已经过了多久",不是 `Date.now()` ——
 *      否则改系统时间、跨时区、离线一晚,所见即不同;
 *   三 **分段换池**:不同阶段(界域 / 赛季 / 等级段)各有各的池子,由调用方给"当前用哪个池";
 *   四 **要能预告**:界面要显示"还有多久换"与"接下来几天分别是什么"。
 *
 * 至于"每个周期有哪些候选、权重多少、加什么成" —— 那是内容,归作品。
 */
import type { Mods } from './attributes.js'
import { createRng, type Rng } from './rng.js'

export interface CycleEntry {
  id: string
  /** 展示名 */
  name?: string
  /** 抽取权重(默认 1);不参与抽取的池子可以都不写 */
  weight?: number
  /** 这一周期给环境加的临时词条 */
  mods?: Mods
  /** 其它随条目走的数(本作是"渡劫难度倍率"这类) */
  attrs?: Record<string, number>
}

export interface CycleContext {
  /** 当前该用哪个池(本作按界域;别的游戏可能是赛季 / 等级段) */
  pool: string
  /** 同一个池子里也要能区分不同用途的盐(本作按界域给不同盐) */
  salt?: number
}

export interface CycleConfig {
  /** 一个周期多长(秒);本作是"一个游戏日" 86400 */
  periodSec: number
  /** 池子表:池名 → 候选 */
  pools: Record<string, readonly CycleEntry[]>
  /**
   * 自己定抽取规则(**可选**):给了它就完全接管 —— 库只提供"周期序号 → 种子 → 池子"。
   * 不配则按权重抽(`weight`,默认 1)。
   */
  pick?: (entries: readonly CycleEntry[], rng: Rng) => CycleEntry | undefined
  /**
   * 自己定"周期序号 → 种子"(**可选**)。给它是为了**兼容既有口径**:
   * 已经上线的作品换到这一层时,同一个周期必须还是同一个结果(否则玩家会看到"今天的天时变了")。
   * 不配则用内置的 32 位混合(相邻周期看起来无关)。
   */
  seedOf?: (index: number, ctx: CycleContext) => number
}

export interface ScheduledCycle {
  /** 周期序号(从 0 开始) */
  index: number
  entry: CycleEntry | undefined
  /** 这个周期开始于游戏内第几秒 */
  startSec: number
}

export function createCycleSystem(config: CycleConfig) {
  const period = Math.max(1, config.periodSec)

  /** 周期序号:游戏内秒 → 第几天(第几个周期) */
  const indexAt = (elapsedSec: number): number => Math.floor(Math.max(0, elapsedSec) / period)

  /** 距离下一个周期还有多久 */
  const remainingSec = (elapsedSec: number): number => {
    const elapsed = Math.max(0, elapsedSec)
    return period - (elapsed % period)
  }

  /**
   * 周期序号 + 池 + 盐 → 种子。
   *
   * 用 32 位混合而不是简单相加:相邻序号(第 7 天与第 8 天)必须给出**看起来无关**的结果,
   * 否则玩家会看出"天时在按顺序轮"。
   */
  const seedAt = (index: number, ctx: CycleContext): number => {
    if (config.seedOf) return config.seedOf(index, ctx) >>> 0
    const salt = ctx.salt ?? 0
    let h = (index * 0x9e3779b1) ^ ((salt || 0) * 0x85ebca6b)
    for (let i = 0; i < ctx.pool.length; i += 1) h = (h ^ ctx.pool.charCodeAt(i)) * 0x01000193
    return (h >>> 0) || 1
  }

  const entriesOf = (pool: string): readonly CycleEntry[] => config.pools[pool] ?? []

  /** 某一周期的条目:确定性 —— 只由序号与池决定,不消耗调用方的随机源 */
  const entryAt = (index: number, ctx: CycleContext): CycleEntry | undefined => {
    const entries = entriesOf(ctx.pool)
    if (entries.length === 0) return undefined
    if (entries.length === 1) return entries[0]
    const rng = createRng(seedAt(index, ctx))
    if (config.pick) return config.pick(entries, rng)
    return rng.weighted(entries, e => e.weight ?? 1)
  }

  /** 当前周期是什么 */
  const at = (elapsedSec: number, ctx: CycleContext): ScheduledCycle => {
    const index = indexAt(elapsedSec)
    return { index, entry: entryAt(index, ctx), startSec: index * period }
  }

  /** 接下来几周期分别是什么(界面预告用) */
  const schedule = (elapsedSec: number, count: number, ctx: CycleContext): ScheduledCycle[] => {
    const start = indexAt(elapsedSec)
    const out: ScheduledCycle[] = []
    for (let i = 0; i < Math.max(0, Math.floor(count)); i += 1) {
      const index = start + i
      out.push({ index, entry: entryAt(index, ctx), startSec: index * period })
    }
    return out
  }

  /** 当前周期的临时词条(没有就给空对象) */
  const modsAt = (elapsedSec: number, ctx: CycleContext): Mods => at(elapsedSec, ctx).entry?.mods ?? {}

  return { periodSec: period, indexAt, remainingSec, seedAt, entryAt, at, schedule, modsAt }
}

export type CycleSystem = ReturnType<typeof createCycleSystem>
