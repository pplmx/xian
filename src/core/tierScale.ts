/**
 * 层级与境界的映射、以及战力曲线 —— 装备、敌人数值共用的一把尺子。
 *
 * 这一处从 core/formulas 里搬出来,是为了断开一个环:
 * formulas 现在要经公共库算曲线(见 core/engineWorld),而库装配装备时需要
 * 「层级 → 战力系数」这张表;表留在 formulas 里就成了 formulas 与 engineWorld 互引。
 * 搬出来之后依赖是单向的:formulas → engineWorld → tierScale。
 *
 * 公式一字未改,只是换了住处。
 */
import type { GNum } from '@/types'
import { mul, powN } from '@/utils/gnum'
import { COMBAT_MAJOR_GROWTH, COMBAT_SUB_GROWTH, LATE_COMBAT_GROWTH } from '@/data/constants'
import { WORLD_BREAK_MAJOR, worldOf } from '@/data/realms'

/**
 * 区域层级 → 对应大境界(与 regions.ts 设计同步)。
 * 1-20 对应人间界 0-8;21 起每层一个新境界,依次覆盖仙界/神界/混沌海。
 */
const TIER_MAJOR = [
  0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
] as const
/** 区域层级 → 大境界内的小层位置 */
const TIER_SUB = [1, 4, 1, 4, 7, 2, 6, 1, 4, 8, 2, 7, 2, 7, 2, 7, 2, 7, 2, 7, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] as const

export function tierMajor(tier: number): number {
  return TIER_MAJOR[Math.max(0, Math.min(TIER_MAJOR.length - 1, tier - 1))]!
}

/**
 * 该区域层级属于哪一界域 —— 「这件东西是哪一界出的」只有这一处口径。
 * 装备详情与图鉴都用它,不再各自 tierMajor + worldOf 拼一遍。
 */
export function worldNameOfTier(tier: number): string {
  return worldOf(tierMajor(tier)).name
}

/**
 * 大境界 → 成长指数(把 major 拆成「人间界内」与「跨界之后」两段)。
 * 人间界沿用旧曲线,跨界后用平坦的 LATE_* 曲线(见 constants 注释)。
 */
export function earlyLate(major: number): { early: number; late: number } {
  const early = Math.min(Math.max(0, major), WORLD_BREAK_MAJOR)
  return { early, late: Math.max(0, major - early) }
}

/** 大境界基础战力因子:realmScale 与 powerScale 共用,保证玩家与内容永不脱节 */
export function majorCombatFactor(major: number): GNum {
  const { early, late } = earlyLate(major)
  return mul(powN(COMBAT_MAJOR_GROWTH, early), powN(LATE_COMBAT_GROWTH, late))
}

/** 战力曲线因子:装备数值与敌人数值都基于它,永远与玩家境界曲线对齐 */
export function powerScale(tier: number): GNum {
  const m = tierMajor(tier)
  const s = TIER_SUB[Math.max(0, Math.min(TIER_SUB.length - 1, tier - 1))]!
  return mul(majorCombatFactor(m), powN(COMBAT_SUB_GROWTH, s))
}
