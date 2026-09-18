/**
 * 世界记忆对账 —— 区域兴衰的档位与"妖气复聚"的钟交给库之后,与**迁移前冻结的旧实现**逐次相同。
 *
 * 与 engineParity 同一条纪律。这里冻结的是两段容易被"顺手改坏"的逻辑:
 *   一 兴衰档位:两条路(胜场 / 守着多久)取先到、没镇压过就停在混乱、48 小时不打交道回落;
 *   二 复聚的钟:起点取"最后一次打交道"(战斗 / 镇压 / 通关取最晚),且**从没打过交道不算够钟**
 *      (否则新档一开局全世界都该复聚)。
 */
import { describe, expect, it } from 'vitest'
import {
  DECAY_HOURS,
  FLOURISH_HOURS,
  FLOURISH_WINS,
  REVIVE_AFTER_HOURS,
  STABLE_HOURS,
  STABLE_WINS,
  deriveProsperity,
  hoursUntilRevive,
  isRegionRevived,
  regionTouchedAt
} from './worldMemory'

const HOUR = 3600_000

// —— 迁移前冻结的旧口径(原 core/worldMemory.ts 的三段)——
function refDeriveProsperity(input: {
  totalWins: number
  hasSuppressed: boolean
  suppressedAt?: number
  lastActivityAt: number
  now: number
}): 'chaos' | 'stable' | 'flourish' {
  const idleHours = (input.now - input.lastActivityAt) / HOUR
  const heldHours = input.suppressedAt !== undefined ? (input.now - input.suppressedAt) / HOUR : 0
  let prosperity: 'chaos' | 'stable' | 'flourish' = 'chaos'
  if (input.hasSuppressed) {
    const alive = idleHours < DECAY_HOURS
    if (alive && (input.totalWins >= FLOURISH_WINS || heldHours >= FLOURISH_HOURS)) prosperity = 'flourish'
    else if (alive && (input.totalWins >= STABLE_WINS || heldHours >= STABLE_HOURS)) prosperity = 'stable'
  }
  return prosperity
}

function refTouchedAt(a?: number, b?: number, c?: number): number {
  return Math.max(a ?? 0, b ?? 0, c ?? 0)
}

function refRevived(touchedAt: number, now: number): boolean {
  if (touchedAt <= 0) return false
  return (now - touchedAt) / HOUR > REVIVE_AFTER_HOURS
}

describe('世界记忆对账 —— 兴衰档位与复聚的钟', () => {
  it('兴衰档位:胜场 × 守时 × 闲置时长 × 有没有镇压过,全网格逐点相同', () => {
    const now = 1_000_000 * HOUR
    const wins = [0, 29, 30, 79, 80, 200]
    const held = [undefined, 0, 5.9, 6, 23.9, 24, 100]
    const idle = [0, 1, 47.9, 48, 200]
    let compared = 0
    for (const totalWins of wins) {
      for (const heldHours of held) {
        for (const idleHours of idle) {
          for (const hasSuppressed of [true, false]) {
            const input = {
              totalWins,
              hasSuppressed,
              suppressedAt: heldHours === undefined ? undefined : now - heldHours * HOUR,
              lastActivityAt: now - idleHours * HOUR,
              now
            }
            expect(deriveProsperity(input).prosperity, `${totalWins}/${heldHours}/${idleHours}/${hasSuppressed}`).toBe(
              refDeriveProsperity(input)
            )
            compared += 1
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(400) // 对账不是空转
  })

  it('复聚的钟:起点取最晚,且从没打过交道不算够钟', () => {
    const now = 500 * HOUR
    const cases: [number | undefined, number | undefined, number | undefined][] = [
      [now - 73 * HOUR, undefined, undefined],
      [now - 100 * HOUR, now - 10 * HOUR, undefined], // 镇压把它拉回来了
      [undefined, undefined, now - 71 * HOUR],
      [undefined, undefined, undefined], // 从没打过交道
      [0, 0, 0]
    ]
    for (const [a, b, c] of cases) {
      const touched = regionTouchedAt(a, b, c)
      expect(touched).toBe(refTouchedAt(a, b, c))
      expect(isRegionRevived(touched, now), `${a}/${b}/${c}`).toBe(refRevived(refTouchedAt(a, b, c), now))
    }
  })

  it('倒计时:与复聚同一个阈值(不另立一份口径)', () => {
    const now = 500 * HOUR
    for (const elapsedHours of [0, 1, 71.9, 72, 100]) {
      const suppressedAt = now - elapsedHours * HOUR
      expect(hoursUntilRevive(suppressedAt, now)).toBeCloseTo(
        Math.max(0, REVIVE_AFTER_HOURS - (now - suppressedAt) / HOUR),
        6
      )
    }
    expect(hoursUntilRevive(undefined, now)).toBe(0)
  })

  it('档位自带的产出系数:混乱 1.0 / 稳定 1.05 / 繁盛 1.1(与旧口径一致)', () => {
    const now = 500 * HOUR
    // 只走"胜场"这一路(守时为 0),于是档位只由胜场决定
    const input = (wins: number) => ({
      totalWins: wins,
      hasSuppressed: true,
      suppressedAt: now,
      lastActivityAt: now,
      now
    })
    expect(deriveProsperity(input(0)).prosperity).toBe('chaos')
    expect(deriveProsperity(input(STABLE_WINS)).prosperity).toBe('stable')
    expect(deriveProsperity(input(FLOURISH_WINS)).prosperity).toBe('flourish')
  })
})
