/* eslint-disable no-console */
/**
 * 消融实验 —— 掉率、保底、份数:三种常见改法各自把"一场掉落"改成了什么样。
 *
 * `drops.spec.ts` 钉的是语义(归一、封顶、保底照样掷骰、顺序即声明顺序);这一份量的是**手感**:
 * 同一份内容下,"概率翻倍""加保底""份数翻倍""多抽一次"这四种改法,期望、两端与波动各差多少。
 * 这些数字是内容作者拿来定 `chance` / `chanceCap` / `count` / `attempts` 的依据。
 *
 * 四条被量出来的结论(**与"想当然"不同的地方正好是这份实验的价值**):
 *   ① **概率翻倍只在没撞上限时才是产出翻倍** —— 一旦某条撞到 100% 或 `chanceCap`,倍率就在那一条上失效:
 *      本表 ×2 时恰好两倍,×4 时只有约 2.45 倍,多出来的倍率被封顶吃掉了;
 *   ② **保底买的是下限,不是上限,而且不便宜** —— 挂了 `guaranteed` 的条目开了开关就"必出一份":
 *      最差那一档从 0 抬到 1,代价是期望被抬到 1(5% 的稀有物就是 20 倍期望);没挂 `guaranteed`
 *      的条目开不开开关**一位数字都不变**;
 *   ③ **份数倍率只动份数,一颗骰子都不多掷**(所以"战利品翻倍"不该改成多抽一次);
 *   ④ **同样叫翻倍,两条路的手感不同** —— "份数 ×2"与"多抽一次"期望相同,但多抽一次是两次独立判定,
 *      波动**更低**(更稳);份数 ×2 是把一次结果整体放大,拿不到"刚好一件"这一档
 *      (装备那条只有 0 或 2,而多抽一次能落在 0 / 1 / 2)。
 */
import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import type { DropEntry, DropOptions } from './drops.js'
import { createDropTable } from './drops.js'

const RUNS = 20_000
/** 一份典型内容:残页 12%、材料 50% 出 1～3 份、装备 30%(上限 90%) */
const ENTRIES: DropEntry[] = [
  { key: 'page', chance: 0.12, count: [1, 2] as const },
  { key: 'mat', chance: 0.5, count: [1, 3] as const },
  { key: 'gear', chance: 0.3, chanceCap: 0.9, count: 1 }
]

interface Stats {
  mean: number
  median: number
  worst: number
  best: number
  sd: number
}

/** 跑 N 场:每场记一次"这一场总共掉了多少件" */
function run(seedFrom: number, entries: DropEntry[], opts: DropOptions = {}): Stats {
  const table = createDropTable(entries)
  const counts: number[] = []
  for (let i = 0; i < RUNS; i += 1) {
    const hits = table.roll(createRng(seedFrom + i), opts)
    counts.push(hits.reduce((sum, hit) => sum + hit.count, 0))
  }
  const sorted = [...counts].sort((a, b) => a - b)
  const mean = counts.reduce((a, b) => a + b, 0) / RUNS
  const sd = Math.sqrt(counts.reduce((acc, n) => acc + (n - mean) ** 2, 0) / RUNS)
  return { mean, median: sorted[Math.floor(RUNS / 2)]!, worst: sorted[0]!, best: sorted.at(-1)!, sd }
}

const row = (label: string, s: Stats): string =>
  `  ${label.padEnd(22, ' ')} 平均 ${s.mean.toFixed(2)} · 中位 ${s.median} · 最差 ${s.worst} · 最好 ${s.best} · 波动 ${s.sd.toFixed(2)}`

/** 这场掉落**实际出现过**的档位(去重、升序)—— 用来看"拿得到哪几档",而不只是两端 */
function outcomes(seedFrom: number, entries: DropEntry[], opts: DropOptions = {}): number[] {
  const table = createDropTable(entries)
  const seen = new Set<number>()
  for (let i = 0; i < RUNS; i += 1) {
    const hits = table.roll(createRng(seedFrom + i), opts)
    seen.add(hits.reduce((sum, hit) => sum + hit.count, 0))
  }
  return [...seen].sort((a, b) => a - b)
}

