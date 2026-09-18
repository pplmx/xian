/**
 * 属性汇总 —— Base × 装备 × 功法 × 天赋 × Buff × 建筑 = FinalStats
 * 纯函数:输入快照,输出最终属性
 *
 * 「词条怎么合并」这条规则已搬进公共库的属性系统(见 core/engineWorld):
 * mergeMods / mergeModsDetailed / isSoftCapped / modDepth 都是转发。
 * 仍然是**两处非线性**:递减词条按贡献排队打折(1 / 0.75 / 0.5 / 0.25)、
 * 合计越过软阈值后超出部分折算;两道折算都摊回来源,故明细之和恒等于面板值。
 *
 * 留在这里的是本作自己的那部分:道果的另乘、灵根与灵气充盈并入修炼速度 ——
 * 那些是《云隐修仙录》的平衡设计,不是通用规则。
 */
import type { AnyStatKey, FinalStats, GNum, StatMods, StatSourceRow } from '@/types'
import { add, mulN } from '@/utils/gnum'
import {
  DAO_FRUIT_COMBAT_BONUS,
  DAO_FRUIT_CULT_BONUS,
  DAO_FRUIT_SOFT_EXP,
  QI_RICH_BONUS
} from '@/data/constants'
import { baseCombatStats, powerScore } from './formulas'
import { ENGINE_WORLD } from './engineWorld'

export interface StatsInput {
  major: number
  sub: number
  /** 灵根修炼倍率(1.0 为基准) */
  linggenMult: number
  /** 各来源的百分比加成集合(装备/功法/天赋/称号/灵兽/Buff/建筑) */
  modSources: StatMods[]
  /** 各来源的名字(与 modSources 一一对应);漏写的那几个会显示成「来源 N」并被审计点名 */
  sourceNames?: string[]
  /** 装备平铺数值 */
  equipFlats: { attack: GNum; defense: GNum; maxHp: GNum }
  /** 道果数量(转世永久加成) */
  daoFruit: number
  /** 灵气是否充盈(高于半数上限) */
  qiRich: boolean
}

/**
 * 合并多个来源的百分比属性。
 * 普通词条同键相加;条件/触发词条(DIMINISH_KEYS)按来源贡献降序以 100%/75%/50%/25% 递减计入——
 * 同一词条重复堆叠边际递减,混合构筑相对更值(Phase 19.5)
 */
export function mergeMods(sources: StatMods[]): StatMods {
  return ENGINE_WORLD.attributes.mergeMods(sources)
}

/**
 * 与 mergeMods 同一套算法,但额外回答「每一份最终值是谁给的」。
 *
 * 面板要显示来源明细,而合并里有两道非线性:递减词条按来源强弱排队打折、
 * 软阈值再对合计折算。若直接把各来源的原始值列出来,明细之和会对不上面板 ——
 * 这正是「解释了等于没解释」。故这里把两道折算都摊回来源身上:
 * 打折后的那一份记给该来源,软阈值则给所有相关来源同乘一个系数(线性,故仍相加正确)。
 */
export function mergeModsDetailed(sources: StatMods[]): { mods: StatMods; effective: StatMods[] } {
  const { mods, effective } = ENGINE_WORLD.attributes.mergeModsDetailed(sources)
  return { mods, effective }
}

/** 某键是否已进入软阈值递减区(展示层提示用) */
export function isSoftCapped(mods: StatMods, key: AnyStatKey): boolean {
  return ENGINE_WORLD.attributes.isSoftCapped(mods, key)
}

/**
 * 构筑深度:所有正向「构筑词条」的数值总和。
 *
 * 基础三维百分比与修炼速度不计——前者在天界已由 worldFoeSnap 等比抵消,
 * 后者不参与战斗。剩下的暴击、闪避、吸血、反击、护盾等才是构筑的实际厚度
 */
export function modDepth(mods: StatMods): number {
  return ENGINE_WORLD.attributes.modDepth(mods)
}

export function modOf(mods: StatMods, key: AnyStatKey): number {
  return mods[key] ?? 0
}

/** 有效道果:超过一定数量后收益递减,避免多周目变成无限加速器 */
export function effectiveDaoFruit(fruit: number): number {
  if (fruit <= 0) return 0
  return Math.pow(fruit, DAO_FRUIT_SOFT_EXP)
}

export function computeFinalStats(input: StatsInput): FinalStats {
  const { mods, effective } = mergeModsDetailed(input.modSources)
  const base = baseCombatStats(input.major, input.sub)
  const fruit = effectiveDaoFruit(input.daoFruit)
  const combatBonus = fruit * DAO_FRUIT_COMBAT_BONUS

  const attack = mulN(add(base.attack, input.equipFlats.attack), Math.max(0.1, 1 + modOf(mods, 'attackPct') + combatBonus))
  const defense = mulN(add(base.defense, input.equipFlats.defense), Math.max(0.1, 1 + modOf(mods, 'defensePct') + combatBonus))
  const maxHp = mulN(add(base.maxHp, input.equipFlats.maxHp), Math.max(0.1, 1 + modOf(mods, 'maxHpPct') + combatBonus))

  // 修炼速度汇入:灵根倍率 + 道果 + 灵气充盈
  const cultExtra = input.linggenMult - 1 + fruit * DAO_FRUIT_CULT_BONUS + (input.qiRich ? QI_RICH_BONUS : 0)
  mods.cultivationSpeed = Math.max(-0.9, (mods.cultivationSpeed ?? 0) + cultExtra)

  /*
   * 来源明细:两部分 —— 各 mod 源真正计入的那一份(已有两道折算),以及
   * 不走 modSources 的三条(灵根/道果/灵气充盈走修炼,道果另乘攻防血)。
   * 面板据此回答「这个数从哪来」,而审计会核对「明细之和 = 面板值」。
   */
  const breakdown: StatSourceRow[] = input.modSources.map((_, i) => ({
    name: input.sourceNames?.[i] ?? `来源 ${i + 1}`,
    mods: effective[i] ?? {}
  }))
  const linggenExtra = input.linggenMult - 1
  if (linggenExtra !== 0) breakdown.push({ name: '灵根', mods: { cultivationSpeed: linggenExtra } })
  if (fruit > 0) {
    breakdown.push({ name: '道果(修炼)', mods: { cultivationSpeed: fruit * DAO_FRUIT_CULT_BONUS } })
    breakdown.push({
      name: '道果(攻防血)',
      mods: { attackPct: combatBonus, defensePct: combatBonus, maxHpPct: combatBonus },
      onTop: true
    })
  }
  if (input.qiRich) breakdown.push({ name: '灵气充盈', mods: { cultivationSpeed: QI_RICH_BONUS } })

  return { attack, defense, maxHp, power: powerScore(attack, defense, maxHp), mods, breakdown }
}
