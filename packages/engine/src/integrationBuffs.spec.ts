/**
 * 组合验收(第三条链)—— **状态 × 投资点 × 任务**在同一条时间线上不打架。
 *
 * 前两条链分别验"账目自洽"与"时间 × 随机可复现";这条验三件事互相影响时最容易出的四种乱:
 *
 *   一 **到期那一刻的边界**:限时增益"还算不算数"只有一个判据(到期时刻 > 时钟),
 *      所以"先剪过期再算产出"与"先算产出再剪"必须给出**同一个数** —— 判据若看列表长度,
 *      两种顺序就会差一步;
 *   二 **加点只影响之后**:投点提升产量,但**不能回溯**改已经结算过的那几步;
 *   三 **到期不让进度回退**:任务进度只看计数器增量,增益没了只让以后慢下来,不会把进度减回去;
 *   四 **叠加是相乘不是相加**:基础 ×(1 + 增益)×(1 + 加点),三处各管一段。
 *
 * 题材仍与修仙无关:一间"矿场",每小时出货,挂两小时,中间吃一瓶"专注"、投两点"产线"。
 */
import { describe, expect, it } from 'vitest'
import { createBuffSystem } from './buffs.js'
import { createPointPool } from './points.js'
import { createTaskBoard } from './tasks.js'

// ——— 矿场:基础每小时 10 矿 ———
const BASE_PER_HOUR = 10

// ——— 状态:一瓶「专注」,持续 3 小时,产线 ×2 ———
const buffs = createBuffSystem<{ yieldMult: number }>({
  defs: [{ id: 'focus', durationSec: 3 * 3600, kind: 'gain', mods: { yieldMult: 2 } }]
})

// ——— 投资点:总 5 点,「产线」每点 +20%;主位能投 3,副位 1 ———
const points = createPointPool<{ yieldMult: number }, { open: boolean }>({
  branches: [{ id: 'line', effect: invested => ({ yieldMult: 1 + 0.2 * invested }) }],
  total: 5,
  mainCap: 3,
  sideCap: 1,
  blocked: (_state, _id, ctx) => (ctx.open ? undefined : '')
})

// ——— 今日任务:产出 30 矿 ———
const board = createTaskBoard({ tasks: [{ id: 't_ore', name: '今日出货', counter: 'ore', target: 30 }] })

describe('组合验收(状态 × 投资点 × 任务)—— 三件事各管一段', () => {
  /** 一条时间线:每步 1 小时,收益 = 基础 × 增益 × 加点 */
  function mine(opts: { pruneFirst: boolean }) {
    let counters: Record<string, number> = { ore: 0 }
    let list = buffs.apply([], 'focus', 0).instances
    let invested = { points: {} as Record<string, number>, main: null as string | null }
    let day = board.rollover({ period: 'D1', base: {}, claimed: [] }, counters, 'D1')
    const rows: { hour: number; mult: number; ore: number; progress: number }[] = []

    const multAt = (nowSec: number): number => {
      // 增益那一份:问"此刻还算不算数"(与剪枝同一判据),不问列表里有没有
      const gain = buffs.active(list, nowSec)[0]?.def.mods?.yieldMult ?? 1
      // 加点那一份:已投点数决定
      const line = points.effectsOf(invested)[0]?.yieldMult ?? 1
      return gain * line
    }

    const step = (fromSec: number): void => {
      if (opts.pruneFirst) list = buffs.prune(list, fromSec).instances
      const mult = multAt(fromSec)
      const ore = Math.floor(BASE_PER_HOUR * mult) // 每小时一步,零头不涉及(整点)
      if (!opts.pruneFirst) list = buffs.prune(list, fromSec).instances
      counters = { ...counters, ore: (counters.ore ?? 0) + ore }
      day = board.settle(day, counters).state
      const row = board.board(day, counters)[0]!
      rows.push({ hour: fromSec / 3600, mult, ore, progress: row.progress })
    }

    step(0)
    step(3600)
    // 第二小时末投两点「产线」(主位):加点只影响之后的那一步
    invested = points.invest(invested, 'line', { open: true }).state
    invested = points.invest(invested, 'line', { open: true }).state
    step(7200)
    step(10800)
    return { rows, counters, list, invested, day }
  }

  it('到期边界:3 小时的增益覆盖前三步,而"先剪后产"与"先产后剪"一模一样', () => {
    const a = mine({ pruneFirst: true })
    const b = mine({ pruneFirst: false })
    expect(a.rows).toEqual(b.rows) // 判据只看时钟,不看列表 —— 两种顺序同数
    // 前三步有增益(×2),第四步没了(×1);加点从第三步起生效(×1.4)
    expect(a.rows.map(r => r.mult)).toEqual([2, 2, 2.8, 1.4])
    expect(a.rows.map(r => r.ore)).toEqual([20, 20, 28, 14])
  })

  it('加点只影响之后:前两步按旧产线结算,不会被回溯改掉', () => {
    const { rows } = mine({ pruneFirst: true })
    expect(rows[0]!.ore).toBe(20)
    expect(rows[1]!.ore).toBe(20)
    expect(rows[2]!.ore).toBe(28) // 两步之后才投的点:只让之后变快(2 × 1.4 = 2.8 倍)
    expect(rows[3]!.ore).toBe(14)
  })

  it('叠加是相乘不是相加:基础 10 ×(1+100%)×(1+40%)= 28(不是 10+10+4 = 24)', () => {
    const world = mine({ pruneFirst: true })
    // 第三步:增益与加点同时在场 —— 相乘得 28,相加会得 24,两者在这条时间线上能分辨
    expect(world.rows[2]!.ore).toBe(28)
    expect(BASE_PER_HOUR * 2 * 1.4).toBe(28)
    expect(BASE_PER_HOUR * 2 + BASE_PER_HOUR * 0.4).toBe(24)
  })

  it('到期不让进度回退:任务只吃计数器增量,增益没了只是以后慢', () => {
    const { rows } = mine({ pruneFirst: true })
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.progress).toBeGreaterThanOrEqual(rows[i - 1]!.progress)
    }
    expect(rows.at(-1)!.progress).toBe(30) // 20+20+28+14 = 82 → 封在目标 30
  })

  it('判据唯一:任务的"达成"与"能不能结算"出自同一份', () => {
    const counters: Record<string, number> = { ore: 30 }
    const day = board.rollover({ period: 'D1', base: {}, claimed: [] }, counters, 'D1')
    const row = board.board(day, counters)[0]!
    expect(row.done).toBe(true)
    expect(board.settle(day, counters).settled.map(x => x.task.id)).toEqual(['t_ore'])
    // 已结算之后:读数说"领过了",再结算也不会重复发
    const after = board.settle(day, counters).state
    expect(board.board(after, counters)[0]!.claimed).toBe(true)
    expect(board.settle(after, counters).settled).toEqual([])
  })

  it('增益到期的读数也对得上:下一次状态变化就是那一刻', () => {
    const list = buffs.apply([], 'focus', 0).instances
    expect(buffs.nextExpiry(list, 0)).toEqual({ id: 'focus', at: 10800, afterSec: 10800 })
    expect(buffs.has(list, 'focus', 10799)).toBe(true)
    expect(buffs.has(list, 'focus', 10800)).toBe(false) // 正好到期那一刻就不算数了
    expect(buffs.remainingSec(list, 'focus', 10800)).toBe(0)
  })
})
