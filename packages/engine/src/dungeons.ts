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
import type { Mods } from './attributes.js'
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'
import type { Rng } from './rng.js'

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
  /**
   * 自己接管数额(**可选**):给了它,base/tierGrowth 忽略(概率仍然生效)。
   * 奖励曲线想按"层级 + 别的什么"算时用它。
   */
  amount?: (tier: number) => number
  /** 基础数量;给了 `amount` 时可以不写 */
  base?: number
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
  /**
   * 前置区域:要开这一处,需要先通的那些地方。
   *
   *   字符串     —— 一条前置(最常见,也是原来唯一支持的写法);
   *   字符串数组 —— 多条前置,语义看 `requireMode`(默认全部)。
   *
   * 多条前置是给"两条线都走通才开"这种结构的:主线之外还有支线时,
   * 用一条链硬串会把支线变成"必须顺路",而这里可以表达"两者都要"或"任一条即可"。
   */
  requireCleared?: string | readonly string[]
  /** 多条前置时的语义:默认 `'all'`(全部已通);`'any'` 表示任一已通即可 */
  requireMode?: 'all' | 'any'
  eventTags?: string[]
  /** 该图专属奖励(叠加在通用奖励上) */
  rewards?: RewardDef[]
}

export interface DungeonConfig {
  regions: RegionDef[]
  enemies: EnemyDef[]
  /** 击败 N 次普通遭遇后必出首领,默认 8 */
  bossProgress?: number
  /**
   * 首领节奏 —— 两款游戏在这件事上真的不同,故写成配置:
   *
   *   `cycle`(默认):每 N 胜出一次首领,打完重新计数,首领可以反复出现
   *                  (适合"刷本打 BOSS"的循环玩法);
   *   `once`       :攒到 N 胜出一次首领,击败即通关,此后不再出
   *                  (适合"一图一关、通关开下一图"的推进玩法)。
   */
  bossRhythm?: 'cycle' | 'once'
  /** 敌人数值基数与层级曲线 */
  enemyPower?: {
    baseHp: number
    baseAttack: number
    baseDefense: number
    tierGrowth: number
    /** 直接给出每一层的缩放系数(第 i 项 = 层级 i+1) */
    tierFactors?: number[]
    /**
     * 自己接管层级系数(**可选**):给了它就完全接管(返回该层的缩放倍数),
     * 便于"分层档不按同一条指数走"的作品 —— 与装备那边的 tierFactors 是同一个思路。
     */
    scaleFn?: (tier: number) => number
  }
  /** 每场胜利的通用奖励 */
  victoryRewards?: RewardDef[]
  /** 是否需要前置通关才解锁(默认 true) */
  requireChain?: boolean
  /**
   * 自己接管"这一场遇到什么"(**可选**)。
   *
   * 默认只有两种节奏:攒够 N 胜出首领(循环)或攒够一次、通关即止。
   * 想按时间/强度/剧情阶段给不同遭遇(前几场必是杂兵、某阶段必出首领、
   * 或按进度挑特定敌人),用这个钩子:
   *
   *   返回 `null` 就交回默认逻辑(调用方可以只在特定条件下接管);
   *   返回 `{ kind: 'normal' }` 时不指定 enemyId 即从该区域的普通池里按均等权重挑一个
   *   (与默认逻辑同一处实现);`{ kind: 'boss' }` 同理。
   */
  encounterFn?: (
    ctx: {
      region: RegionDef
      progress: DungeonProgress
      /** 默认逻辑此刻会不会出首领(攒够胜场 / 一次性已通) */
      bossDue: boolean
      /** 该区域的普通遭遇池(已滤掉不存在的敌人;可能为空) */
      pool: readonly string[]
    },
    rng: Rng
  ) => { kind: 'normal' | 'boss'; enemyId?: string } | null
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
  /**
   * 本值表 —— 与 `Combatant.stats` 同形,可直接喂给战斗引擎。
   *
   * 键名是引擎的接口词(attack/defense/hp/speed);想用自己的叫法,
   * 在 `BattleConfig.keys` 里指过去即可(见 combat)。
   */
  stats: Record<string, T>
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
  /** 该区域当前攒了多少首领进度,以及还差几次;need 为 null = 此地已无首领 */
  bossProgress(regionId: string, progress: DungeonProgress): { wins: number; need: number | null }
  /**
   * 距区域之主还差几胜 —— 界面提示与战斗判定共用这一处。
   *
   * @returns null = 此地已无首领(once 节奏下已通关);0 = 下一战即是首领
   */
  winsUntilBoss(wins: number, cleared?: boolean): number | null
  /**
   * 前置补票 —— **不看等级**,凡"前置已通"的都该开。
   *
   * 这是读档修形用的不变量,不是解锁判据(解锁判据见 isUnlocked):
   * 扩界之后新加的一段地界,若它的前置早在这份存档里通过,那一处就该开着 ——
   * 否则旧存档会永久卡在"需先击败某某"上。
   */
  prereqClosure(unlocked: readonly string[], cleared: readonly string[]): string[]
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
  const rhythm = config.bossRhythm ?? 'cycle'
  const requireChain = config.requireChain ?? true
  const power = config.enemyPower ?? { baseHp: 150, baseAttack: 12, baseDefense: 7, tierGrowth: 1.9 }

