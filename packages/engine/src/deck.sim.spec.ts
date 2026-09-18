/* eslint-disable no-console */
/**
 * 消融实验 —— 把一张内容池"抽干"要多少抽。
 *
 * `deck.spec.ts` 钉的是语义(区间/标签/一次性/权重各自管什么、权重全 0 退回均匀);
 * 这一份量的是**收集成本**:内容作者写下"24 张牌、三档权重"时,玩家到底要抽多久才见完,
 * 以及"抽干之后会发生什么"。
 *
 * 四条量出来的结论(**第一条与"想当然"正好相反**):
 *   ① **清空抽数是确定的,权重改不了它**:24 张一次性牌,抽一张少一张,清空就是 24 抽 ——
 *      权重摆得再偏也一样(实测 200 颗种子,平均与最慢都是 24.0 抽);
 *   ② **权重真正改的是"先见谁"**:同一批内容,常见档第一次出现的中位抽号远小于罕见档 ——
 *      权重是把牌**排序**,不是决定能不能见到;
 *   ③ **一旦限定预算,排序就变成覆盖率**:只抽 10 抽(大多数游戏一天的量)时,权重偏斜会
 *      把"见到罕见牌"的概率压低一大截 —— 这才是权重的价格所在;
 *   ④ **抽干就是空**:池子全是一次性牌时,抽干之后每次抽都是 `null` —— 必须有底牌兜底,
 *      否则玩家会遇到"什么都没发生"(权重的第四档"退回均匀"也不改这一点,它只保证不抛错)。
 * 另附:`drawMany` 一轮不重复,与单抽共用同一套权重口径。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { DeckEntry } from './deck.js'
import { drawFrom, drawMany } from './deck.js'

interface Card extends DeckEntry {
  name: string
}

/** 三档权重,共 24 张,全部"只碰一次" —— 典型的一次性内容池 */
function buildPool(weightOf: (tier: '常见' | '少见' | '罕见') => number): Card[] {
  const plan: [tier: '常见' | '少见' | '罕见', count: number][] = [
    ['常见', 12],
    ['少见', 8],
    ['罕见', 4]
  ]
  const out: Card[] = []
  for (const [tier, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      out.push({ id: `${tier}-${i}`, name: `${tier} 第 ${i + 1} 张`, weight: weightOf(tier), once: true })
    }
  }
  return out
}

const WEIGHTED = buildPool(tier => (tier === '常见' ? 60 : tier === '少见' ? 20 : 4))
const FLAT = buildPool(() => 0)

/** 反复抽,直到池空(或到安全上限):返回用了几抽,以及每张牌第一次出现的抽号 */
function drain(seedFrom: number, pool: readonly Card[]): { pulls: number; firstSeen: Map<string, number> } {
  const rng = createRng(seedFrom)
  const seen: string[] = []
  const firstSeen = new Map<string, number>()
  let pulls = 0
  const LIMIT = 20_000
  while (pulls < LIMIT) {
    const card = drawFrom(pool, { level: 1, tags: [], seen }, rng)
    if (!card) break
    pulls += 1
    seen.push(card.id)
    if (!firstSeen.has(card.id)) firstSeen.set(card.id, pulls)
  }
  return { pulls, firstSeen }
}

const RUNS = 200

function statsOf(values: readonly number[]): { mean: number; median: number; worst: number } {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length / 2)]!,
    worst: sorted.at(-1)!
  }
}

const TIERS = ['常见', '少见', '罕见'] as const

/** 各档牌"第一次出现"的抽号(跨种子汇总) */
function firstSeenByTier(pool: readonly Card[]): Map<string, number[]> {
  const out = new Map<string, number[]>(TIERS.map(tier => [tier, []]))
  for (let run = 0; run < RUNS; run += 1) {
    const result = drain(run + 1, pool)
    for (const card of pool) out.get(card.id.split('-')[0]!)!.push(result.firstSeen.get(card.id)!)
  }
  return out
}

/** 只抽 budget 次(大多数游戏一天的量):返回这一轮抽到了哪些牌 */
function withinBudget(seedFrom: number, pool: readonly Card[], budget: number): string[] {
  const rng = createRng(seedFrom)
  const seen: string[] = []
  for (let i = 0; i < budget; i += 1) {
    const card = drawFrom(pool, { level: 1, tags: [], seen }, rng)
    if (!card) break
    seen.push(card.id)
  }
  return seen
}

