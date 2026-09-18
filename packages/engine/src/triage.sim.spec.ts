/* eslint-disable no-console */
/**
 * 消融实验 —— 自动清理的规则顺序到底值几件。
 *
 * `triage.spec.ts` 钉的是语义(第一条表态的说了算、豁免不算候选、读数与裁决同源);
 * 这一份量的是**事故规模**:同一份内容、同三条规则,只把顺序换一换,会多扔或少扔几件;
 * 以及那条"看起来装了、其实一辈子轮不到"的规则该怎么被发现。
 *
 * 三条量出来的结论:
 *   ① **顺序不是风格,是政策**:三条规则全排列跑一遍,同一批货"留 6 件"到"留 13 件"都有,
 *      有 **7 件看顺序吃饭**(它们同时被两条规则覆盖:例如"低于 4 阶一律回收"与"三品以上当藏"
 *      同时命中一件 3 阶三品 —— 谁排在前面谁定生死);
 *   ② **"这条规则没出手"要分成两种,而且分得开**:把每条规则接走几件数一遍,就能看出是
 *      被前一条**全覆盖**(挪个位置它立刻接走 7 件),还是**阈值写超了内容的值域**
 *      (这批货成色最高 4 品,规则却写 `quality >= 5`,永远不可能命中);
 *   ③ **出手次数分布 = 谁在真的干活**:23 件候选里,判掉的两条规则接走 18 件,
 *      两条"保护性"规则一共只保下 5 件 —— 内容作者以为的主要保护,往往只是边角。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { TriageRule } from './triage.js'
import { createTriage } from './triage.js'

interface Piece {
  uid: string
  /** 阶级(1~10) */
  tier: number
  /** 成色(0~4) */
  quality: number
  /** 含流派核心词条 */
  core: boolean
  /** 上锁(不参与自动裁决) */
  locked: boolean
}

/** 一批"仓库里躺着的"东西:24 件,属性由固定种子铺出来(用例每次跑的都是同一批) */
const BATCH: Piece[] = (() => {
  const rng = createRng('仓库-1')
  return Array.from({ length: 24 }, (_, i) => ({
    uid: `p${i}`,
    tier: rng.int(1, 10),
    quality: rng.int(0, 4),
    core: rng.chance(0.25),
    locked: rng.chance(0.15)
  }))
})()

const FALLBACK = { keep: false, reason: '与道无缘' }

type Rule = TriageRule<Piece>

const RULE_FLOOR: Rule = {
  id: 'floor',
  label: '低于 4 阶一律回收',
  decide: p => (p.tier < 4 ? { keep: false, reason: '低于 4 阶' } : undefined)
}
const RULE_QUALITY: Rule = {
  id: 'qualityLine',
  label: '三品以上当藏',
  decide: p => (p.quality >= 3 ? { keep: true, reason: '三品以上' } : undefined)
}
const RULE_CORE: Rule = {
  id: 'coreAffix',
  label: '含核心词条',
  decide: p => (p.core ? { keep: true, reason: '含核心词条' } : undefined)
}

const chain = (rules: readonly Rule[]) => createTriage<Piece>({ rules, skip: p => p.locked, fallback: FALLBACK })

/** 一条链在一批内容上的裁决:件 → 留还是扔 */
function verdicts(rules: readonly Rule[], items: readonly Piece[] = BATCH): Map<string, boolean> {
  const t = chain(rules)
  return new Map(items.map(item => [item.uid, t.decide(item).keep]))
}

/**
 * 每条**规则**各接走几件(`skip` / `fallback` 也各算一行)。
 *
 * 为什么不用 `impact().byReason`:那份读数只统计"判掉"的件 —— 而"一条负责留下的规则
 * 从没出手"同样值得点名,只看 byReason 是看不见的。
 */
function ruleStats(rules: readonly Rule[], items: readonly Piece[] = BATCH): Map<string, number> {
  const out = new Map<string, number>()
  for (const { verdict } of chain(rules).partition(items).verdicts) {
    out.set(verdict.rule, (out.get(verdict.rule) ?? 0) + 1)
  }
  return out
}

