import { describe, expect, it } from 'vitest'
import type { TaskBoardState } from './tasks.js'
import { createTaskBoard } from './tasks.js'

const board = createTaskBoard({
  tasks: [
    { id: 'kill', name: '斩妖', counter: 'kills', target: 15 },
    { id: 'study', name: '自习', counter: 'minutes', target: 30 },
    { id: 'walk', name: '散步', counter: 'steps', target: 6000 }
  ]
})

const state = (patch: Partial<TaskBoardState> = {}): TaskBoardState => ({
  period: '2026-09-19',
  base: {},
  claimed: [],
  ...patch
})

const counters = (patch: Record<string, number> = {}): Record<string, number> => ({ kills: 0, minutes: 0, steps: 0, ...patch })

describe('周期任务板 —— 进度靠增量,不靠清零', () => {
  it('本期进度 = 当前 − 期初基准:生涯计数器不用动', () => {
    const s = state({ base: { kills: 1000, minutes: 120 } })
    const now = counters({ kills: 1007, minutes: 130 })
    expect(board.deltaOf(s, now, 'kills')).toBe(7)
    expect(board.progressOf(s, now, 'kill')).toMatchObject({ delta: 7, progress: 7, done: false })
    // 计数器本身仍是生涯累计(1007),换期不清零 —— 生涯成就照旧能算
    expect(now.kills).toBe(1007)
  })

  it('达标:进度封在目标值,够不够看原始增量', () => {
    const s = state({ base: { kills: 0 } })
    const row = board.progressOf(s, counters({ kills: 40 }), 'kill')!
    expect(row.progress).toBe(15) // 界面不显示 40/15
    expect(row.delta).toBe(40)
    expect(row.done).toBe(true)
    expect(row.claimed).toBe(false)
  })

  it('换期:把那一刻的计数器记成新基准,并清空领取记录', () => {
    const before = state({ base: { kills: 0 }, claimed: ['kill'] })
    const next = board.rollover(before, counters({ kills: 500, minutes: 60 }), '2026-09-20')
    expect(next).toEqual({ period: '2026-09-20', base: { kills: 500, minutes: 60, steps: 0 }, claimed: [] })
    expect(before.claimed).toEqual(['kill']) // 入参不动
  })

  it('换期**幂等**:同一期再叫一次,一点都不许改(否则当天已攒的进度会被吞)', () => {
    const s = state({ base: { kills: 500 }, claimed: ['kill'] })
    const again = board.rollover(s, counters({ kills: 900 }), '2026-09-19')
    expect(again).toBe(s) // 连引用都不换
    expect(again.base.kills).toBe(500)
    expect(again.claimed).toEqual(['kill'])
  })

  it('增量夹到 ≥ 0:回档 / 坏档让"当前 < 基准"时,不给负进度', () => {
    const s = state({ base: { kills: 500 } })
    expect(board.deltaOf(s, counters({ kills: 480 }), 'kills')).toBe(0)
    expect(board.progressOf(s, counters({ kills: 480 }), 'kill')).toMatchObject({ delta: 0, progress: 0, done: false })
    // 缺基准按 0 起算(昨天没有这个计数器,不等于"今天已经做完了")
    expect(board.deltaOf(state(), counters({ minutes: 5 }), 'minutes')).toBe(5)
    expect(board.deltaOf(state(), {}, '根本没有的计数器')).toBe(0)
  })

  it('自动结算:一次把"达成且没领过"的都挑出来,顺序即声明顺序', () => {
    const s = state()
    const now = counters({ kills: 20, steps: 9000 })
    const out = board.settle(s, now)
    expect(out.settled.map(row => row.task.id)).toEqual(['kill', 'walk'])
    expect(out.state.claimed).toEqual(['kill', 'walk'])
    // 再结算一次:没有新的可领
    const again = board.settle(out.state, now)
    expect(again.settled).toEqual([])
    expect(again.state).toBe(out.state)
  })

  it('没达标的不会被结算,达标但已领过的也不会', () => {
    const s = state({ claimed: ['kill'] })
    const out = board.settle(s, counters({ kills: 100, minutes: 30 }))
    expect(out.settled.map(row => row.task.id)).toEqual(['study'])
  })

  it('手动领取与自动结算共用一份记录:两条路一起用也不会重复给', () => {
    const now = counters({ kills: 20 })
    const manual = board.claim(state(), now, 'kill')
    expect(manual.ok).toBe(true)
    expect(manual.state.claimed).toEqual(['kill'])
    // 再点一次:已经领过
    expect(board.claim(manual.state, now, 'kill')).toMatchObject({ ok: false, reason: 'claimed' })
    // 自动结算也不会再把它挑出来
    expect(board.settle(manual.state, now).settled).toEqual([])
  })

  it('领取的三种未成:认不出的任务 / 已领过 / 还没达成', () => {
    expect(board.claim(state(), counters(), '没有这条')).toMatchObject({ ok: false, reason: 'unknown', task: null })
    expect(board.claim(state({ claimed: ['kill'] }), counters({ kills: 99 }), 'kill')).toMatchObject({
      ok: false,
      reason: 'claimed'
    })
    const unfinished = board.claim(state(), counters({ kills: 3 }), 'kill')
    expect(unfinished).toMatchObject({ ok: false, reason: 'unfinished' })
    expect(unfinished.task).toEqual({ id: 'kill', name: '斩妖', counter: 'kills', target: 15 })
  })

  it('整块任务板:一条一行,顺序即声明顺序(界面直接用)', () => {
    const rows = board.board(state(), counters({ minutes: 45 }))
    expect(rows.map(row => [row.task.id, row.progress, row.done])).toEqual([
      ['kill', 0, false],
      ['study', 30, true],
      ['walk', 0, false]
    ])
  })

  it('坏计数器当 0,且不把 NaN 传出去', () => {
    expect(board.deltaOf(state({ base: { kills: 10 } }), counters({ kills: Number.NaN }), 'kills')).toBe(0)
    const row = board.progressOf(state(), counters({ seconds: Number.NaN }), 'kill')
    expect(row).not.toBeNull()
    expect(Number.isFinite(row!.delta)).toBe(true)
  })

  it('纯函数:入参状态不动,返回的是新对象', () => {
    const before = state()
    const snapshot = JSON.stringify(before)
    const out = board.settle(before, counters({ kills: 20 }))
    board.claim(before, counters({ kills: 20 }), 'kill')
    board.rollover(before, counters({ kills: 20 }), '2026-10-01')
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(out.state).not.toBe(before)
  })
})
