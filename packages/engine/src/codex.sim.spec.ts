/* eslint-disable no-console */
/**
 * 消融实验 —— 图鉴的档位门槛要几次照面,三条升档路各是什么手感。
 *
 * `codex.spec.ts` 钉的是语义(三条升档路各自怎么走、只进不退、只记见过的最好一件);
 * 这一份量的是**门槛刻度**:内容作者定"照面几次算眼熟""败绩算几次""概率升档多久到位"时
 * 要看的数字。
 *
 * 三条量出来的结论:
 *   ① **门槛是"累计",不是"次数"**:档位表 `[0, 3, 8, 20]` 意味着第 3 / 8 / 20 次照面各进一层
 *      —— 而"败绩算三次"这种权重会把它整体提前(一次败绩就跨过第一档);
 *   ② **概率升档是"每掷中一次只推一层"**:每次 10%、照面 20 次,只有约三分之一(实测 33.5%,
 *      理论 32.3%)能推到顶档 —— 要推两层、三层就得掷中相应次数,成本是**乘起来**的;
 *   ③ **推进不可逆**:`advanceTo` 只增不减,"用过才算真懂"这条路由行为推开,不会因为卸载装备而掉档。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createCodex } from './codex.js'

/** 一册图鉴:眼熟 → 知其路数 → 洞悉(门槛 3 / 8 / 20 次照面) */
const STAGES = [
  { name: '初见', at: 0 },
  { name: '眼熟', at: 3 },
  { name: '知其路数', at: 8 },
  { name: '洞悉', at: 20 }
]

const codex = createCodex({ stages: STAGES })

/** 反复照面,记录每次之后停在哪一档 */
function walk(times: number, weight = 1): number[] {
  let state = codex.create()
  const stages: number[] = []
  for (let i = 0; i < times; i += 1) {
    const result = codex.observe(state, 'wolf', { weight })
    state = result.state
    stages.push(result.stage)
  }
  return stages
}

describe('消融实验 —— 图鉴的档位门槛与三条升档路', () => {
  it('门槛是累计:第 3 / 8 / 20 次照面各进一层', () => {
    const stages = walk(20)
    const entries = stages.flatMap((stage, index) => (index > 0 && stage > stages[index - 1]! ? [index + 1] : []))
    console.log(`  20 次照面停在:${stages.join(' ')}`)
    console.log(`  升档发生在第 ${entries.join('、')} 次照面(门槛 ${STAGES.map(s => s.at).join(' / ')})`)

    // ① 门槛即"第几次照面"(第一档恒为 0,所以是第 3 / 8 / 20 次)
    expect(entries).toEqual([3, 8, 20])
    expect(stages.at(-1)).toBe(3)
    // 防空转:三次升档确实各不相同(否则上面在拿同一条门槛比三次)
    expect(new Set(STAGES.map(s => s.at)).size).toBe(STAGES.length)
  })

  it('"败绩算三次"这类权重会把门槛整体提前', () => {
    const normal = walk(20, 1)
    const weighted = walk(7, 3)
    console.log(`  每次权重 1:第 3 / 8 / 20 次升档`)
    console.log(`  每次权重 3:${weighted.join(' ')} —— 第 1 次就出头档,第 3 次进第二档`)

    // ② 权重是累计量:一次"败绩"(权重 3)直接跨过第 3 次的门槛
    expect(weighted[0]).toBe(1)
    expect(weighted[2]).toBe(2)
    // 与权重 1 的同一位置对比
    expect(normal[0]).toBe(0)
    expect(normal[2]).toBe(1)
    // 防空转:权重 3 走 7 次 = 21 累计,足够推到顶档
    expect(weighted.at(-1)).toBe(3)
  })

  it('概率升档是长尾:每次 10% 时,20 次照面只有约三分之一推到顶', () => {
    const RUNS = 2000
    const chanceOf = (): number => 0.1
    const DRAWS = 20
    let maxed = 0
    const stageCounts = new Array(STAGES.length).fill(0) as number[]
    for (let run = 0; run < RUNS; run += 1) {
      const rng = createRng(`认出它-${run}`)
      let state = codex.create()
      for (let i = 0; i < DRAWS; i += 1) {
        state = codex.markSeen(state, 'wolf')
        state = codex.tryAdvance(state, 'wolf', rng, chanceOf).state
      }
      const stage = codex.view(state, 'wolf').stage
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
      if (stage === STAGES.length - 1) maxed += 1
    }
    console.log(
      `  每次 10% 的概率升档,20 次照面之后:${stageCounts.map((n, i) => `${STAGES[i]!.name} ${((n / RUNS) * 100).toFixed(1)}%`).join(' · ')}`
    )

    /**
     * 每次 10%、掷 20 次,每掷中一次只推一层,所以要"推到顶"必须掷中 3 次:
     * P(≥3) = 1 − P(0) − P(1) − P(2)(二项分布)。这条比"掷中一次就到位"低得多 ——
     * 这正是概率升档那条路的真实成本,也是这次量出来的重点。
     */
    const binomial = (k: number): number => {
      let c = 1
      for (let i = 1; i <= k; i += 1) c = (c * (DRAWS - i + 1)) / i
      return c * 0.1 ** k * 0.9 ** (DRAWS - k)
    }
    const theory = 1 - binomial(0) - binomial(1) - binomial(2)
    console.log(`  理论:20 次里掷中 3 次以上的概率 ${(theory * 100).toFixed(1)}%`)
    expect(maxed / RUNS).toBeCloseTo(theory, 1)
    // 长尾是真的:总有推不到顶的 —— 这正是它和"累计阈值"那条路的区别
    expect(maxed).toBeLessThan(RUNS)
    // 防空转:三档都有人停在上面(说明确实是一层一层推的)
    expect(stageCounts.filter(n => n > 0).length).toBeGreaterThan(1)
  })

  it('推进不可逆 + 只记见过的最好一件', () => {
    let state = codex.create()
    state = codex.observe(state, 'wolf').state
    state = codex.advanceTo(state, 'wolf').state // "亲手用过"这条路:直接推到顶
    const top = codex.view(state, 'wolf').stage
    const back = codex.advanceTo(state, 'wolf', 0).state // 想退回 0 档
    expect(codex.view(back, 'wolf').stage).toBe(top) // 只增不减
    // 防空转:确实到了顶(否则"退回无效"可能只是本来就在 0 档)
    expect(top).toBe(STAGES.length - 1)

    let best = codex.create()
    best = codex.rememberBest(best, 'wolf', { quality: 3, tier: 5 }).state
    best = codex.rememberBest(best, 'wolf', { quality: 1, tier: 9 }).state
    const improved = codex.rememberBest(best, 'wolf', { quality: 2, tier: 7 })
    best = improved.state
    console.log(`  三件里记下的最好一件:${JSON.stringify(best.best['wolf'] ?? {})}`)
    // 各维度各取其高:品质记住 3、层级记住 9(不是同一件)
    expect(best.best['wolf']).toEqual({ quality: 3, tier: 9 })
    // 第三件(品质 2 / 层级 7)两维都没超过记录 —— 不该被当成"进步"报出去
    expect(improved.improved).toBe(false)
    // 记的是"见过",所以与当前是否还持有无关 —— 再喂一件差的,读数不变
    const worse = codex.rememberBest(best, 'wolf', { quality: 0, tier: 1 }).state
    expect(worse.best['wolf']).toEqual({ quality: 3, tier: 9 })
  })
})
