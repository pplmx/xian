/* eslint-disable no-console */
/**
 * 消融实验 —— 经济读数的四档判词,在参数上到底有多宽。
 *
 * `economy.spec.ts` 钉的是语义(进/出比值、出为 0 是无穷、判词由内容换名);这一份量的是
 * **手感**:默认阈值(0.7 / 3 / 10)落在真实参数上是什么样,以及"参数一微调就翻脸"的区间有多宽 ——
 * 这正是内容作者要拿它下判断时最需要、又最难自己试出来的数字。
 *
 * 三件被量的事:
 *   ① **四档在"支出 / 收入"上的区间**(把比值翻译成作者脑子里那个量);
 *   ② **翻档点本身**:比值正好 0.7 / 3 / 10 时分在哪一档(边界写错一格,判词就全体偏一档);
 *   ③ **±10% 的敏感区有多宽**:收入抖一成就会改判的参数占比 —— 在这个区间里下结论要谨慎。
 */
import { describe, expect, it } from 'vitest'
import { createEconomyReadings } from './economy.js'

const readings = createEconomyReadings()

/** 收入固定 10,支出按比例扫:这条轴就是"支出占收入的多少倍"(扫到 20 才够跨完四档) */
const INCOME = 10
const SWEEP = Array.from({ length: 401 }, (_, i) => i / 20) // 0 ～ 20,步长 0.05

const verdictAt = (sink: number): string => readings.read([{ key: 'x', income: INCOME, sink }])[0]!.verdictId

describe('消融实验 —— 四档判词在参数上有多宽', () => {
  it('把比值翻译成"支出 / 收入":四档各占哪一段', () => {
    const bands: { id: string; from: number; to: number }[] = []
    let current = verdictAt(SWEEP[0]!)
    let from = SWEEP[0]!
    for (const sink of SWEEP.slice(1)) {
      const verdict = verdictAt(sink)
      if (verdict !== current) {
        bands.push({ id: current, from, to: sink })
        current = verdict
        from = sink
      }
    }
    bands.push({ id: current, from, to: SWEEP[SWEEP.length - 1]! })

    for (const band of bands) {
      const spend = (sink: number): string => (sink / INCOME).toFixed(2)
      console.log(`  ${band.id.padEnd(8, ' ')} 支出/收入 ∈ [${spend(band.from)}, ${spend(band.to)})`)
    }
    // 单调:支出越多,判词只会往"紧"的一端走(idle → surplus → healthy → tight)
    const order = ['idle', 'surplus', 'healthy', 'tight']
    const seen = bands.map(b => order.indexOf(b.id))
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
    expect(seen[0]).toBeLessThan(seen[seen.length - 1]!)
  })

  it('翻档点本身:比值正好落在 0.7 / 3 / 10 时算哪一档', () => {
    // 阈值是"闭在宽的一侧":ratio < 0.7 才算瓶颈;正好 0.7 是健康;正好 10 是过剩
    expect(readings.verdictOf(0.699)).toBe('tight')
    expect(readings.verdictOf(0.7)).toBe('healthy')
    expect(readings.verdictOf(3)).toBe('healthy')
    expect(readings.verdictOf(3.001)).toBe('surplus')
    expect(readings.verdictOf(10)).toBe('surplus')
    expect(readings.verdictOf(10.001)).toBe('idle')
    // 出为 0 是无穷,不是"刚刚好":只进不出的东西判 idle
    expect(readings.ratioOf(50, 0)).toBe(Number.POSITIVE_INFINITY)
    expect(verdictAt(0)).toBe('idle')
  })

  it('±10% 的敏感区有多宽:收入抖一成就改判的参数占比', () => {
    const boundaries = [0.7, 3, 10]
    const flips = SWEEP.filter(sink => {
      if (sink === 0) return false
      const ratio = INCOME / sink
      const up = readings.verdictOf(ratio * 1.1)
      const down = readings.verdictOf(ratio / 1.1)
      return up !== down
    })
    const pct = ((flips.length / SWEEP.length) * 100).toFixed(1)
    console.log(
      `  扫过 ${SWEEP.length} 个参数点(支出/收入 ∈ [${(INCOME / SWEEP[SWEEP.length - 1]!).toFixed(2)}, 2.00],` +
        `贴近"资源吃紧"那一端):收入抖 ±10% 就改判的有 ${flips.length} 个(${pct}%)`
    )
    // 敏感区就是"贴着翻档点"的那几段:每条边界两侧各占一小截
    for (const b of boundaries) {
      const near = flips.filter(sink => {
        const ratio = INCOME / sink
        return Math.abs(ratio - b) / b < 0.1
      })
      expect(near.length, `边界 ${b} 附近应当有敏感点`).toBeGreaterThan(0)
    }
    expect(pct).not.toBe('0.0')
    // 而且敏感区只占少数 —— 大多数参数点上,判词是稳的
    expect(flips.length / SWEEP.length).toBeLessThan(0.25)
  })

  it('note 只是"没把握"的标记,不改判词', () => {
    const withNote = readings.read([{ key: 'x', income: 100, sink: 100, note: '这个出口还没上线' }])[0]!
    const without = readings.read([{ key: 'x', income: 100, sink: 100 }])[0]!
    expect(withNote.verdictId).toBe(without.verdictId)
    expect(withNote.note).toBe('这个出口还没上线')
  })

  it('内容可以换阈值与判词名,而"比值 → 档位"的形状不变', () => {
    const custom = createEconomyReadings({ bands: { tight: 0.5, healthy: 2, surplus: 5 }, labels: { idle: '纯囤积' } })
    expect(custom.verdictOf(0.4)).toBe('tight')
    expect(custom.verdictOf(0.5)).toBe('healthy')
    expect(custom.verdictOf(2.5)).toBe('surplus')
    expect(custom.verdictOf(6)).toBe('idle')
    expect(custom.read([{ key: 'x', income: 100, sink: 0 }])[0]!.verdict).toBe('纯囤积')
  })
})
