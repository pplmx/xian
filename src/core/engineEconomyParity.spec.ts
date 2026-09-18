/**
 * 经济读数对账 —— 判词与比值交给库之后,与**迁移前冻结的旧实现**逐条相同。
 *
 * 与 engineParity 同一条纪律。冻结的是两行很容易被"顺手优化"掉的数学:
 *   `ratio = 出 > 0 ? 进 / 出 : ∞` —— 出为 0 时是**无穷**,不是 1;
 *   `verdict = ratio < 0.7 ? 瓶颈 : ratio ≤ 3 ? 健康 : ratio ≤ 10 ? 过剩 : 闲置`。
 * 这两行写错,任何"没有出口"的资源都会显示成"刚刚好",而审计的意义就没了。
 *
 * 对账的对象是**真实的 21 个时代**(每个时代的 8 条资源流),不是造出来的数。
 */
import { describe, expect, it } from 'vitest'
import { createEconomyReadings } from 'wanxiang-engine'
import { MAX_MAJOR } from '@/data/realms'
import { fullEconomyAudit, type ResourceFlow } from './economySim'

/** 本作用的那一份(判词换成中文;阈值用库的默认) */
const READINGS = createEconomyReadings({ labels: { tight: '瓶颈', healthy: '健康', surplus: '过剩', idle: '闲置' } })

// —— 迁移前冻结的旧口径(原 core/economySim.ts 的两行)——
const refRatio = (income: number, sink: number): number => (sink > 0 ? income / sink : Number.POSITIVE_INFINITY)

function refVerdictOf(ratio: number): ResourceFlow['verdict'] {
  if (ratio < 0.7) return '瓶颈'
  if (ratio <= 3) return '健康'
  if (ratio <= 10) return '过剩'
  return '闲置'
}

describe('经济读数对账 —— 判词与比值', () => {
  it('全部 21 个时代 × 每条资源流:比值与判词都与冻结实现相同', () => {
    const eras = fullEconomyAudit()
    expect(eras.length).toBe(MAX_MAJOR + 1)
    let compared = 0
    for (const era of eras) {
      expect(era.flows.length).toBeGreaterThan(0)
      for (const flow of era.flows) {
        const ratio = refRatio(flow.incomePerHour, flow.sinkPerHour)
        expect(flow.ratio, `${era.major} · ${flow.resource} 的比值`).toBe(ratio)
        expect(flow.verdict, `${era.major} · ${flow.resource} 的判词`).toBe(refVerdictOf(ratio))
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(100) // 对账确实跑满了整张表
  })

  it('边界与极端:出为 0(只进不出)、进为 0(只出不进)、恰好压在 0.7 / 3 / 10 上', () => {
    const boundaries: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [7, 10],
      [6.999, 10],
      [30, 10],
      [30.001, 10],
      [100, 10],
      [100.001, 10]
    ]
    for (const [income, sink] of boundaries) {
      const ratio = refRatio(income, sink)
      const reading = READINGS.read([{ key: 'x', income, sink }])[0]!
      expect(reading.ratio, `${income}/${sink}`).toBe(ratio)
      expect(reading.verdict, `${income}/${sink}`).toBe(refVerdictOf(ratio))
    }
  })

  it('"没把握就明说"的约定还在:模型没覆盖的那条读数带 note', () => {
    const outer = fullEconomyAudit().filter(era => era.flows.some(f => f.resource === 'wudao' && f.note))
    for (const era of outer) {
      const flow = era.flows.find(f => f.resource === 'wudao' && f.note)!
      expect(flow.note).toContain('未入模型')
    }
  })
})
