/**
 * 图鉴对账 —— 敌人认知的"够门槛了吗"与装备见闻的"各取其高"交给库之后,
 * 与**迁移前冻结的旧实现**逐次相同。
 *
 * 与 engineParity 同一条纪律。两段冻结的都是"写歪了就很难发现"的口径:
 *   一 敌人认知:败绩算三次、首领另有一张门槛表、**一次交手只进一层**(不能一夜跳两级);
 *   二 装备见闻:品质与层级**各取其高**("15 阶天品与 20 阶良品谁更好"没有定义),
 *      而"用没用过"只是同一份记录里的一格 —— 后面再见到更差的成色,不会把它抹回去。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLoreStore } from '@/stores/lore'
import { ENEMY_LORE_BOSS_THRESHOLDS, ENEMY_LORE_LOSS_WEIGHT, ENEMY_LORE_MAX, ENEMY_LORE_THRESHOLDS } from './loreThresholds'

const isBoss = (id: string): boolean => id === 'e_wolfking' // 首领另有一张门槛表(用真实敌人 id)

// —— 迁移前冻结的旧口径(原 core/loreService.noteEnemy 与 stores/lore 的两段)——
function refNoteEnemy(
  seen: Record<string, number>,
  stage: Record<string, number>,
  id: string,
  win: boolean
): { seen: Record<string, number>; stage: Record<string, number>; advanced: boolean } {
  const marked = { ...seen, [id]: (seen[id] ?? 0) + (win ? 1 : ENEMY_LORE_LOSS_WEIGHT) }
  const cur = stage[id] ?? 0
  if (cur >= ENEMY_LORE_MAX) return { seen: marked, stage, advanced: false }
  const need = (isBoss(id) ? ENEMY_LORE_BOSS_THRESHOLDS : ENEMY_LORE_THRESHOLDS)[cur + 1]!
  if (marked[id]! < need) return { seen: marked, stage, advanced: false }
  return { seen: marked, stage: { ...stage, [id]: cur + 1 }, advanced: true }
}

function refNoteEquipSeen(
  best: Record<string, { q: number; t: number; u: number }>,
  id: string,
  qualityRank: number,
  tier: number
): typeof best {
  const cur = best[id]
  const q = Math.max(0, Math.min(8, Math.floor(qualityRank || 0)))
  const t = Math.max(0, Math.floor(tier || 0))
  if (cur && cur.q >= q && cur.t >= t) return best
  return { ...best, [id]: { q: Math.max(cur?.q ?? 0, q), t: Math.max(cur?.t ?? 0, t), u: cur?.u ?? 0 } }
}

function refNoteEquipUsed(best: Record<string, { q: number; t: number; u: number }>, id: string): typeof best {
  const cur = best[id]
  if (cur?.u) return best
  return { ...best, [id]: { q: cur?.q ?? 0, t: cur?.t ?? 0, u: 1 } }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('图鉴对账 —— 敌人认知与装备见闻', () => {
  it('敌人认知:普通怪与首领各 60 次交手,累计、档位与"是否升档"逐次相同', () => {
    for (const id of ['e_wolf', 'e_wolfking']) {
      const lore = useLoreStore()
      let refSeen: Record<string, number> = {}
      let refStage: Record<string, number> = {}
      // 赢 / 输交替,把"败绩算三次"和"一次只进一层"都逼出来
      for (let i = 0; i < 60; i += 1) {
        const win = i % 3 !== 0
        const ref = refNoteEnemy(refSeen, refStage, id, win)
        refSeen = ref.seen
        refStage = ref.stage

        lore.markEnemySeen(id, win ? 1 : ENEMY_LORE_LOSS_WEIGHT)
        const step = lore.advanceEnemyLoreIfDue(id)

        expect(lore.enemySeenOf(id), `${id} 第 ${i} 次照面`).toBe(refSeen[id])
        expect(lore.enemyLoreOf(id), `${id} 第 ${i} 次认知`).toBe(refStage[id] ?? 0)
        expect(step.advanced).toBe(ref.advanced)
      }
      // 首领三次交手即洞悉(门槛表与普通怪不同);普通怪 60 次也早满了
      expect(lore.enemyLoreOf(id)).toBe(ENEMY_LORE_MAX)
    }
  })

  it('一次交手只进一层 —— 哪怕败绩的权重已经够跨两档', () => {
    const lore = useLoreStore()
    lore.markEnemySeen('e_wolfking', ENEMY_LORE_LOSS_WEIGHT) // 一次败绩 = 3 次,首领会直接跨过前两道门槛
    const step = lore.advanceEnemyLoreIfDue('e_wolfking')
    expect(step.advanced).toBe(true)
    expect(lore.enemyLoreOf('e_wolfking')).toBe(1) // 只进一层,不是直接洞悉
  })

  it('装备见闻:品质与层级各取其高,更差的一件不会抹回去', () => {
    const lore = useLoreStore()
    let ref: Record<string, { q: number; t: number; u: number }> = {}
    const sequence: [string, number, number][] = [
      ['sword', 8, 15],
      ['sword', 3, 20],
      ['sword', 1, 2], // 更差:不该改动
      ['armor', 2, 6],
      ['sword', 8, 21]
    ]
    for (const [id, q, t] of sequence) {
      ref = refNoteEquipSeen(ref, id, q, t)
      lore.noteEquipSeen(id, q, t)
      expect(lore.equipSeen(id), `${id} 见过 (${q}, ${t})`).toEqual(ref[id])
    }
    expect(lore.equipSeen('sword')).toEqual({ q: 8, t: 21, u: 0 })
  })

  it('"用没用过"是同一份记录里的一格:用过之后成色照旧只升不降', () => {
    const lore = useLoreStore()
    let ref: Record<string, { q: number; t: number; u: number }> = {}
    ref = refNoteEquipSeen(ref, 'sword', 5, 9)
    lore.noteEquipSeen('sword', 5, 9)
    ref = refNoteEquipUsed(ref, 'sword')
    lore.noteEquipUsed('sword')
    ref = refNoteEquipSeen(ref, 'sword', 2, 12) // 层级更高 → 记层级;品质仍是 5;u 不丢
    lore.noteEquipSeen('sword', 2, 12)
    expect(lore.equipSeen('sword')).toEqual(ref['sword'])
    expect(lore.equipSeen('sword')).toEqual({ q: 5, t: 12, u: 1 })
  })
})
