/**
 * 副本系统 —— 区域链 / 敌人 / 遭遇排布 / 首领门槛 / 通关与奖励。
 *
 * ## 一图一关,前置通关才开下一图
 *
 * 副本的最小骨架是**一条链**:区域带层级与推荐等级,`requireCleared` 指向前一区域。
 * 解锁 = 等级够(等级系统给)+ 前置已通(本系统给)。
 *
 * ## 首领不是"抽到的那一次",而是攒出来的那一次
 *
 * 普通遭遇按权重出怪;每赢一场攒一点首领进度,攒满必出首领。
 * 于是"刷图"有了可预期的倒计时,而不是"运气好才见得到首领"。
 * 通关 = 击败首领(且只记第一次),之后该图仍在链上,可以回头刷。
 *
 * ## 掉落是配置,不是散落在结算里的数字
 *
 * 每次胜利固定给一份(修为/货币),再按 `dropChance` 掷掉落。
 * 引擎只负责"给了什么、给了多少",至于这些资源叫什么、怎么花,那是游戏自己的事。
 */
import type { Mods } from './attributes'
import type { Numeric } from './numeric'
import { numberNumeric } from './numeric'
import type { Rng } from './rng'

export interface EnemySkillDef {
  name: string
  /** 伤害倍率 */
  mult: number
  /** 触发概率 */
  rate: number
  /** 机制标记:stun / drain / pierce / multi / bleed 之类,由战斗系统解释 */
  effect?: string
  desc?: string
}

export interface EnemyDef {
  id: string
  name: string
  /** 层级:决定数值量级 */
  tier: number
  icon?: string
  desc?: string
  hpMult: number
  atkMult: number
  defMult: number
  speed: number
  skills?: EnemySkillDef[]
  boss?: boolean
  /** 敌人自带词条(闪避/减伤/回复……用于流派克制) */
  mods?: Mods
  /** 机制家族标记,玩法层可自行解释 */
  archetype?: string
  tags?: string[]
}

export interface RewardDef {
  id: string
  name?: string
  /** 基础数量 */
  base: number
  /** 每层级倍率:amount = base × tierGrowth^(tier-1) */
  tierGrowth?: number
  /** 概率(省略 = 必给) */
  chance?: number
}

export interface RegionDef {
  id: string
  name: string
  desc?: string
  icon?: string
  /** 层级,与装备层级同一把尺子 */
  tier: number
  /** 推荐等级(等级系统里的大境界序号) */
  minRealm: number
  danger?: number
  /** 普通遭遇池(敌人 id) */
  enemies: string[]
  /** 首领(敌人 id) */
  boss: string
  /** 前置区域(击败其首领后解锁) */
  requireCleared?: string
  eventTags?: string[]
  /** 该图专属奖励(叠加在通用奖励上) */
  rewards?: RewardDef[]
}

export interface DungeonConfig {
  regions: RegionDef[]
  enemies: EnemyDef[]
  /** 击败 N 次普通遭遇后必出首领,默认 8 */
  bossProgress?: number
  /** 敌人数值基数与层级曲线 */
  enemyPower?: { baseHp: number; baseAttack: number; baseDefense: number; tierGrowth: number; tierFactors?: number[] }
  /** 每场胜利的通用奖励 */
  victoryRewards?: RewardDef[]
  /** 是否需要前置通关才解锁(默认 true) */
  requireChain?: boolean
}

export interface DungeonProgress {
  cleared: string[]
  /** 区域 → 已击败的普通遭遇次数 */
  bossWins: Record<string, number>
  /** 区域 → 巡回场次(统计用) */
  runs: Record<string, number>
}

export interface Encounter {
  regionId: string
  kind: 'normal' | 'boss'
  enemyId: string
}

export interface VictoryOutcome<T> {
  progress: DungeonProgress
  rewards: { id: string; name?: string; amount: T }[]
  /** 这一次是否首次通关该区域 */
  firstClear: boolean
  encounter: Encounter
}

export interface EnemySnapshot<T> {
  id: string
  name: string
  hp: T
  attack: T
  defense: T
  speed: number
  mods: Mods
  skills: EnemySkillDef[]
  boss: boolean
  tier: number
}

export interface DungeonSystem<T = number> {
  readonly regions: readonly RegionDef[]
  readonly enemies: readonly EnemyDef[]
  region(id: string): RegionDef | undefined
  enemy(id: string): EnemyDef | undefined
  /** 主线链的第一个区域 */
  firstRegion(): RegionDef
  /** 按前置关系排出的主线顺序 */
  chain(): RegionDef[]
  isUnlocked(regionId: string, progress: DungeonProgress, major: number): boolean
  unlocked(progress: DungeonProgress, major: number): RegionDef[]
  /** 该区域当前攒了多少首领进度,以及还差几次 */
  bossProgress(regionId: string, progress: DungeonProgress): { wins: number; need: number }
  nextEncounter(regionId: string, progress: DungeonProgress, rng: Rng): Encounter
  onVictory(regionId: string, encounter: Encounter, progress: DungeonProgress, rng: Rng): VictoryOutcome<T>
  /** 敌人快照(数值已按层级放大) */
  snapshot(enemyId: string): EnemySnapshot<T>
}

export function emptyProgress(): DungeonProgress {
  return { cleared: [], bossWins: {}, runs: {} }
}