const fmtStats = (stats: Map<string, number>): string =>
  [...stats.entries()].map(([rule, count]) => `${rule}×${count}`).join('、')

/** 全排列(三条规则只有 6 种,直接枚举) */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(rest => [item, ...rest])
  )
}

describe('消融实验 —— 清理规则顺序换了会怎样', () => {
  it('全排列跑一遍:有多少件会因顺序而翻面', () => {
    const orders = permutations([RULE_FLOOR, RULE_QUALITY, RULE_CORE])
    const baseline = verdicts(orders[0]!)
    console.log('  顺序 → 留下 / 扔掉(共 24 件,其中上锁豁免的不参与)')
    let maxFlips = 0
    const flippedOnce = new Set<string>()
    for (const order of orders) {
      const current = verdicts(order)
      const flipped = [...current].filter(([uid, keep]) => baseline.get(uid) !== keep)
      for (const [uid] of flipped) flippedOnce.add(uid)
      maxFlips = Math.max(maxFlips, flipped.length)
      console.log(`  ${order.map(r => r.id).join(' → ').padEnd(32, ' ')} 留 ${countKeep(current)} / 扔 ${24 - countKeep(current)}` + (flipped.length ? ` · 与基线不同 ${flipped.length} 件(${flipped.map(([uid]) => uid).join('、')})` : ''))
    }
    console.log(`  把 6 种顺序合起来看:一共有 ${flippedOnce.size} 件"看顺序吃饭"`)

    // ① 顺序真的会翻面 —— 不是"理论上有风险",而是这批内容里就有
    expect(flippedOnce.size).toBeGreaterThan(0)
    expect(maxFlips).toBeGreaterThan(0)
    // ② 翻面的件必然"同时被两条规则覆盖" —— 用内容自己验一遍
    for (const uid of flippedOnce) {
      const item = BATCH.find(p => p.uid === uid)!
      const covered = [RULE_FLOOR, RULE_QUALITY, RULE_CORE].filter(r => r.decide(item) !== undefined)
      expect(covered.length).toBeGreaterThanOrEqual(2)
    }
    // 防空转:豁免(上锁)的件在任何顺序下都不参与,不可能是翻面件
    for (const uid of flippedOnce) {
      expect(BATCH.find(p => p.uid === uid)!.locked).toBe(false)
    }
  })

  it('死规则是看得出来的:谁一次都没出手,数一遍就知道', () => {
    const base = ruleStats([RULE_FLOOR, RULE_QUALITY, RULE_CORE])
    console.log(`  三条规则的出手次数:${fmtStats(base)}`)

    /** 这条"影子规则"永远轮不到:前面那条已经把所有 tier < 4 都表态了 */
    const SHADOW: Rule = {
      id: 'shadowFloor',
      label: '低于 4 阶的良品也回收',
      decide: p => (p.tier < 4 && p.quality >= 2 ? { keep: false, reason: '低阶良品也不值钱' } : undefined)
    }
    const withShadow = chain([RULE_FLOOR, SHADOW, RULE_QUALITY, RULE_CORE])
    const impact = withShadow.impact(BATCH)
    console.log(
      `  四条链的读数:留 ${impact.keep} / 扔 ${impact.junk} · ${impact.byReason.map(r => `${r.reason}×${r.count}`).join('、')}` +
        `(按规则算:${fmtStats(ruleStats([RULE_FLOOR, SHADOW, RULE_QUALITY, RULE_CORE]))})`
    )

    // 影子规则一次也没出现 = 它是死规则(被前一条全覆盖)
    expect(ruleStats([RULE_FLOOR, SHADOW, RULE_QUALITY, RULE_CORE]).get('shadowFloor') ?? 0).toBe(0)
    // 把它挪到"阶级线"之前,它立刻活过来 —— 证明"死"是位置造成的,不是内容造成的
    const reorderedStats = ruleStats([SHADOW, RULE_FLOOR, RULE_QUALITY, RULE_CORE])
    const shadowHits = reorderedStats.get('shadowFloor') ?? 0
    console.log(`  把它挪到最前:它接走了 ${shadowHits} 件`)
    expect(shadowHits).toBeGreaterThan(0)
    // 而"阶级线"接走的件数相应少掉同样多 —— 规则之间是零和的,不是叠加的
    expect(reorderedStats.get('floor')).toBe((base.get('floor') ?? 0) - shadowHits)
    // 留住的那几件一件没变(影子规则与阶级线都是"判掉",换的是谁记这一笔)
    expect(reorderedStats.get('skip')).toBe(base.get('skip'))
    expect(reorderedStats.get('fallback')).toBe(base.get('fallback'))
  })

  it('另一种"没出手":阈值写超了内容的值域', () => {
    const stats = ruleStats([RULE_FLOOR, RULE_QUALITY, RULE_CORE])
    const candidates = stats.get('floor')! + stats.get('qualityLine')! + stats.get('coreAffix')! + stats.get('fallback')!
    const saved = stats.get('qualityLine')! + stats.get('coreAffix')!
    console.log(
      `  谁在真的干活:${fmtStats(stats)} —— 候选 ${candidates} 件里,"判掉"的占了 ${stats.get('floor')! + stats.get('fallback')!} 件,` +
        `两条保护性规则一共只保下 ${saved} 件`
    )
    // ① 不是"三条规则平分天下":实际是判掉的那两条在决定绝大多数件
    expect(stats.get('floor')! + stats.get('fallback')!).toBeGreaterThan(candidates / 2)
    expect(saved).toBeGreaterThan(0) // 对照:保护性规则也真在干活

    /** 成色最高到 4 品,阈值却写 5 —— 这条规则永远不可能出手 */
    const TOO_HIGH: Rule = {
      id: 'legendary',
      label: '传世当藏',
      decide: p => (p.quality >= 5 ? { keep: true, reason: '传世' } : undefined)
    }
    const withTooHigh = ruleStats([RULE_FLOOR, TOO_HIGH, RULE_QUALITY, RULE_CORE])
    console.log(`  阈值写到 5 品(内容最高 ${Math.max(...BATCH.map(p => p.quality))} 品):这条规则出手 ${withTooHigh.get('legendary') ?? 0} 次`)
    expect(withTooHigh.get('legendary') ?? 0).toBe(0)
    expect(Math.max(...BATCH.map(p => p.quality))).toBeLessThan(5) // 内容本身就说得出"它不可能命中"

    // 防空转:阈值收回到内容的值域之内,同一条规则立刻出手
    const reachable: Rule = { ...TOO_HIGH, decide: p => (p.quality >= 4 ? { keep: true, reason: '传世' } : undefined) }
    expect(ruleStats([RULE_FLOOR, reachable, RULE_QUALITY, RULE_CORE]).get('legendary')!).toBeGreaterThan(0)
  })

  it('同一批内容,阈值一改件数就跟着改(读数不是摆设)', () => {
    const strict = chain([
      { id: 'floor', label: '低于 6 阶一律回收', decide: p => (p.tier < 6 ? { keep: false, reason: '低于 6 阶' } : undefined) },
      RULE_QUALITY,
      RULE_CORE
    ])
    const loose = chain([RULE_FLOOR, RULE_QUALITY, RULE_CORE])
    const strictImpact = strict.impact(BATCH)
    const looseImpact = loose.impact(BATCH)
    console.log(`  放宽线(4 阶):留 ${looseImpact.keep} / 扔 ${looseImpact.junk} —— 收紧线(6 阶):留 ${strictImpact.keep} / 扔 ${strictImpact.junk}`)
    expect(strictImpact.junk).toBeGreaterThan(looseImpact.junk)
    // 防空转:两条链的规则条数相同(差别只在阈值,不是少了一条规则)
    expect(strict.rules.length).toBe(loose.rules.length)
  })
})

function countKeep(verdict: Map<string, boolean>): number {
  return [...verdict.values()].filter(Boolean).length
}
