/**
 * 内容牌堆 —— 「按场所标签与等级区间筛出这一池,再按权重抽一张」。
 *
 * 任何有随机内容池的游戏都要回答同一组问题:
 *   这张牌**该不该现在出现**?(等级区间:灵蚁巢只写到筑基,凡俗集市只写到金丹)
 *   它在**这个场所**说得通吗?(标签:山里的事不该发生在海底)
 *   它是不是**只能碰一次**?(once:一次性的遭遇,见过就不再来)
 *   同池之中谁更常见?(权重;并允许按情境给某些牌加权 —— 如"同源更容易撞见")
 *
 * 这里把四件事分开:区间、标签、一次性、权重。
 * 分开写不是为了好看 —— 合在一起时,「这张牌为什么没出现」就没人答得上来;
 * 而这类问题恰恰是内容运营最常问的。
 */
import type { Rng } from './rng.js'

/** 等级带:两端都可省,含端点 */
export interface LevelBand {
  min?: number
  max?: number
}

/** 一张牌需要提供的信息(其余字段由使用方自己保留) */
export interface DeckEntry extends LevelBand {
  id: string
  /** 场所标签;与情境标签**相交**即算切题(空标签表示不限场所) */
  tags?: readonly string[]
  /** 抽取权重;≤0 视为不参与 */
  weight: number
  /** 一次性:见过就不再出现 */
  once?: boolean
}

export interface DeckContext {
  /** 当前等级(用于区间判定) */
  level: number
  /** 当前场所的标签 */
  tags: readonly string[]
  /** 已经见过的一次性牌 id(没有一次性机制时可省) */
  seen?: readonly string[]
}

/** 等级是否落在带内(两端可省;含端点) */
export function inBand(value: number, band: LevelBand): boolean {
  if (band.min !== undefined && value < band.min) return false
  if (band.max !== undefined && value > band.max) return false
  return true
}

/** 这张牌此刻能不能进池(区间 + 场所标签 + 一次性) */
export function entryAllowed(entry: DeckEntry, ctx: DeckContext): boolean {
  if (!inBand(ctx.level, entry)) return false
  if (entry.tags !== undefined && entry.tags.length > 0 && !entry.tags.some(t => ctx.tags.includes(t))) return false
  if (entry.once === true && ctx.seen !== undefined && ctx.seen.includes(entry.id)) return false
  return true
}

/** 筛出这一池 —— 保持传入顺序(判据要能直接问"池子里有谁") */
export function deckPool<T extends DeckEntry>(entries: readonly T[], ctx: DeckContext): T[] {
  return entries.filter(entry => entryAllowed(entry, ctx))
}

export interface DrawOptions<T extends DeckEntry = DeckEntry> {
  /**
   * 情境加权:返回该牌的权重**倍数**(默认 1)。
   *
   * 用途是"倾向而非门槛" —— 例如同源更容易撞见、雨天的水边事件更多。
   * 返回 0 表示这张牌这次不参与;但要"完全不该出现",请用 tags/区间表达:
   * 那两样回答的是"该不该有",倍数只回答"多不多"。
   */
  weightMultiplier?: (entry: T) => number
}

/**
 * 从池里抽一张 —— 池空返回 null。
 *
 * 权重按 `weight × weightMultiplier` 计;全为 0 时退回**均匀抽取**
 * (而不是抛错或永远返回空:内容运营把权重全调成 0 的那天,玩家不该什么都遇不到)。
 */
export function drawFrom<T extends DeckEntry>(entries: readonly T[], ctx: DeckContext, rng: Rng, opts: DrawOptions<T> = {}): T | null {
  const pool = deckPool(entries, ctx)
  if (pool.length === 0) return null
  return pickOne(pool, rng, opts.weightMultiplier)
}

/** 权重与"全 0 退回均匀"的口径只此一处 —— 单抽与多抽共用 */
function pickOne<T extends DeckEntry>(pool: readonly T[], rng: Rng, weightMultiplier?: (entry: T) => number): T {
  const weightOf = (entry: T): number => Math.max(0, entry.weight * (weightMultiplier?.(entry) ?? 1))
  const total = pool.reduce((acc, entry) => acc + weightOf(entry), 0)
  return total <= 0 ? rng.pick(pool) : rng.weighted(pool, weightOf)
}

export interface DrawManyOptions<T extends DeckEntry = DeckEntry> extends DrawOptions<T> {
  /** 一轮之内不重复(默认 true);关掉它等于独立抽 N 次,可能抽到同一张 */
  distinct?: boolean
}

/**
 * 抽 N 张(默认不重复)—— 开局天赋、掉落组合、一次性奖励这类"一次给几样"的场景。
 *
 * 与单抽共用同一套筛选与权重口径,故"池子空了就早停"(而不是补齐到 N),
 * 也不会出现"单抽与多抽的权重算法不一样"这种最难查的分叉。
 */
export function drawMany<T extends DeckEntry>(
  entries: readonly T[],
  ctx: DeckContext,
  rng: Rng,
  count: number,
  opts: DrawManyOptions<T> = {}
): T[] {
  const distinct = opts.distinct ?? true
  const out: T[] = []
  const taken = new Set<string>()
  for (let i = 0; i < Math.max(0, Math.floor(count)); i += 1) {
    const pool = deckPool(entries, ctx).filter(entry => !distinct || !taken.has(entry.id))
    if (pool.length === 0) break
    const picked = pickOne(pool, rng, opts.weightMultiplier)
    out.push(picked)
    taken.add(picked.id)
  }
  return out
}