export function createDungeonSystem<T = number>(
  config: DungeonConfig,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
): DungeonSystem<T> {
  const regions = [...config.regions]
  const enemies = [...config.enemies]
  const regionById = new Map(regions.map(r => [r.id, r]))
  const enemyById = new Map(enemies.map(e => [e.id, e]))
  const bossGoal = config.bossProgress ?? 8
  const requireChain = config.requireChain ?? true
  const power = config.enemyPower ?? { baseHp: 150, baseAttack: 12, baseDefense: 7, tierGrowth: 1.9 }

  const firstRegion = (): RegionDef => {
    const head = regions.find(r => r.requireCleared === undefined || !regionById.has(r.requireCleared))
    return head ?? regions[0]!
  }

  const chain = (): RegionDef[] => {
    const byRequirement = new Map<string, RegionDef[]>()
    for (const r of regions) {
      const key = r.requireCleared ?? ''
      const list = byRequirement.get(key)
      if (list) list.push(r)
      else byRequirement.set(key, [r])
    }
    const out: RegionDef[] = []
    const start = firstRegion()
    const visit = (r: RegionDef, guard: number): void => {
      if (guard > regions.length + 1) return
      out.push(r)
      for (const next of byRequirement.get(r.id) ?? []) visit(next, guard + 1)
    }
    visit(start, 0)
    for (const r of regions) if (!out.includes(r)) out.push(r)
    return out
  }

  const isUnlocked = (regionId: string, progress: DungeonProgress, major: number): boolean => {
    const region = regionById.get(regionId)
    if (!region) return false
    if (major < region.minRealm) return false
    if (!requireChain || region.requireCleared === undefined) return true
    return progress.cleared.includes(region.requireCleared)
  }

  const unlocked = (progress: DungeonProgress, major: number): RegionDef[] =>
    chain().filter(r => isUnlocked(r.id, progress, major))

  const bossProgress = (regionId: string, progress: DungeonProgress): { wins: number; need: number } => {
    const wins = progress.bossWins[regionId] ?? 0
    return { wins: wins % bossGoal, need: bossGoal - (wins % bossGoal) }
  }

  const nextEncounter = (regionId: string, progress: DungeonProgress, rng: Rng): Encounter => {
    const region = regionById.get(regionId)
    if (!region) throw new Error(`副本系统:没有这个区域 —— ${regionId}`)
    const { need } = bossProgress(regionId, progress)
    if (need <= 1 || region.enemies.length === 0) return { regionId, kind: 'boss', enemyId: region.boss }
    const pool = region.enemies.filter(id => enemyById.has(id))
    return { regionId, kind: 'normal', enemyId: pool.length > 0 ? rng.weighted(pool, () => 1) : region.boss }
  }

  const rewardAmount = (reward: RewardDef, tier: number): T => {
    const growth = reward.tierGrowth ?? 1
    return numeric.mulN(numeric.from(reward.base), growth ** Math.max(0, tier - 1))
  }

  const onVictory = (
    regionId: string,
    encounter: Encounter,
    progress: DungeonProgress,
    rng: Rng
  ): VictoryOutcome<T> => {
    const region = regionById.get(regionId)
    if (!region) throw new Error(`副本系统:没有这个区域 —— ${regionId}`)
    const rewards: { id: string; name?: string; amount: T }[] = []
    const merge = (def: RewardDef): void => {
      if (def.chance !== undefined && !rng.chance(def.chance)) return
      const amount = rewardAmount(def, region.tier)
      const exist = rewards.find(r => r.id === def.id)
      if (exist) exist.amount = numeric.add(exist.amount, amount)
      else rewards.push({ id: def.id, name: def.name, amount })
    }
    for (const def of config.victoryRewards ?? []) merge(def)
    for (const def of region.rewards ?? []) merge(def)

    // 首领倒下即重新计数:下一轮首领要再攒满一次,而不是"见过一次之后次次见"
    const wins = encounter.kind === 'boss' ? 0 : (progress.bossWins[regionId] ?? 0) + 1
    const runs = { ...progress.runs, [regionId]: (progress.runs[regionId] ?? 0) + 1 }
    let cleared = progress.cleared
    let firstClear = false
    if (encounter.kind === 'boss' && !cleared.includes(regionId)) {
      cleared = [...cleared, regionId]
      firstClear = true
    }
    return {
      progress: { cleared, bossWins: { ...progress.bossWins, [regionId]: wins }, runs },
      rewards,
      firstClear,
      encounter
    }
  }

  const snapshot = (enemyId: string): EnemySnapshot<T> => {
    const def = enemyById.get(enemyId)
    if (!def) throw new Error(`副本系统:没有这个敌人 —— ${enemyId}`)
    const factor = power.tierFactors?.[def.tier - 1] ?? power.tierGrowth ** Math.max(0, def.tier - 1)
    return {
      id: def.id,
      name: def.name,
      hp: numeric.mulN(numeric.from(power.baseHp * def.hpMult), factor),
      attack: numeric.mulN(numeric.from(power.baseAttack * def.atkMult), factor),
      defense: numeric.mulN(numeric.from(power.baseDefense * def.defMult), factor),
      speed: def.speed,
      mods: { ...(def.mods ?? {}) },
      skills: [...(def.skills ?? [])],
      boss: def.boss === true,
      tier: def.tier
    }
  }

  return {
    regions,
    enemies,
    region: id => regionById.get(id),
    enemy: id => enemyById.get(id),
    firstRegion,
    chain,
    isUnlocked,
    unlocked,
    bossProgress,
    nextEncounter,
    onVictory,
    snapshot
  }
}