describe('消融实验 —— 抽干一张内容池要多少抽', () => {
  it('清空抽数是确定的:权重改不了它,一抽一张,抽完为空', () => {
    const pulls = Array.from({ length: RUNS }, (_, i) => drain(i + 1, WEIGHTED).pulls)
    const all = statsOf(pulls)
    console.log(`  24 张一次性牌,三档权重(60 / 20 / 4):中位 ${all.median} 抽 · 平均 ${all.mean.toFixed(1)} · 最慢 ${all.worst}`)

    // ① "清空成本"与权重无关:抽到就排除,所以每次都有牌可抽,直到抽完
    expect(all.median).toBe(24)
    expect(all.worst).toBe(24)
    // 防空转:每颗种子都真的抽齐了 24 张(否则"24 抽"可能只是抽不动)
    const one = drain(1, WEIGHTED)
    expect(one.firstSeen.size).toBe(24)
    expect([...one.firstSeen.values()].every(n => n >= 1 && n <= 24)).toBe(true)
  })

  it('权重真正排序的是"先见谁":三档第一次出现的中位抽号依次推后', () => {
    const byTier = firstSeenByTier(WEIGHTED)
    const medians = TIERS.map(tier => ({ tier, median: statsOf(byTier.get(tier)!).median }))
    for (const row of medians) console.log(`  ${row.tier}档:第一次出现的中位抽号 ${row.median}`)

    // ② 权重越大越早遇见 —— 这是"权重"在一次性池里唯一能做的事
    expect(medians[0]!.median).toBeLessThan(medians[1]!.median)
    expect(medians[1]!.median).toBeLessThan(medians[2]!.median)
    // 而最慢的一档也很难"被排到最后" —— 排序是倾向,不是排定
    expect(medians[2]!.median).toBeLessThan(24)
  })

  it('一旦限定预算,排序就变成覆盖率:10 抽之内见到罕见牌的概率', () => {
    const BUDGET = 10
    const seenAny = (pool: readonly Card[]): number =>
      Array.from({ length: RUNS }, (_, i) => withinBudget(i + 1, pool, BUDGET)).filter(ids =>
        ids.some(id => id.startsWith('罕见'))
      ).length / RUNS
    const weighted = seenAny(WEIGHTED)
    const flat = seenAny(FLAT)
    console.log(`  只抽 ${BUDGET} 抽:权重偏斜时见到"罕见"的概率 ${(weighted * 100).toFixed(0)}% —— 权重全 0(退回均匀)时 ${(flat * 100).toFixed(0)}%`)

    // ③ 这才是权重的价格:同样的内容与预算,偏斜权重把"罕见"的曝光压下去
    expect(weighted).toBeLessThan(flat)
    // 防空转:两边都不是 0 / 也不是必然 —— 否则这个对比没有信息量
    expect(weighted).toBeGreaterThan(0)
    expect(flat).toBeLessThan(1)
    // 权重全 0 走均匀而不是"抽不到"(库的明确口径)
    expect(withinBudget(1, FLAT, BUDGET).length).toBe(BUDGET)
  })

  it('抽干就是空:全是一次性牌时,最后一抽之后每次都是 null', () => {
    const rng = createRng('抽干之后')
    const seen: string[] = []
    let card = drawFrom(WEIGHTED, { level: 1, tags: [], seen }, rng)
    while (card) {
      seen.push(card.id)
      card = drawFrom(WEIGHTED, { level: 1, tags: [], seen }, rng)
    }
    expect(seen.length).toBe(24)
    console.log(`  抽完 ${seen.length} 张之后连抽 5 次:${[1, 2, 3, 4, 5].map(() => String(drawFrom(WEIGHTED, { level: 1, tags: [], seen }, rng))).join('、')}`)

    // ③ 池空返回 null —— 内容必须自己安排"兜底牌"
    const withBackstop: Card[] = [...WEIGHTED, { id: 'backstop', name: '随便逛逛', weight: 1 }]
    const later = drawFrom(withBackstop, { level: 1, tags: [], seen }, rng)
    expect(later?.id).toBe('backstop') // 加了常驻底牌,就有事发生
    expect(drawFrom(WEIGHTED, { level: 1, tags: [], seen }, rng)).toBeNull()
  })

  it('一轮抽多张:不重复是真的,而且与单抽共用同一套权重', () => {
    const rng = createRng('开局天赋')
    const noRepeat = drawMany(WEIGHTED, { level: 1, tags: [] }, rng, 5)
    expect(new Set(noRepeat.map(c => c.id)).size).toBe(5) // 一轮里不会撞同一张
    const repeatable = drawMany(WEIGHTED, { level: 1, tags: [] }, rng, 5, { distinct: false })
    expect(repeatable.length).toBe(5)
    // 防空转:允许重复时,同一颗种子下"可能出现重复" —— 200 次里至少撞过一次
    let collisions = 0
    for (let run = 0; run < 200; run += 1) {
      const many = drawMany(WEIGHTED, { level: 1, tags: [] }, createRng(run + 1), 5, { distinct: false })
      if (new Set(many.map(c => c.id)).size < 5) collisions += 1
    }
    console.log(`  允许重复抽 5 张:200 轮里有 ${collisions} 轮撞到过重复`)
    expect(collisions).toBeGreaterThan(0)
  })
})
