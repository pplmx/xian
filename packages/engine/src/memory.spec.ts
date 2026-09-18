import { describe, expect, it } from 'vitest'
import { createStageMemory, type StageSpec } from './memory.js'

/** 本作的口径:混乱 → 稳定 → 繁盛,两路门槛(胜场 / 守着多久),48 小时不打交道回落 */
const STAGES: StageSpec[] = [
  { id: 'chaos', name: '混乱' },
  { id: 'stable', name: '稳定', at: { count: 30, hours: 6 }, mult: 1.05 },
  { id: 'flourish', name: '繁盛', at: { count: 80, hours: 24 }, mult: 1.1 }
]

const memory = createStageMemory({ stages: STAGES, decayAfterHours: 48 })

describe('世界记忆的档位', () => {
  it('多路门槛取先到:打赢过多少场,或守着多久,任一路够就算', () => {
    expect(memory.stateOf({ count: 0, hours: 0 }).id).toBe('chaos')
    expect(memory.stateOf({ count: 30, hours: 0 }).id).toBe('stable') // 打赢 30 场
    expect(memory.stateOf({ count: 0, hours: 6 }).id).toBe('stable') // 或守满 6 小时
    expect(memory.stateOf({ count: 80, hours: 0 }).id).toBe('flourish')
    expect(memory.stateOf({ count: 0, hours: 24 }).id).toBe('flourish')
    // 高档优先:两条路都够"稳定"时,看的是能不能再上"繁盛"
    expect(memory.stateOf({ count: 35, hours: 30 }).id).toBe('flourish')
    expect(memory.stateOf({ count: 35, hours: 5 }).id).toBe('stable')
  })

  it('没资格就停在最低档(没镇压过的地界谈不上安定)', () => {
    expect(memory.stateOf({ count: 999, hours: 999, eligible: false }).id).toBe('chaos')
    expect(memory.stateOf({ count: 999, hours: 999, eligible: true }).id).toBe('flourish')
  })

  it('会回落:太久不打交道退回最低档,并标出"这是回落不是没干过"', () => {
    const alive = memory.stateOf({ count: 80, hours: 0, idleHours: 47 })
    expect(alive.id).toBe('flourish')
    expect(alive.decayed).toBe(false)
    const decayed = memory.stateOf({ count: 80, hours: 0, idleHours: 48 })
    expect(decayed.id).toBe('chaos')
    expect(decayed.decayed).toBe(true)
  })

  it('不配回落时限就只增不减(别的题材可能不想让它掉)', () => {
    const permanent = createStageMemory({ stages: STAGES })
    expect(permanent.stateOf({ count: 80, idleHours: 999 }).id).toBe('flourish')
  })

  it('钟的起点 = 最后一次打交道(几路时间取最晚);从没打过交道返回 0', () => {
    expect(memory.touchedAt(100, 300, 200)).toBe(300)
    expect(memory.touchedAt(undefined, 5, undefined)).toBe(5)
    expect(memory.touchedAt()).toBe(0)
  })

  it('期限与倒计时:从没打过交道的不算够钟,过期的倒计时给 0', () => {
    const HOUR = 3600_000
    const now = 100 * HOUR
    // 3 天前打过一次 → 超过 72 小时 → 该复聚了
    expect(memory.idleBeyond(memory.touchedAt(now - 73 * HOUR), now, 72)).toBe(true)
    expect(memory.idleBeyond(memory.touchedAt(now - 71 * HOUR), now, 72)).toBe(false)
    // 从没打过交道:不算"够钟"(否则新档一开局全世界都该复聚)
    expect(memory.idleBeyond(0, now, 72)).toBe(false)
    // 倒计时:还剩多少小时,过期给 0
    expect(memory.hoursUntil(now - 60 * HOUR, now, 72)).toBeCloseTo(12, 6)
    expect(memory.hoursUntil(now - 100 * HOUR, now, 72)).toBe(0)
    expect(memory.hoursBetween(now, now - 5 * HOUR)).toBe(0) // 负的时间按 0 算
  })

  it('档位自带的系数随档位走(产出微调直接读它)', () => {
    expect(memory.stateOf({ count: 0 }).mult).toBe(1)
    expect(memory.stateOf({ count: 30 }).mult).toBeCloseTo(1.05, 10)
    expect(memory.stateOf({ count: 80 }).mult).toBeCloseTo(1.1, 10)
  })

  it('空档位表是配置错误,当场报错而不是悄悄返回空', () => {
    expect(() => createStageMemory({ stages: [] })).toThrow(/档位/)
  })
})