/**
 * 一份"典型内容"在给定倍率下的**理论期望** —— 与实现无关地算一遍,
 * 再拿去和模拟读数比:这样这份实验同时也是一道判据(读数错 = 口径变了)。
 */
function expectedOf(entries: DropEntry[], opts: DropOptions = {}): number {
  const meanCount = (c: DropEntry['count']): number =>
    c === undefined ? 1 : typeof c === 'number' ? c : (c[0] + c[1]) / 2
  return entries.reduce((sum, e) => {
    const chanceMult = (e.scalesWithChance ?? true) ? (opts.chanceMult ?? 1) : 1
    const raw = e.chance * chanceMult
    const capped = e.chanceCap === undefined ? raw : Math.min(e.chanceCap, raw)
    const chance = Math.min(1, Math.max(0, capped))
    const attemptsBase = Math.max(0, Math.floor(e.attempts ?? 1))
    const attempts = attemptsBase * ((e.scalesWithAttempts ?? false) ? (opts.countMult ?? 1) : 1)
    const countMult = (e.scalesWithCount ?? true) ? (opts.countMult ?? 1) : 1
    /** 保底:第一条的第一次尝试必中 */
    const forced = e.guaranteed === true && (opts.guarantee ?? false) ? 1 : 0
    const perHit = meanCount(e.count) * countMult
    return sum + (attempts - forced) * chance * perHit + forced * perHit
  }, 0)
}

