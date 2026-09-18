/* eslint-disable no-console */
/**
 * 消融实验 —— 离线收益的边际曲线,以及"上限到底在哪一刻生效"。
 *
 * `idle.spec.ts` 钉的是语义(上限、效率、步数、余量各是什么,`overflowMs` 报多少);
 * 这一份量的是**收益曲线**,量出来一条与实现直觉不同的结论:
 *
 *   ① **过了上限,边际收益是 0**:离线 6 小时与离线 72 小时拿到的**完全一样** ——
 *      这条曲线决定"离线上限要不要卖"、"玩家会不会觉得亏";
 *   ② **上限是按"每次结算"施加的,不是按天累计的**:同样 8 小时,一次算完只拿到 4 步,
 *      拆成两次 4 小时结算却能拿到 6 步 —— 上限被拆分绕过去了;
 *   ③ 因此**"分段与一次算完一致"这条不变量,只在上限没被踩到时成立**(库里对时间与随机的
 *      组合验收就是这么设的);踩到上限之后必须自己维护"今天已经计入多少",否则限不住;
 *   ④ `maxSteps` 是防御性的兜底(防 stepMs 设得过小跑爆),代价是超出的步数会留在
 *      `remainderMs` 里 —— 它不是"少发",是"这次不发"。
 */
import { describe, expect, it } from 'vitest'
import type { IdlePlan } from './idle.js'
import { planIdle, runIdle } from './idle.js'

const HOUR = 3600_000

/** 一次结算:每一步 +1(收益与步数成正比,便于直接读"拿到几步") */
const gainOf = (plan: IdlePlan): number => runIdle(plan, 0, (sum: number) => sum + 1)

