/**
 * 公开面自检 —— 库的"对外长什么样",这份用例就是它的清单。
 *
 * 为什么值得单独一条:库是给别人用的,**少导出一个类型**这种事在库内部完全看不出来 ——
 * 源码里 `tsc` 全绿、用例全绿,直到使用者想给 `skillEffectFn` 标个参数类型时才发现
 * "这个类型没对外"。反过来,**多导出/误删一个运行时导出**同样是使用者那侧才会发现的事
 * (依赖了又被删掉 = 破坏性变更)。
 *
 * 所以这里钉两件事:
 *   一、运行时导出的名单(下面的 RUNTIME_EXPORTS)必须一字不差 —— 增删都要在这里显式改一次;
 *   二、每个模块的公开类型都能**从公开入口**取到(只 import './index.js',不碰内部模块),
 *       漏一个 `export type` 这条就编译不过。
 */
import { describe, expect, it } from 'vitest'
import * as engine from './index.js'
import type {
  AppliedEntry,
  AffixDef,
  AffixLine,
  AffixRoll,
  AddFailure,
  AttributeDef,
  AttributeSystem,
  AttributeSystemConfig,
  BattleConfig,
  BattleEvent,
  BattleEventKind,
  BattleFollowupConfig,
  BattleHookContext,
  BattleResult,
  BattleShieldConfig,
  BattleSkillEffectsConfig,
  BreakthroughResult,
  Combatant,
  CombatEngine,
  CombatKeys,
  CompanionConfig,
  CompanionDef,
  CompanionSystem,
  ComputedStats,
  CraftFormula,
  CycleConfig,
  CycleContext,
  CycleEntry,
  ChoiceConfig,
  ChoiceDef,
  ChoiceOutcome,
  ChoiceReceipt,
  ChoiceSystem,
  CodexConfig,
  CodexStage,
  CodexState,
  CodexSystem,
  CodexView,
  StageMemory,
  StageMemoryConfig,
  StageMemoryInput,
  StageMemoryState,
  EconomyConfig,
  EconomyPeriod,
  EconomyReadings,
  EconomyVerdict,
  FlowInput,
  FlowReading,
  PeriodReading,
  StageSpec,
  CycleSystem,
  CraftLevers,
  DamageContext,
  DeckContext,
  DeckEntry,
  DefineOptions,
  DrawManyOptions,
  DrawOptions,
  DungeonConfig,
  DungeonProgress,
  DungeonSystem,
  Encounter,
  EnemyDef,
  EnemySkillDef,
  EnemySnapshot,
  EquipmentConfig,
  EquipmentInstance,
  EquipmentPowerConfig,
  EquipmentSystem,
  Game,
  GameConfig,
  GoalCond,
  GoalEnv,
  GoalProgress,
  GrowthCurve,
  Holding,
  HoldingConfig,
  HoldingItem,
  HoldingSystem,
  IdleConfig,
  IdlePlan,
  IssueLevel,
  LeverSpec,
  Ledger,
  LevelBand,
  Loadout,
  LoadoutStats,
  Mods,
  Numeric,
  OnTopMult,
  OverReachSpec,
  ProficiencyConfig,
  ProgressView,
  RerollOptions,
  QualityDef,
  RealmBreakthroughConfig,
  RealmCombatConfig,
  RealmDef,
  RealmEntry,
  RealmExpConfig,
  RealmState,
  RealmSystem,
  RealmSystemConfig,
  RegionDef,
  ResourceDef,
  ResourceEntry,
  ResourceSummary,
  ResourceSystem,
  ResourceSystemConfig,
  ResolvedEquipment,
  RewardDef,
  Rng,
  RollOptions,
  SaveDecodeResult,
  SaveFormat,
  SavePayload,
  SetDef,
  SkillBranchDef,
  SkillConfig,
  SkillCostSpec,
  SkillDef,
  SkillEffectContext,
  SkillState,
  SkillSystem,
  SlotDef,
  ScheduledCycle,
  SlotMap,
  StageDef,
  StatsInput,
  StrikeOptions,
  TemplateDef,
  TriageConfig,
  TriageImpact,
  TriageOutcome,
  TriageRule,
  TriageSystem,
  TriageVerdict,
  TraitDef,
  ValidationIssue,
  VictoryOutcome,
  WorldConfig,
  WorldDef
} from './index.js'

/** 运行时导出清单:改动这里 = 改动对外承诺,所以必须显式改一次 */
const RUNTIME_EXPORTS = [
  'DEFAULT_ATTRIBUTES',
  'DEFAULT_LAYER_NAMES',
  'asArray',
  'asFiniteNumber',
  'asNumberRecord',
  'asObjectOrNull',
  'asRecord',
  'asRecordOf',
  'asStringArray',
  'attributeDefs',
  'averageLore',
  'clamp',
  'composeCraftRate',
  'compareBy',
  'createChoiceSystem',
  'createCodex',
  'createEconomyReadings',
  'createStageMemory',
  'createCycleSystem',
  'createAttributeSystem',
  'createCombatEngine',
  'createCompanionSystem',
  'createDungeonSystem',
  'createEquipmentSystem',
  'createHoldingSystem',
  'createRealmSystem',
  'createResourceSystem',
  'createRng',
  'createSkillSystem',
  'createTriage',
  'deckPool',
  'decodeSave',
  'decodeSavePayload',
  'defineGame',
  'defineSaveFormat',
  'drawFrom',
  'drawMany',
  'emptyProgress',
  'encodeSave',
  'entryAllowed',
  'evalGoal',
  'formatAmount',
  'generateTemplates',
  'goalProgress',
  'inBand',
  'leverFactor',
  'mulberry32',
  'numberNumeric',
  'overReachFactor',
  'planIdle',
  'proficiencyFromExp',
  'progressText',
  'randomRng',
  'runIdle',
  'runMigrations',
  'seedFromString',
  'stageNameOf',
  'validateGame',
  'weightedSkill'
] as const

