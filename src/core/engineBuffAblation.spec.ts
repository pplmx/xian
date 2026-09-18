/* eslint-disable no-console */
/**
 * 消融实验 —— 「叠时长」在真实服药节奏下会走成什么样。
 *
 * 问题(不是"哪个口径更好",而是把选择的**后果**钉在数字上):
 *   本作的丹药增益是 30 分钟量级(聚灵 1800 秒),而玩家常常吃得比这更勤。
 *   ① 覆盖率会不会变成常驻?
 *   ② 停手之后还剩多少余量?
 *   ③ 「叠时长」(本作口径)与「取较长者 / 重新起算」在这两条上差在哪?
 *   ④ 给不给 `maxDurationSec` 上限,又差在哪?
 *
 * 做法:拿库的口径直接跑一条固定节奏的时间线(每 20 分钟吃一次、连吃 24 小时),
 * 按分钟采样覆盖率,并看那一刻的剩余时长。三种叠法 + 一档上限,四个样本。
 *
 * 结论写在下面对应的用例里 —— 本作选的是"叠时长且不设上限",于是**吃得越勤越能囤**;
 * 想收住,库给了两条正当的路:设 `maxDurationSec`(封住余量)或换成 `'reset'` / `'longest'`
 * (每次重新起算)。这条实验不主张改哪个,只保证"哪天有人改了口径,后果是已知的"。
 */
import { describe, expect, it } from 'vitest'
import { createBuffSystem } from 'wanxiang-engine'

/** 内容取自本作的聚灵丹口径(30 分钟、修炼速度 +50%) */
const defs = [{ id: 'jing', durationSec: 30 * 60, mods: { cultivationSpeed: 0.5 } }]

const extend = createBuffSystem({ defs, clock: 'ms' })
const longest = createBuffSystem({ defs, clock: 'ms', stacking: 'longest' })
const reset = createBuffSystem({ defs, clock: 'ms', stacking: 'reset' })
const capped = createBuffSystem({ defs: [{ ...defs[0]!, maxDurationSec: 60 * 60 }], clock: 'ms' })

const MIN = 60_000

/** 每 `gapMin` 分钟吃一次,连吃 `hours` 小时;按分钟采样算覆盖率与结束时余量 */
function simulate(
  system: ReturnType<typeof createBuffSystem<(typeof defs)[number]['mods']>>,
  gapMin: number,
  hours: number
): { uses: number; coverage: number; remainingHours: number } {
  const gap = gapMin * MIN
  const end = hours * 60 * MIN
  let list: ReturnType<typeof system.apply>['instances'] = []
  let uses = 0
  let active = 0
  for (let t = 0; t <= end; t += MIN) {
    // 服药点:t = 0, gap, 2gap …… 严格小于终点(终点那一刻不再补一次)
    if (t % gap === 0 && t < end) {
      list = system.apply(list, 'jing', t).instances
      uses += 1
    }
    if (system.has(list, 'jing', t)) active += 1
  }
  return { uses, coverage: active / (end / MIN + 1), remainingHours: system.remainingSec(list, 'jing', end) / 3600 }
}

describe('消融实验 —— 丹药品鉴:吃得比时长勤会怎样', () => {
  it('吃得比时长勤(20 分钟一次):覆盖率都是 100%,差别全在"囤了多少"', () => {
    const rows = [
      ['叠时长(本作)', simulate(extend, 20, 24)],
      ['取较长者', simulate(longest, 20, 24)],
      ['重新起算', simulate(reset, 20, 24)],
      ['叠时长 + 上限 1 小时', simulate(capped, 20, 24)]
    ] as const
    for (const [label, r] of rows) {
      console.log(
        `  ${label}:吃了 ${r.uses} 次 · 覆盖率 ${(r.coverage * 100).toFixed(1)}% · 结束时还剩 ${r.remainingHours.toFixed(1)} 小时`
      )
    }
    // ① 吃得比时长勤,四种口径覆盖率都是 100% —— "常驻"这件事与叠法无关
    expect(rows.every(([, r]) => r.coverage === 1)).toBe(true)
    // ② 差别在余量:叠时长把"每次净赚的 10 分钟"都留给玩家(24 小时定点服药 → 余 12 小时);
    //    "取较长者 / 重新起算"只是刷新:结束时只剩"距上次服药"的那 10 分钟
    expect(rows[0]![1].remainingHours).toBeCloseTo(12, 6)
    expect(rows[1]![1].remainingHours).toBeCloseTo(10 / 60, 6)
    expect(rows[2]![1].remainingHours).toBeCloseTo(10 / 60, 6)
    // ③ 上限一给,囤积就被压在"一次间隔"之内(这一刻余 40 分钟,覆盖照旧)——
    //    这就是"想收住"的那条路:上限是相对**服药那一刻**封的
    expect(rows[3]![1].remainingHours).toBeCloseTo(2 / 3, 6)
  })

  it('节奏越密囤得越多:每次净赚(时长 − 间隔),余量按次数线性涨', () => {
    const remaining = (gapMin: number): number => simulate(extend, gapMin, 24).remainingHours
    console.log(`  叠时长的囤积(24 小时):间隔 25 分 → ${remaining(25).toFixed(1)}h · 20 分 → ${remaining(20).toFixed(1)}h · 10 分 → ${remaining(10).toFixed(1)}h`)
    // 每次净赚 (30 − 间隔) 分钟,余量 = 次数 × 净赚(t = 0 那一次也算)
    expect(remaining(25)).toBeCloseTo(5, 6) // 58 次 × 5 分钟
    expect(remaining(20)).toBeCloseTo(12, 6) // 72 次 × 10 分钟
    expect(remaining(10)).toBeCloseTo(48, 6) // 144 次 × 20 分钟
    // 密度翻倍,囤积大约也翻倍(不是线性于次数,而是线性于"净赚的分钟数")
    expect(remaining(10)).toBeGreaterThan(remaining(20))
    expect(remaining(20)).toBeGreaterThan(remaining(25))
  })

  it('吃得比时长慢(45 分钟一次):四种口径完全一样,余量封在一次时长之内', () => {
    const rows = [extend, longest, reset, capped].map(s => simulate(s, 45, 24))
    for (const [i, r] of rows.entries()) {
      console.log(`  第 ${i + 1} 种口径:吃了 ${r.uses} 次 · 覆盖率 ${(r.coverage * 100).toFixed(1)}% · 余 ${r.remainingHours.toFixed(1)} 小时`)
    }
    // 采样是按分钟打的,所以覆盖率略高于 30/45(整数分钟落在生效窗口里的比例)
    expect(rows.every(r => r.coverage > 0.65 && r.coverage < 0.7)).toBe(true)
    // 间隔 > 时长时,"叠"与"刷新"没有区别:四种口径结束时都已经过期(囤不起来)
    expect(rows.every(r => r.remainingHours === 0)).toBe(true)
  })

  it('停手之后:叠时长的玩家还能享受半天,刷新型的只剩"距上次服药"那十分钟', () => {
    // 24 小时定点服药后停手 —— 余量就是"囤下来的时间"
    const hoarder = simulate(extend, 20, 24).remainingHours
    const refresher = simulate(longest, 20, 24).remainingHours
    console.log(`  停手后:叠时长还能吃 ${hoarder.toFixed(1)} 小时老本;取较长者的只剩 ${(refresher * 60).toFixed(0)} 分钟`)
    expect(hoarder).toBeGreaterThan(10)
    expect(refresher).toBeLessThanOrEqual(0.5)
  })
})
