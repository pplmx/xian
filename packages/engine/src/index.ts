/**
 * 万象引擎 —— 等级 / 属性 / 装备 / 副本四套系统的可配置内核。
 *
 * 用法一句话:**只写内容(名字与数值),不写机制**。
 * 详细接法见 README 与 `src/presets/`,可跑的例子见 `examples/`。
 */

export type { Numeric } from './numeric'
export { numberNumeric, formatAmount, clamp } from './numeric'

export type { Rng } from './rng'
export { createRng, mulberry32, seedFromString, randomRng } from './rng'

export type {
  AttributeDef,
  AttributeSystem,
  AttributeSystemConfig,
  ComputedStats,
  Mods,
  OnTopMult,
  StatsInput
} from './attributes'
export { attributeDefs, createAttributeSystem, DEFAULT_ATTRIBUTES } from './attributes'

export type {
  BreakthroughResult,
  GrowthCurve,
  ProgressView,
  RealmDef,
  RealmEntry,
  RealmState,
  RealmSystem,
  RealmSystemConfig,
  WorldConfig,
  WorldDef
} from './realms'
export { createRealmSystem, DEFAULT_LAYER_NAMES, progressText } from './realms'

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
} from './equipment'
export { createEquipmentSystem, generateTemplates } from './equipment'

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
} from './dungeons'
export { createDungeonSystem, emptyProgress } from './dungeons'

export type { BattleConfig, BattleEvent, BattleResult, CombatEngine, Combatant } from './combat'
export { createCombatEngine } from './combat'

export type { IdleConfig, IdlePlan } from './idle'
export { planIdle, runIdle } from './idle'

export type { SaveDecodeResult, SaveFormat, SavePayload } from './save'
export { decodeSave, decodeSavePayload, defineSaveFormat, encodeSave, runMigrations } from './save'
export {
  asArray,
  asFiniteNumber,
  asNumberRecord,
  asObjectOrNull,
  asRecord,
  asRecordOf,
  asStringArray
} from './saveShape'

export type { SkillBranchDef, SkillConfig, SkillCostSpec, SkillDef, SkillState, SkillSystem } from './skills'
export { createSkillSystem } from './skills'

export type { DefineOptions, Game, GameConfig, IssueLevel, ValidationIssue } from './config'
export { defineGame, validateGame } from './config'
