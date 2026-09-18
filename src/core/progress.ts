/**
 * 进度服务 —— 计数器 / 成就 / 主线任务 / 每日任务 / 奖励发放
 * 所有系统通过 track() 汇报行为,由此统一驱动成就与任务
 */
import type { AchvCond, CounterKey, RewardBundle } from '@/types'
import { gte } from '@/utils/gnum'
import { todayStr } from '@/utils/time'
import { ACHIEVEMENTS } from '@/data/achievements'
import { DAILY_TASKS, MAIN_QUESTS } from '@/data/quests'
import { LIFESPAN_CRITICAL_RATIO } from '@/data/constants'
import { titleDef } from '@/data/titles'
import { pillDef } from '@/data/pills'
import { stoneByTier } from './formulas'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useUiStore } from '@/stores/ui'
import type { CollectionCategory } from '@/stores/quests'
import type { GoalCond, GoalEnv } from '@engine/index'
import { evalGoal } from '@engine/index'

/**
 * 本作的条件 → 库的条件。
 *
 * `custom` 里的 `realm_<大阶>_<小阶>` 是本作"修到某一层"的写法,翻成库的位阶型;
 * 其余自定义键(寿元、灵石这类状态)在库里仍是"交给作品判"。
 */
export function toGoalCond(cond: AchvCond): GoalCond | null {
  switch (cond.type) {
    case 'counter':
      return { type: 'counter', key: cond.key, value: cond.value }
    case 'realm':
      return { type: 'position', major: cond.major }
    case 'quality':
      return null
    case 'custom': {
      const m = /^realm_(\d+)_(\d+)$/.exec(cond.key)
      if (m) return { type: 'position', major: Number(m[1]), sub: Number(m[2]) }
      return { type: 'custom', key: cond.key }
    }
  }
}

/**
 * 本作的环境:计数、境界、自定义键 —— 库向这里提问,而不是自己去翻存档。
 *
 * `custom` 目前一律返回 false:本作还没有"一次性外部事实"型的条件键;
 * 等哪天真有(如"是否已渡过某劫"),从这里接上即可,判据那边一行不用改。
 */
export function goalEnv(): GoalEnv {
  const quests = useQuestsStore()
  const player = usePlayerStore()
  return {
    counter: key => quests.counter(key as CounterKey),
    level: () => player.major,
    subLevel: () => player.sub,
    custom: () => false
  }
}

/** 玩家当前所处的等效掉落层级 */
export function playerTier(): number {
  const player = usePlayerStore()
  return Math.min(20, player.major * 2 + 1 + (player.sub >= 5 ? 1 : 0))
}

export function grantReward(bundle: RewardBundle, quiet = false): string[] {
  const resources = useResourcesStore()
  const quests = useQuestsStore()
  const inventory = useInventoryStore()
  const ui = useUiStore()
  const lines: string[] = []
  if (bundle.stoneTier) {
    const v = stoneByTier(playerTier(), bundle.stoneTier)
    resources.addStone(v)
    lines.push('灵石')
  }
  if (bundle.wudao) {
    resources.addSmall('wudao', bundle.wudao)
    lines.push(`悟道点×${bundle.wudao}`)
  }
  if (bundle.herb) {
    resources.addSmall('herb', bundle.herb)
    lines.push(`灵草×${bundle.herb}`)
  }
  if (bundle.ore) {
    resources.addSmall('ore', bundle.ore)
    lines.push(`玄铁×${bundle.ore}`)
  }
  if (bundle.page) {
    resources.addSmall('page', bundle.page)
    lines.push(`残页×${bundle.page}`)
  }
  if (bundle.dust) {
    resources.addSmall('dust', bundle.dust)
    lines.push(`器灵尘×${bundle.dust}`)
  }
  if (bundle.pillId && pillDef(bundle.pillId)) {
    inventory.addPill(bundle.pillId, 1)
    lines.push(`丹药「${pillDef(bundle.pillId)!.name}」`)
  }
  if (bundle.titleId && titleDef(bundle.titleId)) {
    if (quests.ownTitle(bundle.titleId)) {
      lines.push(`称号「${titleDef(bundle.titleId)!.name}」`)
      if (!quiet) ui.toast(`获得称号「${titleDef(bundle.titleId)!.name}」`, 'rare')
    }
  }
  return lines
}

/**
 * 条件是否达成 —— **成就与任务的唯一判据**。
 *
 * 导出是为了让界面上的「进度文案」(见 core/questProgress)读同一份判断:
 * 显示"还差 3 个敌人"与实际能不能领赏,不许各算各的。
 *
 * 比较本身已搬进公共库(见 packages/engine 的 goals.evalGoal):库只认"环境",
 * 不认识本作的存档;本文件负责把本作的计数、境界与自定义键翻成库的三问。
 */
