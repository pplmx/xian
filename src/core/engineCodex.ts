/**
 * 图鉴 / 见闻 —— 本作对库的"图鉴层"那份定制。
 *
 * 库里只认结构与规则(档位只增不减、一次照面只进一层、各维度取高),
 * 下面这些是**本作的口径**:分几档、每档叫什么、门槛多少、谁算首领。
 */
import { createCodex } from 'wanxiang-engine'
import { enemyDef } from '@/data/enemies'
import { ENEMY_LORE_BOSS_THRESHOLDS, ENEMY_LORE_STAGE_NAMES, ENEMY_LORE_THRESHOLDS } from './loreThresholds'

const stagesFrom = (thresholds: readonly number[]): { name: string; at: number }[] =>
  thresholds.map((at, i) => ({ name: ENEMY_LORE_STAGE_NAMES[i] ?? `第 ${i} 层`, at }))

const NORMAL_STAGES = stagesFrom(ENEMY_LORE_THRESHOLDS)
const BOSS_STAGES = stagesFrom(ENEMY_LORE_BOSS_THRESHOLDS)

const ENEMY_CODEX = createCodex({
  stages: NORMAL_STAGES,
  // 见一次首领不容易,故它的门槛另有一张表
  stagesOf: id => (enemyDef(id)?.isBoss ? BOSS_STAGES : undefined)
})

/**
 * 照面次数已记在别处(store 里)时的升档判定:只判不记。
 * 本作走这条 —— "计数归 store、判定归库",两边的口径各自只有一处。
 */
export function codexAdvanceEnemyLoreIfDue(
  seen: Record<string, number>,
  stage: Record<string, number>,
  enemyId: string
): { advanced: boolean; stageIndex: number; stageName: string; stage: Record<string, number> } {
  const result = ENEMY_CODEX.check({ seen, stage, best: {} }, enemyId)
  return { advanced: result.advanced, stageIndex: result.stage, stageName: result.name, stage: result.state.stage }
}

/** 敌人认知的读数(界面上"还差几次"用它) */
export function enemyLoreView(seen: Record<string, number>, stage: Record<string, number>, enemyId: string) {
  return ENEMY_CODEX.view({ seen, stage, best: {} }, enemyId)
}

/**
 * 见过一件装备:品质与层级**各取其高**("15 阶天品与 20 阶良品谁更好"没有定义),
 * "用没用过"只是同一份记录里的一格。与当前是否还持有无关 —— 化了尘也是见过。
 */
export function rememberEquip(
  best: Record<string, { q: number; t: number; u: number }>,
  templateId: string,
  candidate: { q?: number; t?: number; u?: number }
): { best: Record<string, { q: number; t: number; u: number }>; improved: boolean } {
  const merged = ENEMY_CODEX.rememberBest({ seen: {}, stage: {}, best: best as Record<string, Record<string, number>> }, templateId, {
    q: candidate.q ?? 0,
    t: candidate.t ?? 0,
    u: candidate.u ?? 0
  })
  // 逐字段取高的结果里,三个键一定都在(缺失的按 0 补齐),故这里可以安全地断言回本作的形状
  const out: Record<string, { q: number; t: number; u: number }> = {}
  for (const [id, row] of Object.entries(merged.state.best)) {
    out[id] = { q: row.q ?? 0, t: row.t ?? 0, u: row.u ?? 0 }
  }
  return { best: out, improved: merged.improved }
}
