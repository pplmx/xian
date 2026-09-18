import { describe, expect, it } from 'vitest'
import { planIdle, runIdle } from './idle'

const HOUR = 3600_000

describe('离线推进 —— 时长账、粒度、效率', () => {
  it('不封顶、不打折时,有效时长就是实际时长', () => {
    const plan = planIdle(2 * HOUR, { stepMs: 60_000 })
    expect(plan.cappedMs).toBe(2 * HOUR)
    expect(plan.effectiveMs).toBe(2 * HOUR)
    expect(plan.steps).toBe(120)
    expect(plan.remainderMs).toBe(0)
    expect(plan.overflowMs).toBe(0)
    expect(plan.capped).toBe(false)
  })

  it('上限与效率分别作用:cappedMs 封顶、effectiveMs 再打折', () => {
    const plan = planIdle(24 * HOUR, { stepMs: 60_000, capMs: 8 * HOUR, efficiency: 0.9 })
    expect(plan.cappedMs).toBe(8 * HOUR)
    expect(plan.effectiveMs).toBeCloseTo(7.2 * HOUR, 6)
    expect(plan.steps).toBe(432)
    expect(plan.overflowMs).toBe(16 * HOUR)
    expect(plan.capped).toBe(true)
  })

  it('不足一步的余量不吞:留在 remainderMs 里', () => {
    const plan = planIdle(90_000, { stepMs: 60_000 })
    expect(plan.steps).toBe(1)
    expect(plan.remainderMs).toBe(30_000)
  })

  it('步数上限是防御性的:到了就停,但余量照实报', () => {
    const plan = planIdle(100 * HOUR, { stepMs: 1000, maxSteps: 500 })
    expect(plan.steps).toBe(500)
    expect(plan.remainderMs).toBe(100 * HOUR - 500_000)
  })

  it('负数与非正步长:一个归零,一个直接报错', () => {
    expect(planIdle(-5, { stepMs: 1000 }).elapsedMs).toBe(0)
    expect(() => planIdle(1000, { stepMs: 0 })).toThrow(/stepMs/)
  })

  it('runIdle 按步折叠,步数与顺序与 plan 一致', () => {
    const plan = planIdle(5 * 60_000, { stepMs: 60_000 })
    const seen: number[] = []
    const total = runIdle(plan, 0, (state, i, stepMs) => {
      seen.push(i)
      return state + stepMs
    })
    expect(plan.steps).toBe(5)
    expect(plan.stepMs).toBe(60_000)
    expect(seen).toEqual([0, 1, 2, 3, 4])
    expect(total).toBeCloseTo(5 * 60_000, 6)
  })
})
