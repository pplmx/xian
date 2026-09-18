/* eslint-disable no-console */
/**
 * 消融实验 —— 同一份药,三种叠加算法各兑现多少。
 *
 * `buffs.spec.ts` 钉的是语义(叠时长 / 取长 / 重算各自怎么算、过期不叠负剩余、生效与清理同一判据);
 * 这一份量的是**兑现量**:一瓶 30 分钟的药,每 20 分钟服一次、一连服 24 次,
 * 三种算法下玩家实际"有状态"的时间差多少。
 *
 * 三条量出来的结论:
 *   ① **重叠时,"叠时长"与"刷新"差得很远**:同样 24 次药,`extend` 兑现 720 分钟(整段观察窗
 *      全程有状态),`reset` / `longest` 只有 490 分钟(差 47%)—— 玩家的说法就是"药白吃了";
 *   ② **不重叠时三种算法完全一样**:每 60 分钟服一次 30 分钟的药,谁也不会覆盖谁,
 *      覆盖率稳定在 50% —— 差异只来自**重叠**,不是来自算法本身"更慷慨";
 *   ③ **过期之后再服,`extend` 也不补回过去**:基准是 `max(旧到期, now)`,
 *      所以隔了两小时才想起服药,拿到的是完整的 30 分钟,而不是"把过去那两小时补上"。
 *
 * 另附一条边界:封顶(`maxDurationSec`)是封在 `now + 上限`,叠到顶就不再涨。
 */
import { describe, expect, it } from 'vitest'
import type { BuffStacking } from './buffs.js'
import { createBuffSystem } from './buffs.js'

const MIN = 60

/** 一瓶药:30 分钟 */
const PILL = { id: 'pill', durationSec: 30 * MIN, kind: 'pill' }

interface Report {
  /** 一直"有状态"的总秒数(在整段观察窗口里逐分钟采样) */
  covered: number
  /** 最后一次服完之后还能撑多久 */
  tail: number
}

/**
 * 按固定的服药节奏跑一遍,返回兑现量。
 *
 * @param stacking   叠加算法
 * @param everySec   每多久服一次
 * @param doses      一共服几次
 * @param windowSec  观察窗口(要比最后一剂撑得久,才能看清尾部)
 */
function simulate(
  stacking: BuffStacking,
  everySec: number,
  doses: number,
  windowSec: number,
  def: typeof PILL = PILL
): Report {
  const buffs = createBuffSystem<{ note: string }>({ defs: [def], stacking })
  let instances: ReturnType<typeof buffs.apply>['instances'] = []
  const doseAt = (n: number): number => n * everySec
  let nextDose = 0
  let covered = 0
  for (let now = 0; now <= windowSec; now += MIN) {
    if (nextDose < doses && doseAt(nextDose) === now) {
      instances = buffs.apply(instances, def.id, now).instances
      nextDose += 1
    }
    if (buffs.has(instances, def.id, now)) covered += MIN
  }
  const last = instances[0]!
  return { covered, tail: last.endsAt - doseAt(doses - 1) }
}

