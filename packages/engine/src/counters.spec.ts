import { describe, expect, it } from 'vitest'
import { deltaOf, deltaSince, snapshotOf } from './counters.js'

describe('基准快照 —— 同一份计数器同时回答"生涯"与"这一段"', () => {
  it('打快照:原样记一份,入参不动', () => {
    const counters = { kills: 1000, minutes: 120 }
    const snapshot = snapshotOf(counters)
    expect(snapshot).toEqual(counters)
    expect(snapshot).not.toBe(counters)
    counters.kills = 1007
    expect(snapshot.kills).toBe(1000) // 快照是死数据,不会被后来的增长带走
  })

  it('这一段 = 当前 − 基准;计数器本身仍是生涯累计', () => {
    const base = snapshotOf({ kills: 1000 })
    const counters = { kills: 1007 }
    expect(deltaSince(base, counters, 'kills')).toBe(7)
    expect(counters.kills).toBe(1007) // 没有"清零"这回事
  })

  it('增量夹到 ≥ 0:回档 / 倒挂不给负进度', () => {
    expect(deltaOf(500, 480)).toBe(0)
    expect(deltaSince({ kills: 500 }, { kills: 480 }, 'kills')).toBe(0)
    expect(deltaOf(500, 500)).toBe(0)
    expect(deltaOf(0, 12.5)).toBeCloseTo(12.5, 12)
  })

  it('缺基准按 0 起算(上一期还没这个计数器 ≠ 这一段已经做完)', () => {
    expect(deltaSince({}, { minutes: 5 }, 'minutes')).toBe(5)
    expect(deltaSince({ kills: 3 }, {}, 'kills')).toBe(0)
    expect(deltaSince({}, {}, '根本没有的键')).toBe(0)
  })

  it('坏值当 0:NaN 不该渗进进度', () => {
    expect(snapshotOf({ kills: Number.NaN }).kills).toBe(0)
    expect(deltaOf(Number.NaN, 10)).toBe(10)
    expect(deltaOf(10, Number.NaN)).toBe(0)
    expect(deltaSince({ kills: Number.NaN }, { kills: 10 }, 'kills')).toBe(10)
    expect(Number.isFinite(deltaSince({ kills: 10 }, { kills: Number.NaN }, 'kills'))).toBe(true)
  })

  it('非计数器(分支数 / 雪耻数这类整数)用同一个 deltaOf,规则一致', () => {
    expect(deltaOf(2, 5)).toBe(3)
    expect(deltaOf(5, 2)).toBe(0)
  })
})
