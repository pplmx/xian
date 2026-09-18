/* eslint-disable no-console */
/**
 * 消融实验 —— 四个乘区各值多少,以及"练到九成"要多少经验。
 *
 * `crafting.spec.ts` 钉的是语义(乘区怎么乘、越级查表后接指数、熟练度不到顶、分档取第一档);
 * 这一份量的是**刻度**:内容作者定"乘区下限给多少""越级几档算赌一把""熟练度练到 90 要多久"
 * 时,需要的正是这几张表。
 *
 * 三条量出来的结论:
 *   ① **下限决定"全弱时还剩多少"**:四项全弱不是 0 —— 实测 `0.9 × 0.15 × 0.25 × 0.6 = 2.0%`,
 *      低到不该开炉,但"赌一把"这个选择还在(这正是下限存在的理由);
 *   ② **每个乘区的"权重"就是 1 / 下限**:下限 0.15 的那一项从 0 拉满,成功率涨 6.7 倍;
 *      下限 0.6 的只涨 1.7 倍 —— 想强调谁的准备,就把谁的下限压低;
 *   ③ **越级陡得很快**:高三阶 18%、高六阶 2.3%、高十阶 0.14%(表外每阶再乘 0.5);
 *      熟练度是双曲饱和:经验 100 到 50 分、900 才到 90 分,**永远不到 100**。
 */
import { describe, expect, it } from 'vitest'
import type { CraftFormula } from './crafting.js'
import { composeCraftRate, overReachFactor, proficiencyFromExp, stageNameOf } from './crafting.js'

/** 一份典型的炼制配方:三个乘区 + 越级 */
const FORMULA: CraftFormula = {
  baseRate: 0.9,
  levers: {
    mastery: { floor: 0.15, span: 0.85 }, // 掌握(记得多少)
    lore: { floor: 0.25, span: 0.75 }, // 认知(认不认得方中之物)
    skill: { floor: 0.6, span: 0.4 } // 技艺(练到什么程度)
  },
  overReach: { key: 'over', spec: { table: [1, 0.6, 0.35, 0.18], decay: 0.5 } }
}

const rateOf = (levers: Record<string, number>, over = 0): number =>
  composeCraftRate({ mastery: 0, lore: 0, skill: 0, ...levers, over }, FORMULA)

const pct = (value: number): string => `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`