export function evalCond(cond: AchvCond): boolean {
  // 品质成就由 checkQuality 显式触发(不与等级同路),故不走通用判据
  if (cond.type === 'quality') return false
  const goal = toGoalCond(cond)
  return goal !== null && evalGoal(goal, goalEnv())
}

function unlockAchievement(id: string): void {
  const quests = useQuestsStore()
  const ui = useUiStore()
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def || !quests.unlockAchievement(id)) return
  if (def.reward) grantReward(def.reward, true)
  ui.toast(`成就达成「${def.name}」`, 'rare')
}

/** 检查所有可自动判定的成就 */
export function checkAchievements(): void {
  const quests = useQuestsStore()
  for (const def of ACHIEVEMENTS) {
    if (quests.hasAchieved(def.id)) continue
    if (def.cond.type === 'quality') continue
    /**
     * custom 分两种:
     * - `realm_<major>_<sub>`:状态可判,这里直接判(此前被一并跳过,于是这条分支成了死代码,
     *   「炼气圆满」那类成就根本无人解锁);
     * - 其余状态型键(lifespanLow / lifespan10k / stone1m):由 checkStateAchievements 显式触发。
     */
    if (def.cond.type === 'custom' && !/^realm_\d+_\d+$/.test(def.cond.key)) continue
    if (evalCond(def.cond)) unlockAchievement(def.id)
  }
}

/** 品质成就(获得装备时显式调用) */
export function checkQualityAchievement(rank: number): void {
  const quests = useQuestsStore()
  for (const def of ACHIEVEMENTS) {
    if (def.cond.type === 'quality' && !quests.hasAchieved(def.id) && rank >= def.cond.rank) {
      unlockAchievement(def.id)
    }
  }
}

/** 特判成就 */
export function checkCustomAchievement(key: string): void {
  const quests = useQuestsStore()
  for (const def of ACHIEVEMENTS) {
    if (def.cond.type === 'custom' && def.cond.key === key && !quests.hasAchieved(def.id)) {
      unlockAchievement(def.id)
    }
  }
}

/** 周期检查(寿元/灵石等状态型成就) */
export function checkStateAchievements(): void {
  const player = usePlayerStore()
  const resources = useResourcesStore()
  if (player.lifespanRatio <= LIFESPAN_CRITICAL_RATIO && player.lifespanRatio > 0) checkCustomAchievement('lifespanLow')
  if (player.lifespanMax >= 10000) checkCustomAchievement('lifespan10k')
  if (gte(resources.spiritStone, { m: 1, e: 6 })) checkCustomAchievement('stone1m')
}

function checkMainQuest(): void {
  const quests = useQuestsStore()
  const ui = useUiStore()
  let guard = 0
  while (guard < 5) {
    guard += 1
    const current = MAIN_QUESTS[quests.mainIdx]
    if (!current || !evalCond(current.cond)) break
    grantReward(current.reward, true)
    ui.toast(`任务完成「${current.name}」`, 'success')
    quests.advanceMain()
  }
}

function checkDaily(): void {
  const quests = useQuestsStore()
  const ui = useUiStore()
  for (const task of DAILY_TASKS) {
    if (quests.daily.done.includes(task.id)) continue
    if (quests.dailyDelta(task.counterKey) >= task.target) {
      quests.markDailyDone(task.id)
      grantReward(task.reward, true)
      ui.toast(`日课已成「${task.name}」`, 'success')
    }
  }
}

/** 每日重置(引擎在日期变化时调用) */
export function rolloverDailyIfNeeded(): void {
  const quests = useQuestsStore()
  const today = todayStr()
  if (quests.daily.date !== today) {
    quests.rolloverDaily(today)
  }
}

/** 统一行为汇报入口 */
export function track(key: CounterKey, n = 1): void {
  const quests = useQuestsStore()
  quests.inc(key, n)
  checkAchievements()
  checkMainQuest()
  checkDaily()
}

/** 境界成就(突破后调用) */
export function trackRealm(): void {
  const player = usePlayerStore()
  const quests = useQuestsStore()
  for (const def of ACHIEVEMENTS) {
    if (def.cond.type === 'realm' && !quests.hasAchieved(def.id) && player.major >= def.cond.major) {
      unlockAchievement(def.id)
    }
  }
  // 小层也走这里:realm_<major>_<sub> 型成就要在「修至本境圆满」那一刻就解锁
  checkAchievements()
  checkMainQuest()
}

export function collect(category: CollectionCategory, id: string): void {
  useQuestsStore().collect(category, id)
}
