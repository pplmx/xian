/**
 * 万象引擎 —— 等级 / 属性 / 装备 / 副本四套系统的可配置内核。
 *
 * 用法一句话:**只写内容(名字与数值),不写机制**。
 * 详细接法见 README 与 `src/presets/`,可跑的例子见 `examples/`。
 */

export type { Numeric } from './numeric.js'
export { numberNumeric, formatAmount, clamp } from './numeric.js'

export type { Rng } from './rng.js'
export { createRng, mulberry32, seedFromString, randomRng } from './rng.js'

export type {
  AttributeDef,
  AttributeSystem,
  AttributeSystemConfig,
  ComputedStats,
  Mods,
  OnTopMult,
  StatsInput
} from './attributes.js'
export { attributeDefs, createAttributeSystem, DEFAULT_ATTRIBUTES } from './attributes.js'

export type {
  BreakthroughResult,
  GrowthCurve,
  ProgressView,
  RealmBreakthroughConfig,
  RealmCombatConfig,
  RealmDef,
  RealmEntry,
  RealmExpConfig,
  RealmState,
  RealmSystem,
  RealmSystemConfig,
  WorldConfig,
  WorldDef
} from './realms.js'
export { createRealmSystem, DEFAULT_LAYER_NAMES, progressText } from './realms.js'

export type {
  AffixDef,
  AffixLine,
  AffixRoll,
  EquipmentConfig,
  EquipmentInstance,
  EquipmentPowerConfig,
  EquipmentSystem,
  Loadout,
  LoadoutStats,
  QualityDef,
  RerollOptions,
  ResolvedEquipment,
  RollOptions,
  SetDef,
  SlotDef,
  TemplateDef
} from './equipment.js'
export { createEquipmentSystem, generateTemplates } from './equipment.js'

export type {
  DungeonConfig,
  DungeonProgress,
  DungeonSystem,
  Encounter,
  EnemyDef,
  EnemySkillDef,
  EnemySnapshot,
  RegionDef,
  RewardDef,
  VictoryOutcome
} from './dungeons.js'
export { createDungeonSystem, emptyProgress } from './dungeons.js'

export type {
  BattleConfig,
  BattleEvent,
  BattleEventKind,
  BattleFollowupConfig,
  BattleHookContext,
  BattleResult,
  BattleShieldConfig,
  BattleSkillEffectsConfig,
  Combatant,
  CombatEngine,
  CombatKeys,
  DamageContext,
  SkillEffectContext,
  StrikeOptions
} from './combat.js'
export { createCombatEngine } from './combat.js'

export type { IdleConfig, IdlePlan } from './idle.js'
export { planIdle, runIdle } from './idle.js'

export type { SaveDecodeResult, SaveFormat, SavePayload } from './save.js'
export { decodeSave, decodeSavePayload, defineSaveFormat, encodeSave, runMigrations } from './save.js'
export {
  asArray,
  asFiniteNumber,
  asNumberRecord,
  asObjectOrNull,
  asRecord,
  asRecordOf,
  asStringArray
} from './saveShape.js'

export type { SkillBranchDef, SkillConfig, SkillCostSpec, SkillDef, SkillState, SkillSystem } from './skills.js'
export { createSkillSystem } from './skills.js'

export type { CraftFormula, CraftLevers, LeverSpec, OverReachSpec, ProficiencyConfig, StageDef } from './crafting.js'
export { averageLore, composeCraftRate, leverFactor, overReachFactor, proficiencyFromExp, stageNameOf, weightedSkill } from './crafting.js'

export type {
  AppliedEntry,
  Ledger,
  ResourceDef,
  ResourceEntry,
  ResourceSummary,
  ResourceSystem,
  ResourceSystemConfig
} from './resources.js'
export { createResourceSystem } from './resources.js'

export type { TriageConfig, TriageImpact, TriageOutcome, TriageRule, TriageSystem, TriageVerdict } from './triage.js'
export { compareBy, createTriage } from './triage.js'

export type { CycleConfig, CycleContext, CycleEntry, CycleSystem, ScheduledCycle } from './cycles.js'
export { createCycleSystem } from './cycles.js'

export type { ChoiceConfig, ChoiceDef, ChoiceOutcome, ChoiceReceipt, ChoiceSystem } from './choices.js'
export { createChoiceSystem } from './choices.js'

export type { CodexConfig, CodexStage, CodexState, CodexSystem, CodexView } from './codex.js'
export { createCodex } from './codex.js'

export type { StageMemory, StageMemoryConfig, StageMemoryInput, StageMemoryState, StageSpec } from './memory.js'
export { createStageMemory } from './memory.js'

export type { EconomyConfig, EconomyPeriod, EconomyReadings, EconomyVerdict, FlowInput, FlowReading, PeriodReading } from './economy.js'
export { createEconomyReadings } from './economy.js'

export type { IntakeConfig, IntakeResult, IntakeSystem } from './intake.js'
export { createIntake } from './intake.js'

export type { Settlement, SettlementPlan, SettlementReceipt } from './settlement.js'
export { createSettlement } from './settlement.js'

export type { DropEntry, DropHit, DropOptions, DropTable } from './drops.js'
export { createDropTable } from './drops.js'

export type {
  BuffApply,
  BuffChange,
  BuffConfig,
  BuffDef,
  BuffInstance,
  BuffStacking,
  BuffSystem,
  BuffView
} from './buffs.js'
export { createBuffSystem } from './buffs.js'

export type {
  FacilityCost,
  FacilityDef,
  FacilitySystem,
  LevelMap,
  UpgradeInfo
} from './facilities.js'
export { accrue, createFacilitySystem } from './facilities.js'

export type {
  InvestInfo,
  InvestOutcome,
  PointBranch,
  PointCost,
  PointPool,
  PointState,
  PointsConfig,
  SwitchInfo,
  SwitchOutcome
} from './points.js'
export { createPointPool } from './points.js'

export type {
  ClaimOutcome,
  SettleResult,
  TaskBoard,
  TaskBoardState,
  TaskProgress,
  TaskSpec
} from './tasks.js'
export { createTaskBoard } from './tasks.js'

export type { CounterMap } from './counters.js'
export { deltaOf, deltaSince, snapshotOf } from './counters.js'

export type { Chain, ChainAdvance, ChainConfig, ChainNode, ChainState } from './chain.js'
export { createChain } from './chain.js'

export type { PityConfig, PityCounter, PityRoll, PityState, SoftPity } from './pity.js'
export { createPityCounter, softChance } from './pity.js'

export type { AddFailure, Holding, HoldingConfig, HoldingItem, HoldingSystem, SlotMap } from './holding.js'
export { createHoldingSystem } from './holding.js'

export type { GoalCond, GoalEnv, GoalProgress } from './goals.js'
export { evalGoal, goalProgress } from './goals.js'

export type { DeckContext, DeckEntry, DrawOptions, LevelBand } from './deck.js'
export type { DrawManyOptions } from './deck.js'
export { deckPool, drawFrom, drawMany, entryAllowed, inBand } from './deck.js'

export type { CompanionConfig, CompanionDef, CompanionSystem, TraitDef } from './companions.js'
export { createCompanionSystem } from './companions.js'

export type { DefineOptions, Game, GameConfig, IssueLevel, ValidationIssue } from './config.js'
export { defineGame, validateGame } from './config.js'