/** 数骰子的随机源:用来把"掷了几次"变成确定性判据 */
function countingRng(seed: number): { rng: Rng; draws: () => number } {
  const inner = createRng(seed)
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

describe('消融实验 —— 掉率 / 保底 / 份数各自改了哪一段', () => {
  it('概率倍率:没撞上限时正好翻倍,一旦撞上就被封顶吃掉', () => {
    const base = run(1, ENTRIES)
    const x2 = run(1, ENTRIES, { chanceMult: 2 })
    const x4 = run(1, ENTRIES, { chanceMult: 4 })
    for (const [label, s] of [
      ['基线', base],
      ['概率 ×2', x2],
      ['概率 ×4', x4]
    ] as const) {
      console.log(row(label, s))
    }

    // 模拟读数与"按口径算一遍"的理论值对上(读数错 = 口径变了)
    for (const [s, opts] of [
      [base, {}],
      [x2, { chanceMult: 2 }],
      [x4, { chanceMult: 4 }]
    ] as const) {
      expect(s.mean).toBeCloseTo(expectedOf(ENTRIES, opts), 1)
    }

    // ① ×2 时恰好两倍:三条都没撞上限(材料刚好处在 100% 的边界上)
    expect(x2.mean / base.mean).toBeCloseTo(2, 1)
    // ② ×4 时只有约 2.45 倍:材料被夹到 100%、装备被 chanceCap 封在 90%
    console.log(
      `  ×4 是 ×2 的 ${(x4.mean / x2.mean).toFixed(3)} 倍 —— 多出来的倍率全被"夹到 1 / 封顶"吃掉`
    )
    expect(x4.mean / x2.mean).toBeGreaterThan(1.2)
    expect(x4.mean / x2.mean).toBeLessThan(1.25)

    // 逐条看"被吃掉多少":这是内容作者该看的那张账
    for (const e of ENTRIES) {
      const want = e.chance * 4
      const capped = e.chanceCap === undefined ? want : Math.min(e.chanceCap, want)
      const got = Math.min(1, capped)
      console.log(
        `  ${e.key.padEnd(5, ' ')} 想涨到 ${(want * 100).toFixed(0)}% → 实际 ${(got * 100).toFixed(0)}%`
      )
      expect(got).toBeLessThanOrEqual(1)
      expect(got).toBeGreaterThanOrEqual(e.chance)
    }
    // 装备那条想涨到 120%,实际封在 90%
    expect(Math.min(ENTRIES[2]!.chanceCap!, ENTRIES[2]!.chance * 4)).toBe(0.9)
    // 防空转:三条封顶之后的数确实各不相同(否则上面那张账是三个一样的数)
    const caps = ENTRIES.map(e => Math.min(1, e.chanceCap ?? Infinity, e.chance * 4))
    expect(caps).toEqual([0.48, 1, 0.9])
    expect(new Set(caps).size).toBe(3)
  })

  it('保底买的是下限:最差从 0 抬到 1,代价是期望一并被抬上去', () => {
    /** 一件 5% 的稀有物 —— 真实作品里最常挂 `guaranteed` 的就是这种 */
    const rare: DropEntry[] = [
      { key: 'relic', chance: 0.05, count: 1, guaranteed: true },
      { key: 'mat', chance: 0.5, count: [1, 3] as const }
    ]
    const plain = run(7, rare)
    const withGuarantee = run(7, rare, { guarantee: true })
    console.log(row('无保底', plain))
    console.log(row('保底(首抽必出)', withGuarantee))
    expect(plain.worst).toBe(0) // 无保底时"一件不出"是常态
    expect(withGuarantee.worst).toBeGreaterThanOrEqual(1) // 稀有物必出 1
    expect(withGuarantee.mean).toBeGreaterThan(plain.mean)
    expect(withGuarantee.sd).toBeLessThanOrEqual(plain.sd)

    // 保底不便宜:5% 的稀有物一保就是 20 倍期望(不是"期望略升")
    const rareOnly: DropEntry[] = [{ key: 'relic', chance: 0.05, count: 1, guaranteed: true }]
    expect(run(11, rareOnly).mean).toBeCloseTo(0.05, 2)
    expect(run(11, rareOnly, { guarantee: true }).mean).toBe(1)

    // 防空转:没人挂 `guaranteed` 时,开不开保底**一位数字都不变**
    expect(run(7, ENTRIES, { guarantee: true })).toEqual(run(7, ENTRIES))
  })

  it('保底改写结果,不跳过掷骰:开与不开消耗的随机数一模一样', () => {
    const entry: DropEntry = { key: 'relic', chance: 0.05, count: 1, guaranteed: true }
    const table = createDropTable([entry])
    const probe = (guarantee: boolean) => {
      const counted = countingRng(23)
      const hit = table.rollOne(entry, counted.rng, { guarantee })
      return { hit, draws: counted.draws() }
    }
    const off = probe(false)
    const on = probe(true)
    expect(on.draws).toBe(off.draws) // 掷骰次数一颗不差
    expect(off.hit.count).toBeLessThanOrEqual(1)
    expect(on.hit.count).toBe(1) // 必出一份
  })

  it('份数倍率只乘份数:概率判定次数一颗不差(随机流不被倍率改写)', () => {
    // 同一颗种子、同样的倍率:只改"份数是否吃倍率"这一条,掷骰次数完全相同
    const entries: DropEntry[] = [{ key: 'mat', chance: 0.5, count: [1, 3] as const }]
    const scaled = createDropTable(entries)
    const flat = createDropTable([{ ...entries[0]!, scalesWithCount: false }])
    const a = scaled.roll(createRng(9), { countMult: 2 })
    const b = flat.roll(createRng(9), { countMult: 2 })
    expect(a[0]!.hits).toBe(b[0]!.hits) // 命中次数相同
    expect(a[0]!.count).toBe(b[0]!.count * 2) // 份数恰好翻倍

    // 防空转:倍率真起了作用(否则上面两条是拿两个相同的东西在比)
    const one = flat.roll(createRng(9), {})
    expect(a[0]!.count).toBe(b[0]!.count * 2)
    expect(a[0]!.count).toBeGreaterThan(one[0]!.count)
  })

  it('同样叫翻倍,两条路的手感不同:期望相同,多抽一次更稳', () => {
    const page: DropEntry = { key: 'page', chance: 0.12, count: [1, 2] as const }
    const mat: DropEntry = { key: 'mat', chance: 0.5, count: [1, 3] as const }
    const gear: DropEntry = { key: 'gear', chance: 0.3, chanceCap: 0.9, count: 1 }
    /** 路子甲:"战利品翻倍" = 每件份数 ×2(装备也从 1 变成 2) */
    const countDoubled = run(3, [page, mat, gear], { countMult: 2 })
    /** 路子乙:"多抽一次" = 装备那条 attempts 吃倍率、份数不吃(仍只掉 1 件) */
    const attemptDoubled = run(
      3,
      [page, mat, { ...gear, scalesWithAttempts: true, scalesWithCount: false }],
      { countMult: 2 }
    )
    console.log(row('份数 ×2', countDoubled))
    console.log(row('装备多抽一次', attemptDoubled))

    // 期望相同(都是"装备那份产出翻倍":0.3 → 0.6)
    expect(attemptDoubled.mean).toBeCloseTo(countDoubled.mean, 1)
    // 但抽两次是两次独立判定:波动更低、更稳
    expect(attemptDoubled.sd).toBeLessThan(countDoubled.sd)
    // 防空转:两条路子都与基线不同(否则是在比两个都等于基线的东西)
    const base = run(3, [page, mat, gear])
    expect(countDoubled.mean).toBeGreaterThan(base.mean)
    expect(attemptDoubled.mean).toBeGreaterThan(base.mean)

    // 只看装备那一条:期望都是 0.6,但拿得到的档位不同 —— "份数 ×2"永远给不到 1 件
    const doubled = run(3, [{ ...gear, chanceCap: undefined }], { countMult: 2 })
    const twice = run(3, [{ ...gear, chanceCap: undefined, scalesWithAttempts: true, scalesWithCount: false }], {
      countMult: 2
    })
    console.log(row('装备份数 ×2', doubled))
    console.log(row('装备多抽一次', twice))
    expect(doubled.mean).toBeCloseTo(0.6, 1)
    expect(twice.mean).toBeCloseTo(0.6, 1)
    expect(twice.mean).toBeCloseTo(doubled.mean, 2)
    // 档位(这一场到底掉了几个):份数 ×2 只有 {0, 2},多抽一次能落在 {0, 1, 2}
    expect(outcomes(3, [{ ...gear, chanceCap: undefined }], { countMult: 2 })).toEqual([0, 2])
    expect(
      outcomes(3, [{ ...gear, chanceCap: undefined, scalesWithAttempts: true, scalesWithCount: false }], {
        countMult: 2
      })
    ).toEqual([0, 1, 2])

    /**
     * 还有一条**契约级**差别:份数翻倍一颗骰子都不多掷,多抽一次是真多掷 ——
     * 所以后者会改掉后面的随机流。同样翻倍,选哪条路得先想清楚这件事。
     */
    const drawsOf = (entry: DropEntry, opts: DropOptions): number => {
      const counted = countingRng(5)
      createDropTable([entry]).roll(counted.rng, opts)
      return counted.draws()
    }
    const fixed: DropEntry = { key: 'gear', chance: 0.9, count: 1 }
    const byCount = drawsOf(fixed, { countMult: 2 })
    const byAttempt = drawsOf({ ...fixed, scalesWithAttempts: true, scalesWithCount: false }, { countMult: 2 })
    console.log(`  份数 ×2 掷了 ${byCount} 次骰,多抽一次掷了 ${byAttempt} 次骰(同一份内容)`)
    expect(byCount).toBe(1)
    expect(byAttempt).toBe(2)
    // 期望仍然相同:0.9 概率 × 2 份 = 掷两次各 1 份
    expect(run(3, [fixed], { countMult: 2 }).mean).toBeCloseTo(
      run(3, [{ ...fixed, scalesWithAttempts: true, scalesWithCount: false }], { countMult: 2 }).mean,
      1
    )
  })
})