describe('消融实验 —— 离线账的边际收益与上限口径', () => {
  it('过了上限,再多等一小时也是 0:6 小时与 72 小时拿到的一样', () => {
    const cap = 6 * HOUR
    const rows = [1, 2, 6, 7, 12, 24, 72].map(hours => {
      const plan = planIdle(hours * HOUR, { stepMs: HOUR, capMs: cap })
      return { hours, steps: gainOf(plan), ratio: plan.cappedMs / plan.elapsedMs, overflow: plan.overflowMs / HOUR }
    })
    console.log('  离线时长 → 拿到几步 / 计入比例 / 被吞掉多少')
    for (const row of rows) {
      console.log(
        `  ${String(row.hours).padStart(2, ' ')} 小时 → ${row.steps} 步 · 计入 ${(row.ratio * 100).toFixed(0)}%` +
          `${row.overflow > 0 ? ` · 被吞掉 ${row.overflow.toFixed(0)} 小时` : ''}`
      )
    }

    // ① 上限之内:等多久拿多久;上限之外:一步都不多
    const six = rows.find(r => r.hours === 6)!
    const seventyTwo = rows.find(r => r.hours === 72)!
    expect(six.steps).toBe(6)
    expect(seventyTwo.steps).toBe(6) // 多等 66 小时 = 0 收益
    expect(seventyTwo.ratio).toBeCloseTo(6 / 72, 3)
    // 防空转:上限之内确实在涨(否则"6 步"可能只是步长设成了 1 小时)
    expect(rows.find(r => r.hours === 1)!.steps).toBe(1)
    expect(rows.find(r => r.hours === 2)!.steps).toBe(2)
  })

  it('边际收益曲线:上限之前每小时 1 步,之后恒定 0', () => {
    const cap = 6 * HOUR
    const marginal = (from: number, to: number): number =>
      gainOf(planIdle(to * HOUR, { stepMs: HOUR, capMs: cap })) - gainOf(planIdle(from * HOUR, { stepMs: HOUR, capMs: cap }))
    const curve = [1, 2, 3, 6, 7, 24].map(hours => ({ at: hours, delta: marginal(hours - 1, hours) }))
    console.log(`  第 N 小时多等一小时能多拿几步:${curve.map(c => `${c.at}h:${c.delta}`).join(' · ')}`)

    // ② 前 6 小时每小时都是 1,第 7 小时开始归零 —— 这就是曲线拐点
    expect(curve.slice(0, 4).every(c => c.delta === 1)).toBe(true)
    expect(curve[4]!.delta).toBe(0)
    expect(curve[5]!.delta).toBe(0)
  })

  it('上限是按"每次结算"施加的:同样 8 小时,拆两次结算能多拿', () => {
    const config = { stepMs: HOUR, capMs: 6 * HOUR }
    const once = gainOf(planIdle(8 * HOUR, config))
    const split = gainOf(planIdle(4 * HOUR, config)) + gainOf(planIdle(4 * HOUR, config))
    const splitIntoThree = gainOf(planIdle(3 * HOUR, config)) * 2 + gainOf(planIdle(2 * HOUR, config))
    console.log(`  同样 8 小时:一次算完 ${once} 步 · 拆成 4+4 结算 ${split} 步 · 拆成 3+3+2 结算 ${splitIntoThree} 步`)

    // ③ 上限被拆分绕过 —— 每一次调用都各自吃满一次额度
    expect(split).toBeGreaterThan(once)
    expect(splitIntoThree).toBeGreaterThanOrEqual(split)
    // 防空转:没有上限时拆分与一次算完必须一致(差异确实来自上限,不是来自拆分本身)
    const noCap = { stepMs: HOUR }
    const onceFree = gainOf(planIdle(8 * HOUR, noCap))
    const splitFree = gainOf(planIdle(4 * HOUR, noCap)) + gainOf(planIdle(4 * HOUR, noCap))
    expect(splitFree).toBe(onceFree)
    expect(onceFree).toBe(8) // 8 步:没有上限就是等多久拿多久
  })

  it('效率是"截断之后再打折",顺序反过来会算错', () => {
    const plan = planIdle(12 * HOUR, { stepMs: HOUR, capMs: 6 * HOUR, efficiency: 0.5 })
    console.log(
      `  12 小时 / 上限 6 小时 / 效率 0.5 → 计入 ${plan.cappedMs / HOUR} 小时 · 有效 ${plan.effectiveMs / HOUR} 小时 · ${plan.steps} 步 · 余 ${(plan.remainderMs / 60_000).toFixed(0)} 分钟`
    )
    // 先截断(6h)再打折(3h):如果顺序反了会得到 12h×0.5=6h → 6 步
    expect(plan.cappedMs).toBe(6 * HOUR)
    expect(plan.effectiveMs).toBe(3 * HOUR)
    expect(plan.steps).toBe(3)
    expect(plan.remainderMs).toBe(0)
    // 防呆:把效率提到 1,步数必须跟着变(否则上面那个 3 可能只是巧合)
    expect(planIdle(12 * HOUR, { stepMs: HOUR, capMs: 6 * HOUR, efficiency: 1 }).steps).toBe(6)
  })

  it('maxSteps 是防御性兜底:超出部分留在余量里,不是少发', () => {
    const plan = planIdle(8 * HOUR, { stepMs: 60_000, capMs: 6 * HOUR, maxSteps: 90 })
    console.log(
      `  8 小时 / 步长 1 分钟 / maxSteps 90 → ${plan.steps} 步 · 余量 ${(plan.remainderMs / 60_000).toFixed(0)} 分钟(有效时长 ${(plan.effectiveMs / HOUR).toFixed(1)} 小时)`
    )
    expect(plan.steps).toBe(90)
    // 被兜底拦下的部分完整地留在余量里:步数 × 步长 + 余量 = 有效时长
    expect(plan.steps * plan.stepMs + plan.remainderMs).toBe(plan.effectiveMs)
    expect(plan.remainderMs).toBeGreaterThan(0)
    // 防空转:不设 maxSteps 时步数更多(兜底确实在拦)
    expect(planIdle(8 * HOUR, { stepMs: 60_000, capMs: 6 * HOUR }).steps).toBeGreaterThan(90)
  })
})
