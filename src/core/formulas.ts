/**
 * GameFormula —— 成长曲线公式的入口。
 *
 * 其中四条已经搬进公共库(见 core/engineWorld):
 *   · expRequirement      → 库的 realms.expCost
 *   · baseCombatStats     → 库的 realms.baseStats
 *   · breakthroughBaseRate → 库的 realms.breakthroughRate
 * (isWorldStepLayer 一并撤了:除了 expRequirement 自己,再没有别人问过它 ——
 *  这条判据现在归库的 realms.isWorldStep,见 engineWorld 的配置。)
 *
 * 曲线的实现从此只有一处;这里保留同名转发,故调用方一行都不用改。
 * 「搬过去数字不变」由 src/core/engineParity.spec.ts 拿**迁移前冻结的旧口径**逐条对账
 * —— 那条判据不 import 本文件,免得拿自己证明自己。
 *
 * 其余公式(修为/秒、灵气、成本、天劫、战力评分)仍住在这里:那些是本作的平衡参数,
 * 不是通用的成长骨架。
 */
import type { GNum } from '@/types'
import { gn, gnMin, mulN, powN, mul, add } from '@/utils/gnum'
import {
  COMBAT_SUB_GROWTH,
  CULT_BASE_SPEED,
  CULT_MAJOR_SPEED_GROWTH,
  CULT_SUB_SPEED_GROWTH,
  ENEMY_GEAR_BASE,
  ENEMY_GEAR_GROWTH,
  LATE_CULT_SPEED_GROWTH,
  LATE_QI_CAP_GROWTH,
  LATE_QI_REGEN_GROWTH,
  QI_BASE_CAP,
  QI_BASE_REGEN,
  QI_CAP_MAJOR_GROWTH,
  QI_CAP_SUB_GROWTH,
  QI_REGEN_MAJOR_GROWTH,
  STONE_DROP_BASE,
  STONE_TIER_GROWTH,
  TRIBULATION_DIFFICULTY_CAP_MAJOR,
  TRIB_WAVE_BASE,
  TRIB_WAVE_MAJOR,
  TRIB_WAVE_STEP,
  BT_MAX_RATE,
  BT_MIN_RATE,
  DAO_FRUIT_PER_MAJOR,
  BUILDING_COST_GROWTH,
  GONGFA_UP_GROWTH,
  GONGFA_UP_WUDAO_BASE,
  UPGRADE_DUST_BASE,
  UPGRADE_DUST_GROWTH,
  UPGRADE_STONE_TIER_BASE
} from '@/data/constants'
import { earlyLate, majorCombatFactor } from './tierScale'
import { ENGINE_WORLD } from './engineWorld'

/**
 * 层级映射与战力曲线住在 core/tierScale(依赖方向:formulas → engineWorld → tierScale),
 * 这里原样转出 —— 调用方照旧 `import { powerScale } from '@/core/formulas'`。
 */
export { majorCombatFactor, powerScale, tierMajor, worldNameOfTier } from './tierScale'

/** 境界曲线因子(玩家自身基础属性) */
export function realmScale(major: number, sub: number): GNum {
  return mul(majorCombatFactor(major), powN(COMBAT_SUB_GROWTH, sub))
}

/** 突破所需修为 —— 实现已搬进公共库的等级系统,此处转发 */
export function expRequirement(major: number, sub: number): GNum {
  return ENGINE_WORLD.realms.expCost(major, sub)
}

/** 基础修为/秒(未计任何倍率) */
export function baseCultPerSec(major: number, sub: number): number {
  const { early, late } = earlyLate(major)
  return (
    CULT_BASE_SPEED *
    Math.pow(CULT_MAJOR_SPEED_GROWTH, early) *
    Math.pow(LATE_CULT_SPEED_GROWTH, late) *
    Math.pow(CULT_SUB_SPEED_GROWTH, sub)
  )
}

/** 灵气上限 */
export function qiCap(major: number, sub: number): number {
  const { early, late } = earlyLate(major)
  return Math.floor(
    QI_BASE_CAP *
      Math.pow(QI_CAP_MAJOR_GROWTH, early) *
      Math.pow(LATE_QI_CAP_GROWTH, late) *
      Math.pow(QI_CAP_SUB_GROWTH, sub)
  )
}

/** 灵气恢复/秒(未计倍率) */
export function baseQiRegen(major: number): number {
  const { early, late } = earlyLate(major)
  return QI_BASE_REGEN * Math.pow(QI_REGEN_MAJOR_GROWTH, early) * Math.pow(LATE_QI_REGEN_GROWTH, late)
}

/** 玩家基础战斗三维 —— 实现已搬进公共库的等级系统,此处转发 */
export function baseCombatStats(major: number, sub: number): { attack: GNum; defense: GNum; maxHp: GNum } {
  const stats = ENGINE_WORLD.realms.baseStats(major, sub)
  return { attack: stats.attack!, defense: stats.defense!, maxHp: stats.maxHp! }
}