describe('消融实验 —— 同一份药,三种叠加算法各兑现多少', () => {
  it('重叠时"叠时长"与"刷新"差 47%:24 次药兑换 720 分钟 vs 490 分钟', () => {
    const every = 20 * MIN
    const doses = 24
    const window = 12 * 60 * MIN
    const rows: { stacking: BuffStacking; report: Report }[] = (['extend', 'longest', 'reset'] as const).map(stacking => ({
      stacking,
      report: simulate(stacking, every, doses, window)
    }))
    console.log('  30 分钟的药,每 20 分钟服一次,连服 24 次(观察 12 小时)')
    for (const row of rows) {
      console.log(`  ${row.stacking.padEnd(8, ' ')}:有状态 ${row.report.covered / MIN} 分钟 · 最后一剂之后还能撑 ${row.report.tail / MIN} 分钟`)
    }

    const extend = rows.find(r => r.stacking === 'extend')!.report
    const reset = rows.find(r => r.stacking === 'reset')!.report
    const longest = rows.find(r => r.stacking === 'longest')!.report
    const gapDoses = (extend.covered - reset.covered) / (30 * MIN)
    console.log(`  两者的差 = ${(extend.covered - reset.covered) / MIN} 分钟 ≈ ${gapDoses.toFixed(2)} 剂药(玩家视角:"我白吃了七剂多")`)
    // ① 默认算法把剩余时间足额兑现;另外两种把剩余清零重算
    expect(extend.covered).toBeGreaterThan(reset.covered)
    expect(extend.tail).toBeGreaterThan(reset.tail)
    expect(gapDoses).toBeGreaterThan(7)
    // ② "取长"与"重算"在"间隔 < 时长"时是同一个东西(都会把剩余砍掉)
    expect(longest.covered).toBe(reset.covered)
    // 防空转:差值确实来自重叠 —— 每次都叠加了完整的 30 分钟
    expect(extend.tail).toBeGreaterThan(30 * MIN)
    expect(reset.tail).toBe(30 * MIN)
  })

  it('不重叠时三种算法完全一样:差异只来自"重叠"', () => {
    const every = 60 * MIN
    const doses = 8
    const window = 10 * 60 * MIN
    const reports = (['extend', 'longest', 'reset'] as const).map(stacking => ({
      stacking,
      report: simulate(stacking, every, doses, window)
    }))
    for (const row of reports) {
      console.log(`  每 60 分钟服一次(药效 30 分钟):${row.stacking.padEnd(8, ' ')}有状态 ${row.report.covered / MIN} 分钟`)
    }
    // ② 不重叠 → 三种算法给出同一个数(30/60 = 一半时间有状态)
    const covered = reports.map(r => r.report.covered)
    expect(new Set(covered).size).toBe(1)
    expect(covered[0]).toBe(4 * 60 * MIN)
    // 防空转:与上一组重叠的情形对比,这个数明显更低(否则"一样"没有信息量)
    expect(covered[0]).toBeLessThan(simulate('extend', 20 * MIN, 24, 12 * 60 * MIN).covered)
  })

  it('过期之后再服:补不回过去,但也一分不少地给满这一剂', () => {
    const buffs = createBuffSystem({ defs: [PILL] })
    const first = buffs.apply([], 'pill', 0)
    expect(first.endsAt).toBe(30 * MIN)

    // 隔了两小时才想起:基准是 max(旧到期, now),不是"旧到期 + 时长"
    const late = buffs.apply(first.instances, 'pill', 150 * MIN)
    expect(late.endsAt).toBe(180 * MIN) // now + 30 分钟,而不是 30 + 30 = 60 分钟(那已经是过去)
    console.log(`  第 0 分钟服一剂(到 ${first.endsAt! / MIN} 分钟),第 150 分钟再服一剂 → 到 ${late.endsAt! / MIN} 分钟`)

    // ③ 过期不叠负剩余:这一剂是足的
    expect(late.endsAt! - 150 * MIN).toBe(30 * MIN)
    // 防空转:没过期时叠加会涨(所以上面那个"没涨"确实是过期造成的)
    const inTime = buffs.apply(first.instances, 'pill', 10 * MIN)
    expect(inTime.endsAt).toBe(60 * MIN) // 30 + 30:剩余 20 分钟 + 新的 30 分钟
  })

  it('封顶:一重叠就顶到 now + 上限,然后稳定停在顶上', () => {
    const capped = { ...PILL, maxDurationSec: 45 * MIN }
    const buffs = createBuffSystem({ defs: [capped] })
    let instances = buffs.apply([], 'pill', 0).instances
    const trail: number[] = []
    for (const now of [10 * MIN, 20 * MIN, 30 * MIN, 40 * MIN]) {
      const applied = buffs.apply(instances, 'pill', now)
      instances = applied.instances
      trail.push((applied.endsAt! - now) / MIN)
    }
    console.log(`  药效 30 分钟、上限 45 分钟,每 10 分钟叠一次,每次叠完的剩余分钟数:${trail.join(' → ')}`)
    // 剩下 20 分钟时再叠 30 分钟 = 50 分钟,一上来就超过上限 45 —— 直接封在顶上
    expect(trail[0]).toBe(45)
    expect(Math.max(...trail)).toBe(45) // 顶在 45 分钟
    expect(trail.at(-1)).toBe(45) // 到顶之后稳定在 45,不会掉
    expect(new Set(trail).size).toBe(1) // 四次全都一样:封顶之后不再涨
    // 防空转:不封顶时会一路涨上去
    const uncapped = createBuffSystem({ defs: [PILL] })
    let open = uncapped.apply([], 'pill', 0).instances
    for (const now of [10 * MIN, 20 * MIN, 30 * MIN, 40 * MIN]) open = uncapped.apply(open, 'pill', now).instances
    expect(open[0]!.endsAt - 40 * MIN).toBeGreaterThan(45 * MIN)
  })

  it('"正好到期"那一刻就算过期:生效与清理共用同一个判据', () => {
    const buffs = createBuffSystem({ defs: [PILL] })
    const instances = buffs.apply([], 'pill', 0).instances
    expect(buffs.has(instances, 'pill', 30 * MIN - 1)).toBe(true)
    expect(buffs.has(instances, 'pill', 30 * MIN)).toBe(false) // 到期那一帧已经不算
    expect(buffs.active(instances, 30 * MIN)).toEqual([])
    expect(buffs.prune(instances, 30 * MIN).removed).toBe(1)
    // 面板读数与判据同源:下一处变化就报在到期时刻
    expect(buffs.nextExpiry(instances, 0)).toEqual({ id: 'pill', at: 30 * MIN, afterSec: 30 * MIN })
  })
})
