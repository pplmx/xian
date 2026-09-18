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
  BattleResult,
  Combatant,
  CombatEngine,
  CombatKeys,
  DamageContext,
  SkillEffectContext
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

export type { GoalCond, GoalEnv, GoalProgress } from './goals.js'
export { evalGoal, goalProgress } from './goals.js'

export type { DeckContext, DeckEntry, DrawOptions, LevelBand } from './deck.js'
export type { DrawManyOptions } from './deck.js'
export { deckPool, drawFrom, drawMany, entryAllowed, inBand } from './deck.js'

export type { CompanionConfig, CompanionDef, CompanionSystem, TraitDef } from './companions.js'
export { createCompanionSystem } from './companions.js'

export type { DefineOptions, Game, GameConfig, IssueLevel, ValidationIssue } from './config.js'
export { defineGame, validateGame } from './config.js'