/** 战力评分 */
export function powerScore(attack: GNum, defense: GNum, maxHp: GNum): GNum {
  return add(add(mulN(attack, 3), mulN(defense, 2)), mulN(maxHp, 0.15))
}

/** 突破基础成功率(未计加成)—— 实现已搬进公共库的等级系统,此处转发 */
export function breakthroughBaseRate(major: number, sub: number): number {
  return ENGINE_WORLD.realms.breakthroughRate(major, sub)
}

export function clampRate(rate: number): number {
  return Math.max(BT_MIN_RATE, Math.min(BT_MAX_RATE, rate))
}

/** 灵石掉落基准(战斗/事件按层级换算) */
export function stoneByTier(tier: number, amount: number): GNum {
  return mulN(powN(STONE_TIER_GROWTH, Math.max(0, tier - 1)), STONE_DROP_BASE * amount * 0.1)
}

/**
 * 即时修为的**唯一结算口径**:等效闭关时长 → 修为,封顶在「不满一层」。
 *
 *   修为 = min(修速 × 等效秒数, 当前一层需求 × 层上限)
 *
 * 三条来源(丹药 / 一场遭遇 / 一次际遇)都走这一个函数,在线与离线也走它 ——
 * 从前每一处各写一遍「需求 × 百分比」,于是每一处都随境界指数膨胀(见 constants
 * 里 BATTLE_EXP_SECS 的那段读数),而修速词条反倒只管得到挂机那一条线。
 *
 * 离线 N 场:把秒数与层上限一并乘 N(`secs × N` / `layerCap × N`)——
 * 上限随场数线性放大,故「N 场」恒等于「N 次单场」,离线不会偷跑也不会被吃掉。
 */
export function expFromSecs(expReq: GNum, secs: number, cultPerSec: number, layerCap: number): GNum {
  return gnMin(mulN(gn(cultPerSec), secs), mulN(expReq, layerCap))
}

/** 建筑升级灵石成本 */
export function buildingCost(costBase: number, level: number): GNum {
  return mulN(powN(BUILDING_COST_GROWTH, level), costBase)
}

/** 功法升级悟道点成本 */
export function gongfaUpCost(qualityRank: number, level: number): number {
  return Math.ceil(GONGFA_UP_WUDAO_BASE * (1 + qualityRank * 0.6) * Math.pow(GONGFA_UP_GROWTH, level))
}

/** 装备强化成本 */
export function upgradeCost(level: number, tier: number, qualityRank: number, discount: number): { dust: number; stone: GNum } {
  const factor = Math.max(0.4, 1 - discount)
  return {
    dust: Math.ceil(UPGRADE_DUST_BASE * Math.pow(UPGRADE_DUST_GROWTH, level) * (1 + qualityRank * 0.3) * factor),
    stone: mulN(stoneByTier(tier, UPGRADE_STONE_TIER_BASE), (1 + level * 0.5) * factor)
  }
}

/** 离线收益估算辅助:胜率与战力比的映射 */
export function winChanceFromRatio(r: number): number {
  if (r <= 0) return 0.05
  const chance = 1 / (1 + Math.pow(0.85 / r, 4))
  return Math.max(0.05, Math.min(0.95, chance))
}

/**
 * 天劫单波伤害占玩家最大生命比例。
 *
 * 式子 = (TRIB_WAVE_BASE + TRIB_WAVE_MAJOR×境界 + TRIB_WAVE_STEP×第几道) × (1 − 抗性)
 *        ↑ 三个系数收在 data/constants(Phase 39 由 0.15 / 0.02 / 0.03 上调 3%)
 *        ↑ 跨界那一境(9/14/18)的加难不在这条式子里,它走「不认三维折算」那条规则
 */
export function tribulationWaveDamage(targetMajor: number, wave: number, resist: number): number {
  // 境界项封顶(见 constants:难度口径只为 major ≤ 8 设,减伤有绝对上限)
  const m = Math.min(targetMajor, TRIBULATION_DIFFICULTY_CAP_MAJOR)
  const base = TRIB_WAVE_BASE + m * TRIB_WAVE_MAJOR + wave * TRIB_WAVE_STEP
  return Math.max(0.04, base * (1 - resist))
}

/** 敌人装备补偿系数:随层级指数跟随玩家装备成长(Phase 33.2 去封顶) */
export function enemyGearFactor(tier: number): number {
  return ENEMY_GEAR_BASE * Math.pow(ENEMY_GEAR_GROWTH, Math.max(0, tier - 1))
}

/** 转世凝结的道果数 */
export function daoFruitGain(major: number, sub: number): number {
  let total = 0
  for (let i = 0; i <= major; i += 1) total += (i + 1) * DAO_FRUIT_PER_MAJOR
  return total + Math.floor(sub / 3)
}

export { gn }
