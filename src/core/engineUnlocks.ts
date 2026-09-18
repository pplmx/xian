/**
 * 成就对库的接入 —— 内容(`data/achievements` 的 62 枚)、判据(仍是 `progress.evalCond`)
 * 与奖励都住在本作,库只给"一次性解锁"的登记簿骨架(见 packages/engine 的 unlocks)。
 *
 * 搬过来的是四条口径:只登记一次、一次扫描可解多条且顺序即声明顺序、未达成不登记、
 * **显式解锁同样去重** —— 状态型成就(寿元告急 / 灵石百万)由周期检查反复触发,
 * 少了去重就会每拍发一次奖。
 */
import type { UnlockState } from 'wanxiang-engine'
import { createUnlockRegistry } from 'wanxiang-engine'
import type { AchievementDef } from '@/types'
import { ACHIEVEMENTS } from '@/data/achievements'

const DEF_BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]))

const ACHIEVEMENTS_REGISTRY = createUnlockRegistry({
  entries: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name }))
})

/** 存档里的成就表 → 库的状态 */
export function achievementStateOf(achieved: readonly string[]): UnlockState {
  return { unlocked: achieved }
}

/** 库的状态 → 存档里的成就表 */
export function achievementIdsOf(state: UnlockState): string[] {
  return [...state.unlocked]
}

/** 显式解锁一枚(品质型 / 状态型 / 境界型由各自的动作声明)—— 已解开则 `unlocked: false` */
export function unlockAchievementById(
  state: UnlockState,
  id: string
): { state: UnlockState; unlocked: boolean; def: AchievementDef | null } {
  const out = ACHIEVEMENTS_REGISTRY.unlock(state, id)
  return { state: out.state, unlocked: out.unlocked, def: out.entry ? (DEF_BY_ID.get(out.entry.id) ?? null) : null }
}

/** 扫一遍:挑出"达成了且还没解开"的(顺序即 ACHIEVEMENTS 顺序),判据由调用方给 */
export function scanAchievements(
  state: UnlockState,
  ok: (def: AchievementDef) => boolean
): { state: UnlockState; newly: AchievementDef[] } {
  const out = ACHIEVEMENTS_REGISTRY.scan(state, entry => {
    const def = DEF_BY_ID.get(entry.id)
    return def !== undefined && ok(def)
  })
  const newly: AchievementDef[] = []
  for (const entry of out.newly) {
    const def = DEF_BY_ID.get(entry.id)
    if (def) newly.push(def)
  }
  return { state: out.state, newly }
}

/** 已解开几枚 / 一共几枚(界面读数;认不出的旧数据不计入总数差) */
export function achievementCounts(state: UnlockState): { done: number; total: number; remaining: number } {
  return {
    done: ACHIEVEMENTS_REGISTRY.count(state),
    total: ACHIEVEMENTS.length,
    remaining: ACHIEVEMENTS_REGISTRY.remaining(state)
  }
}