describe('消融实验 —— 四个乘区各值多少', () => {
  it('四项全弱不是 0:下限决定"最坏还剩多少"', () => {
    const allWeak = rateOf({})
    const allFull = rateOf({ mastery: 1, lore: 1, skill: 1 })
    console.log(`  四项全弱:${pct(allWeak)} —— 四项全满:${pct(allFull)}(基准 ${pct(FORMULA.baseRate)})`)

    // ① 全弱 = 基准 × 各下限之积(不是 0:0 会让"赌一把"这个选择消失)
    expect(allWeak).toBeCloseTo(0.9 * 0.15 * 0.25 * 0.6, 9)
    expect(allWeak).toBeGreaterThan(0)
    expect(allWeak).toBeLessThan(0.05) // 低到不该开炉
    // 全满就是基准(不越级)
    expect(allFull).toBeCloseTo(FORMULA.baseRate, 9)
    // 防空转:两个极端之间差了四十多倍(0.9 vs 2.0%)
    expect(allFull / allWeak).toBeGreaterThan(40)
  })

  it('每个乘区的权重就是 1 / 下限:下限越低的那一项越"值钱"', () => {
    const rows = (['mastery', 'lore', 'skill'] as const).map(lever => {
      const off = rateOf({})
      const on = rateOf({ [lever]: 1 })
      return { lever, off, on, gain: on / off, floor: FORMULA.levers[lever]!.floor }
    })
    console.log('  只把一项从 0 拉满(其余留 0):')
    for (const row of rows) {
      console.log(
        `  ${row.lever.padEnd(8, ' ')} 下限 ${row.floor}:${pct(row.off)} → ${pct(row.on)}(×${row.gain.toFixed(1)})`
      )
    }

    // ② 单独拉满的倍数 = 1 / 下限
    for (const row of rows) expect(row.gain).toBeCloseTo(1 / row.floor, 6)
    // 下限最低的那一项倍数最大 —— 这就是"想强调谁的准备,就压低谁的下限"
    expect(rows[0]!.gain).toBeGreaterThan(rows[1]!.gain)
    expect(rows[1]!.gain).toBeGreaterThan(rows[2]!.gain)
    // 防空转:三项的下限确实不同(否则上面是三个一样的数)
    expect(new Set(rows.map(r => r.floor)).size).toBe(3)
  })

  it('越级陡得很快:高三阶只剩 18%,高十阶千分之一', () => {
    const rows = [0, 1, 2, 3, 4, 6, 8, 10].map(over => ({ over, factor: overReachFactor(over, FORMULA.overReach!.spec) }))
    console.log('  越级几阶 → 因子(全满准备时的成功率还要乘上它)')
    for (const row of rows) {
      console.log(`  高 ${String(row.over).padStart(2, ' ')} 阶 → ${pct(row.factor)}${row.over > 0 ? `(满准备的 ${pct(FORMULA.baseRate * row.factor)})` : ''}`)
    }

    // ③ 表内查表、表外指数衰减
    expect(rows[0]!.factor).toBe(1)
    expect(rows[1]!.factor).toBeCloseTo(0.6, 9)
    expect(rows[3]!.factor).toBeCloseTo(0.18, 9)
    expect(rows[5]!.factor).toBeCloseTo(0.18 * 0.5 ** 3, 9) // 高 6 阶 = 0.045
    expect(rows[7]!.factor).toBeLessThan(0.005) // 高 10 阶 < 0.5%
    // 越级是"代价陡",不是一堵墙:再高也仍然 > 0
    expect(rows[7]!.factor).toBeGreaterThan(0)
    // 单调:越深越难
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.factor).toBeLessThan(rows[i - 1]!.factor)
  })

  it('熟练度:双曲饱和,永远不到 100 —— 到九成要 9 倍 scale 的经验', () => {
    const SCALE = 100
    const rows = [0, 50, 100, 200, 400, 900, 1900, 9900].map(exp => ({ exp, level: proficiencyFromExp(exp, SCALE) }))
    console.log('  累计经验 → 熟练度(scale = 100)')
    for (const row of rows) {
      console.log(`  ${String(row.exp).padStart(4, ' ')} 点 → ${row.level.toFixed(1)}`)
    }

    // 双曲饱和:100·e/(e+100)
    expect(rows[0]!.level).toBe(0)
    expect(rows[2]!.level).toBeCloseTo(50, 6) // 经验 = scale → 一半
    expect(rows[5]!.level).toBeCloseTo(90, 6) // 经验 = 9 × scale → 九成
    expect(rows[6]!.level).toBeCloseTo(95, 6)
    expect(rows[7]!.level).toBeLessThan(100) // 永远不到顶
    // ③ 反推"练到 p 分要多少经验" = scale × p / (1 − p):90 分 900 点、99 分 9900 点
    const expFor = (p: number): number => (SCALE * p) / (1 - p)
    expect(expFor(0.9)).toBeCloseTo(900, 6)
    expect(expFor(0.99)).toBeCloseTo(9900, 6)
    // 防空转:最后一段"涨得很慢"是真的 —— 90 → 99 要 9000 点,是前 90 分的十倍
    expect(expFor(0.99) / expFor(0.9)).toBeCloseTo(11, 0)

    // 分档只负责给裸数字起名字:按 min 从高到低找第一档,不改变数值
    const stages = [
      { min: 90, name: '大成' },
      { min: 60, name: '熟练' },
      { min: 30, name: '入门' },
      { min: 0, name: '生疏' }
    ]
    expect(stageNameOf(90, stages)).toBe('大成') // 正好在门槛上算这一档
    expect(stageNameOf(89.9, stages)).toBe('熟练')
    expect(stageNameOf(0, stages)).toBe('生疏')
  })
})