/**
 * 类型清单:上面 import 的每个名字都要能**只从公开入口**取到。
 * 这个空壳把它们串成一个大对象,只为让 tsc 真的去解析它们(类型不参与运行,故运行时无副作用)。
 */
/** 持有层的样例件:库只要求 uid,其余随便 */
interface SampleItem extends HoldingItem {
  name?: string
}

type PublicTypes = {
  attribute: [AttributeDef, AttributeSystem, AttributeSystemConfig, ComputedStats<number>, Mods, OnTopMult, StatsInput<number>]
  realm: [
    RealmDef,
    RealmEntry,
    RealmState<number>,
    RealmSystem,
    RealmSystemConfig,
    RealmExpConfig,
    RealmCombatConfig,
    RealmBreakthroughConfig,
    WorldDef,
    WorldConfig,
    GrowthCurve,
    ProgressView<number>,
    BreakthroughResult<number>
  ]
  equipment: [
    AffixDef,
    AffixLine,
    AffixRoll,
    EquipmentConfig,
    EquipmentInstance,
    EquipmentPowerConfig,
    EquipmentSystem,
    Loadout,
    LoadoutStats<number>,
  RerollOptions,
  QualityDef,
  ResourceDef,
  ResourceEntry,
  ResourceSummary,
  ResourceSystem,
  ResourceSystemConfig,
    ResolvedEquipment<number>,
    RollOptions,
    SetDef,
    SlotDef,
    TemplateDef
  ]
  dungeon: [
    DungeonConfig,
    DungeonProgress,
    DungeonSystem,
    Encounter,
    EnemyDef,
    EnemySkillDef,
    EnemySnapshot<number>,
    RegionDef,
    RewardDef,
    VictoryOutcome<number>
  ]
  combat: [
    BattleConfig,
    BattleEvent,
    BattleEventKind,
    BattleFollowupConfig,
    BattleHookContext<number>,
    BattleResult<number>,
    BattleShieldConfig,
    BattleSkillEffectsConfig,
    Combatant<number>,
    CombatEngine,
    CombatKeys,
    DamageContext<number>,
    SkillEffectContext<number>,
    StrikeOptions
  ]
  idle: [IdleConfig, IdlePlan]
  save: [SaveDecodeResult<number>, SaveFormat<number>, SavePayload]
  skills: [SkillBranchDef, SkillConfig, SkillCostSpec, SkillDef, SkillState, SkillSystem]
  crafting: [CraftFormula, CraftLevers, LeverSpec, OverReachSpec, ProficiencyConfig, StageDef]
  resources: [AppliedEntry, Ledger<number>, ResourceDef, ResourceEntry, ResourceSummary, ResourceSystem, ResourceSystemConfig]
  triage: [TriageConfig<SampleItem>, TriageImpact, TriageOutcome, TriageRule<SampleItem>, TriageSystem<SampleItem>, TriageVerdict]
  cycles: [CycleConfig, CycleContext, CycleEntry, CycleSystem, ScheduledCycle]
  choices: [ChoiceConfig<number, number>, ChoiceDef<number>, ChoiceOutcome<number>, ChoiceReceipt<number>, ChoiceSystem<number, number>]
  codex: [CodexConfig, CodexStage, CodexState, CodexSystem, CodexView]
  memory: [StageMemory, StageMemoryConfig, StageMemoryInput, StageMemoryState, StageSpec]
  economy: [EconomyConfig, EconomyPeriod, EconomyReadings, EconomyVerdict, FlowInput, FlowReading, PeriodReading]
  holding: [AddFailure, Holding<SampleItem>, HoldingConfig<SampleItem>, HoldingItem, HoldingSystem<SampleItem>, SlotMap]
  goals: [GoalCond, GoalEnv, GoalProgress]
  deck: [DeckContext, DeckEntry, DrawOptions, DrawManyOptions, LevelBand]
  companions: [CompanionConfig, CompanionDef, CompanionSystem, TraitDef]
  config: [DefineOptions<number>, Game, GameConfig, IssueLevel, ValidationIssue]
  misc: [Numeric<number>, Rng]
}

// 只为了让 PublicTypes 真的被解析一次(纯类型层,运行时没有这一行做的事)
type _PublicTypesUsed = PublicTypes

describe('公开面 —— 使用者看到的库长什么样', () => {
  it('运行时导出与清单一字不差(增删都要在这里显式改)', () => {
    const actual = Object.keys(engine)
      .filter(k => k !== 'default')
      .sort()
    expect(actual).toEqual([...RUNTIME_EXPORTS].sort())
  })

  it('公开类型只在类型层(不会被当成运行时导出)', () => {
    // 类型不存在于运行时,顺带证明入口没有把"类型"误发成值
    const values = new Set(Object.keys(engine))
    for (const name of ['SkillEffectContext', 'CombatKeys', 'RealmExpConfig', 'ProficiencyConfig', 'BattleConfig']) {
      expect(values.has(name)).toBe(false)
    }
  })

  it('公开面里的类型清单本身是"用得上"的(编译期判据,运行到这里即通过)', () => {
    // _PublicTypesUsed 由 tsc 校验:上面 import 的每一个类型都必须从 './index.js' 取得到
    const used: _PublicTypesUsed | null = null
    expect(used).toBeNull()
  })
})
