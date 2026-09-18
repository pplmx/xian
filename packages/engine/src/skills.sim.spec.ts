/* eslint-disable no-console */
/**
 * 消融实验 —— 一部功法练到满级要多少料,满级再择的路值几级。
 *
 * `skills.spec.ts` 钉的是语义(等级曲线怎么算、消耗曲线怎么算、折扣只作用于可折项、分支前置);
 * 这一份量的是**内容作者的账**:从头练满一共花多少、折扣实际省几成、两条满级分支各相当于多练几级、
 * "入门就会的"与"练出来的"各占多少。
 *
 * 三条量出来的结论:
 *   ① **满级总账要按曲线累**,不是"单级 × 级数":`基数 × 倍率^等级` 是指数,前几级便宜、后几级贵
 *      —— 实测这套内容练满要 125 点悟道点,逐级是 12 → 16 → 22 → 31 → 44,最后一级吃掉三分之一;
 *   ② **折扣只省"可折项"**:七折打在悟道点上,但"残页不打折"这一项按原价收 ——
 *      所以总账省的**不到三成**(实测 26.4%),这正是"一刀切打折扣"会带来的静默平衡漂移;
 *   ③ **满级分支按"每级贡献"折算才看得出来贵贱**:+5% 攻击(每级 +2%)相当于 2.5 级,
 *      +3% 会心(每级 +0.5%)相当于 6 级 —— 同一个"满级再选一次"的位置,两条路差一倍多。
 */
import { describe, expect, it } from 'vitest'
import { createSkillSystem } from './skills.js'

/** 一部功法:六级满,入门给 4% 攻击,每级再给 2% 攻击与 0.5% 会心 */
const system = createSkillSystem({
  skills: [
    {
      id: 'tread',
      name: '踏雪',
      kind: '主修',
      maxLevel: 6,
      baseMods: { attackPct: 0.04 },
      perLevelMods: { attackPct: 0.02, critRate: 0.005 },
      costs: [
        { key: 'insight', base: 8, growth: 1.4 }, // 悟道点:随等级指数涨
        { key: 'page', levelStep: 1, discountable: false } // 残页:线性涨,不打折
      ],
      branches: [
        { id: 'advance', name: '猛进', mods: { attackPct: 0.05 }, desc: '把劲使在一处' },
        { id: 'sink', name: '沉潜', mods: { critRate: 0.03 }, desc: '看得更准' },
        { id: 'deeper', name: '观微', mods: { critDamage: 0.1 }, requires: ['sink'] }
      ]
    }
  ]
})

/** 从 1 级练到满级:返回每一级的消耗与总量 */
function climb(discount = 0): { steps: { level: number; costs: { key: string; amount: number }[] }[]; total: Record<string, number> } {
  const steps: { level: number; costs: { key: string; amount: number }[] }[] = []
  const total: Record<string, number> = {}
  for (let level = 1; level < 6; level += 1) {
    const costs = system.costAt('tread', level, { discount })
    steps.push({ level, costs })
    for (const cost of costs) total[cost.key] = (total[cost.key] ?? 0) + cost.amount
  }
  return { steps, total }
}

