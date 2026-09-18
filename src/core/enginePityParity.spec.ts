/**
 * 软保底对账 —— "见得多了认得出来"那条曲线搬进库之后,概率逐点相同。
 *
 * 与 engineParity 同一条纪律:下面 `legacy*` 是**迁移前那两条公式的原样冻结**
 * (`core/loreService` 的 `discernChance` / `natureChance`),与现在的实现(走库的
 * `softChance`)在整个网格上逐点比 —— 概率是一位都不能飘的东西:它直接决定
 * "看了多少眼才认得出一味药",而玩家感受到的是"这游戏是不是在卡我"。
 *
 * 另钉住两条口径(它们是搬进库的理由,不是副作用):
 *   · **涨幅封顶**:不封顶的话后期概率会被抬到 1,"越看越眼熟"就变成了"第 N 次必认出";
 *   · **概率有上下限**:最难的那一味也有 4% 的一线(见得多总有认出来的一天),
 *     最容易的也封在 90%(别把认知变成走过场)。
 */
import { describe, expect, it } from 'vitest'
import { discernChance, natureChance, SEEN_FOR_NATURE } from './loreService'

/** 迁移前的辨识概率(冻结) */
function legacyDiscern(rank: number, discernLevel: number, seen: number): number {
  const base = 0.2 + discernLevel / 260 - (rank - 1) * 0.018
  const familiarity = Math.min(0.35, seen * 0.03)
  return Math.max(0.04, Math.min(0.9, base + familiarity))
}

/** 迁移前的药性概率(冻结) */
function legacyNature(rank: number, discernLevel: number, craftLevel: number, seen: number): number {
  if (seen < SEEN_FOR_NATURE) return 0
  const base = 0.1 + discernLevel / 500 + craftLevel / 300 - (rank - 1) * 0.015
  const familiarity = Math.min(0.25, (seen - SEEN_FOR_NATURE) * 0.02)
  return Math.max(0.02, Math.min(0.75, base + familiarity))
}

describe('软保底对账 —— 逐点相同', () => {
  it('辨识概率:三档阶位 × 三档技艺 × 六档照面次数,逐点等于冻结口径', () => {
    for (const rank of [1, 3, 9]) {
      for (const level of [0, 40, 100]) {
        for (const seen of [0, 1, 5, 12, 40, 999]) {
          expect(discernChance(rank, level, seen), `rank${rank}/lv${level}/seen${seen}`).toBe(
            legacyDiscern(rank, level, seen)
          )
        }
      }
    }
  })

  it('药性概率:门槛前后与涨满之后都逐点相同', () => {
    for (const rank of [1, 5, 9]) {
      for (const discern of [0, 50, 100]) {
        for (const craft of [0, 30, 100]) {
          for (const seen of [0, SEEN_FOR_NATURE - 1, SEEN_FOR_NATURE, SEEN_FOR_NATURE + 3, SEEN_FOR_NATURE + 99]) {
            expect(natureChance(rank, discern, craft, seen), `rank${rank}/${discern}/${craft}/seen${seen}`).toBe(
              legacyNature(rank, discern, craft, seen)
            )
          }
        }
      }
    }
  })

  it('涨幅封顶:照面再多,也只涨到"加满"为止(不会变成第 N 次必认出)', () => {
    const capped = discernChance(9, 0, 999)
    expect(capped).toBe(discernChance(9, 0, 100)) // 早就加满了
    expect(capped).toBeLessThan(1)
    expect(legacyDiscern(9, 0, 999)).toBe(capped)
  })

  it('上下限:最难的一味也留 4% 的一线,最容易的封在 90%', () => {
    expect(discernChance(99, 0, 0)).toBeCloseTo(0.04, 12)
    expect(discernChance(1, 100000, 999)).toBeCloseTo(0.9, 12)
    expect(natureChance(99, 0, 0, SEEN_FOR_NATURE)).toBeCloseTo(0.02, 12)
    expect(natureChance(1, 100000, 100000, 999)).toBeCloseTo(0.75, 12)
  })

  it('门槛之前恒为 0:药性不是"看得多自然就懂",得先过了那道门', () => {
    expect(natureChance(1, 999, 999, SEEN_FOR_NATURE - 1)).toBe(0)
    expect(natureChance(1, 999, 999, SEEN_FOR_NATURE)).toBeGreaterThan(0)
  })
})