  /** 某区域的前置列表(字符串与数组两种写法都收成一个数组) */
  const prereqsOf = (region: RegionDef): readonly string[] =>
    region.requireCleared === undefined ? [] : typeof region.requireCleared === 'string' ? [region.requireCleared] : region.requireCleared

  /** 前置是否已满足(多条时按 requireMode:默认全部) */
  const prereqMet = (region: RegionDef, beaten: ReadonlySet<string>): boolean => {
    const prereqs = prereqsOf(region)
    if (prereqs.length === 0) return true
    return region.requireMode === 'any' ? prereqs.some(id => beaten.has(id)) : prereqs.every(id => beaten.has(id))
  }

  const firstRegion = (): RegionDef => {
    // 没有前置的,或前置指向了不认识的 id(内容被挪过) —— 都当作可作起点
    const head = regions.find(r => prereqsOf(r).every(id => !regionById.has(id)))
    return head ?? regions[0]!
  }

  const chain = (): RegionDef[] => {
    // 排序:按"被谁当作前置"建图,从起点出发做深度优先(多条前置时认第一条作为顺序依据)
    const byRequirement = new Map<string, RegionDef[]>()
    for (const r of regions) {
      const key = prereqsOf(r)[0] ?? ''
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
    if (!requireChain) return true
    return prereqMet(region, new Set(progress.cleared))
  }

  const unlocked = (progress: DungeonProgress, major: number): RegionDef[] =>
    chain().filter(r => isUnlocked(r.id, progress, major))

  const winsUntilBoss = (wins: number, cleared = false): number | null => {
    // 只有 once 节奏才"通关即再无首领":cycle 是刷本循环,通关不改变节奏
    if (rhythm === 'once') return cleared ? null : Math.max(0, bossGoal - wins)
    return bossGoal - (wins % bossGoal)
  }

  const bossProgress = (regionId: string, progress: DungeonProgress): { wins: number; need: number | null } => {
    const wins = progress.bossWins[regionId] ?? 0
    return { wins, need: winsUntilBoss(wins, progress.cleared.includes(regionId)) }
  }

  const prereqClosure = (unlocked: readonly string[], cleared: readonly string[]): string[] => {
    const out = [...unlocked]
    const have = new Set(out)
    const beaten = new Set(cleared)
    for (const region of chain()) {
      if (have.has(region.id) || prereqsOf(region).length === 0) continue
      if (!prereqMet(region, beaten)) continue
      have.add(region.id)
      out.push(region.id)
    }
    return out
  }

  const nextEncounter = (regionId: string, progress: DungeonProgress, rng: Rng): Encounter => {
    const region = regionById.get(regionId)
    if (!region) throw new Error(`副本系统:没有这个区域 —— ${regionId}`)
    const remaining = winsUntilBoss(progress.bossWins[regionId] ?? 0, progress.cleared.includes(regionId))
    const due = rhythm === 'once' ? remaining === 0 : remaining !== null && remaining <= 1
    const pool = region.enemies.filter(id => enemyById.has(id))
    const defaultChoice = (): Encounter => {
      if (due || pool.length === 0) return { regionId, kind: 'boss', enemyId: region.boss }
      return { regionId, kind: 'normal', enemyId: rng.weighted(pool, () => 1) }
    }
    if (config.encounterFn) {
      const choice = config.encounterFn({ region, progress, bossDue: due, pool }, rng)
      if (choice) {
        if (choice.enemyId !== undefined) return { regionId, kind: choice.kind, enemyId: choice.enemyId }
        if (choice.kind === 'boss') return { regionId, kind: 'boss', enemyId: region.boss }
        if (pool.length > 0) return { regionId, kind: 'normal', enemyId: rng.weighted(pool, () => 1) }
      }
    }
    return defaultChoice()
  }

  const rewardAmount = (reward: RewardDef, tier: number): T => {
    if (reward.amount) return numeric.from(reward.amount(tier))
    const growth = reward.tierGrowth ?? 1
    return numeric.mulN(numeric.from(reward.base ?? 0), growth ** Math.max(0, tier - 1))
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
    const factor = power.scaleFn
      ? power.scaleFn(def.tier)
      : power.tierFactors?.[def.tier - 1] ?? power.tierGrowth ** Math.max(0, def.tier - 1)
    return {
      id: def.id,
      name: def.name,
      stats: {
        hp: numeric.mulN(numeric.from(power.baseHp * def.hpMult), factor),
        maxHp: numeric.mulN(numeric.from(power.baseHp * def.hpMult), factor),
        attack: numeric.mulN(numeric.from(power.baseAttack * def.atkMult), factor),
        defense: numeric.mulN(numeric.from(power.baseDefense * def.defMult), factor),
        speed: numeric.from(def.speed)
      },
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
    winsUntilBoss,
    prereqClosure,
    nextEncounter,
    onVictory,
    snapshot
  }
}