describe('消融实验 —— 练满一部功法的总账与满级分支', () => {
  it('满级总账按曲线累:125 点悟道点,最后一级吃掉三分之一', () => {
    const { steps, total } = climb()
    console.log('  从 1 级练到 6 级,每一级的消耗:')
    for (const step of steps) {
      console.log(`  ${step.level} → ${step.level + 1} 级:${step.costs.map(c => `${c.key} ${c.amount}`).join(' · ')}`)
    }
    console.log(`  合计:${Object.entries(total).map(([key, amount]) => `${key} ${amount}`).join(' · ')}`)

    // ① 指数曲线:前几级便宜、后几级贵
    const insight = steps.map(s => s.costs.find(c => c.key === 'insight')!.amount)
    console.log(`  悟道点逐级:${insight.join(' → ')}(最后一级占 ${((insight.at(-1)! / total['insight']!) * 100).toFixed(0)}%)`)
    expect(insight).toEqual([12, 16, 22, 31, 44])
    expect(total['insight']).toBe(125)
    // 每一级都比上一级贵(指数 + 线性两段都随等级涨)
    for (let i = 1; i < insight.length; i += 1) expect(insight[i]!).toBeGreaterThan(insight[i - 1]!)
    // 最后一级吃掉三分之一强(44 / 125):前四级加一起才 81
    expect(insight.at(-1)! / total['insight']!).toBeGreaterThan(0.3)
    expect(insight.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(81)
    // 残页是线性的:1 → 5,合计 15
    expect(steps.map(s => s.costs.find(c => c.key === 'page')!.amount)).toEqual([1, 2, 3, 4, 5])
    expect(total['page']).toBe(15)
  })

  it('折扣只省"可折项":七折之下总账只省四分之一', () => {
    const full = climb(0).total
    const discounted = climb(0.3).total
    const saved = (key: string): number => (full[key]! - discounted[key]!) / full[key]!
    console.log(
      `  不打折:悟道点 ${full['insight']} / 残页 ${full['page']} —— 打七折:悟道点 ${discounted['insight']} / 残页 ${discounted['page']}`
    )
    console.log(`  悟道点省了 ${(saved('insight') * 100).toFixed(1)}%,残页省了 ${(saved('page') * 100).toFixed(1)}%`)

    // ② 折扣只作用于可折项:悟道点按七折收,残页原价
    expect(discounted['insight']).toBeLessThan(full['insight']!)
    expect(discounted['page']).toBe(full['page'])
    // 整本的节省率落在"三成"与"零"之间 —— 一刀切会以为省了三成
    const totalFull = full['insight']! + full['page']!
    const totalDiscounted = discounted['insight']! + discounted['page']!
    const overall = (totalFull - totalDiscounted) / totalFull
    console.log(`  整本合起来省 ${(overall * 100).toFixed(1)}%(不是 30%)`)
    expect(overall).toBeGreaterThan(0.2)
    expect(overall).toBeLessThan(0.3)
    // 防空转:折扣真的生效了(否则上面在比两个相同的数)
    expect(saved('insight')).toBeCloseTo(0.3, 1)
  })

  it('入门就会的 vs 练出来的:满级的 14% 攻击里只有 4% 是"本来就会"', () => {
    const at1 = system.modsAt('tread', 1)
    const atMax = system.modsAt('tread', 6)
    console.log(`  1 级:${JSON.stringify(at1)} —— 6 级:${JSON.stringify(atMax)}`)

    // 等级曲线:基础 + 每级 × (N−1);1 级只有基础(每级那一栏以 0 出现,合并时会被忽略)
    expect(at1.attackPct).toBeCloseTo(0.04, 9)
    expect(at1.critRate ?? 0).toBe(0)
    expect(Object.keys(at1).sort()).toEqual(['attackPct', 'critRate'])
    expect(atMax.attackPct).toBeCloseTo(0.04 + 0.02 * 5, 9)
    expect(atMax.critRate).toBeCloseTo(0.005 * 5, 9)
    // 基础占满级的三成不到 —— "练满才有"是主要部分,调平衡时该动的是 perLevel
    const baseShare = at1.attackPct! / atMax.attackPct!
    console.log(`  攻击加成里"入门就有"占 ${(baseShare * 100).toFixed(0)}%,其余靠练`)
    expect(baseShare).toBeLessThan(0.3)
    // 防空转:每级确实在涨(否则上面那条占比是 100%)
    expect(atMax.attackPct!).toBeGreaterThan(at1.attackPct!)
    expect(atMax.critRate ?? 0).toBeGreaterThan(0)
  })

  it('满级分支:按"每级贡献"折算,+5% 攻击 ≈ 2.5 级,+3% 会心 ≈ 6 级', () => {
    const branches = system.branchesOf('tread')
    const per = { attackPct: 0.02, critRate: 0.005 }
    console.log('  满级可择的路(按各自的每级贡献折算成"几级"):')
    for (const branch of branches.filter(b => b.requires === undefined)) {
      const rows = Object.entries(branch.mods).map(([key, value]) => {
        const perLevel = (per as Record<string, number>)[key] ?? 0
        return `${key}+${value}${perLevel > 0 ? `(≈ ${((value ?? 0) / perLevel).toFixed(1)} 级)` : ''}`
      })
      console.log(`  ${branch.name}:${rows.join(' · ')}`)
    }
    expect(system.branchMods('tread', 'advance')).toEqual({ attackPct: 0.05 })
    expect(system.branchMods('tread', 'sink')).toEqual({ critRate: 0.03 })
    // ③ 同一个"满级再选一次"的位置,两条路折算出来的级数差一倍多
    expect(0.05 / per.attackPct).toBeCloseTo(2.5, 9)
    expect(0.03 / per.critRate).toBeCloseTo(6, 9)
    // 分支只追加词条,不动等级曲线本身
    expect(system.modsAt('tread', 6)).toEqual({ attackPct: 0.14, critRate: 0.025 })

    // 前置链:先走"沉潜"才解锁"观微" —— 没选之前它不在可选项里
    expect(system.availableBranches('tread', []).map(b => b.id)).toEqual(['advance', 'sink'])
    expect(system.availableBranches('tread', ['sink']).map(b => b.id)).toEqual(['advance', 'sink', 'deeper'])
    // 防空转:前置没满足时确实不给(而不是"一直都给")
    expect(system.availableBranches('tread', ['advance']).map(b => b.id)).not.toContain('deeper')
  })
})
