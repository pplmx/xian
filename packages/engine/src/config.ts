/**
 * 世界装配 —— 把四套系统(等级/属性/装备/副本)装成一个可运行的世界。
 *
 * 这里也是"公共库"最关键的一道门:**交叉校验**。
 * 内容表之间全是引用(装备的槽位、词条挂的属性键、区域的敌人与首领、区域的前置),
 * 一处写错,游戏跑起来是"某张图永远掉不出装备"或"某件装备永远不出现"这种静默故障。
 * 所以装配时就逐条对账,把这类错误变成一句能读懂的报错。
 */
import type { AttributeSystem, AttributeSystemConfig } from './attributes'
import { createAttributeSystem } from './attributes'
import type { Numeric } from './numeric'
import { numberNumeric } from './numeric'
import type { RealmSystem, RealmSystemConfig } from './realms'
import { createRealmSystem } from './realms'
import type { EquipmentConfig, EquipmentSystem } from './equipment'
import { createEquipmentSystem } from './equipment'
import type { DungeonConfig, DungeonSystem } from './dungeons'
import { createDungeonSystem } from './dungeons'
import type { BattleConfig, CombatEngine } from './combat'
import { createCombatEngine } from './combat'

export interface GameConfig<T = number> {
  /** 作品名 —— 引擎不会把它插进任何文案,只用来标识这份配置 */
  name: string
  version?: string
  attributes: AttributeSystemConfig
  realms: RealmSystemConfig
  equipment: EquipmentConfig<T>
  dungeons: DungeonConfig
  combat?: BattleConfig
}

export interface Game<T = number> {
  readonly name: string
  readonly version: string
  readonly attributes: AttributeSystem<T>
  readonly realms: RealmSystem<T>
  readonly equipment: EquipmentSystem<T>
  readonly dungeons: DungeonSystem<T>
  readonly combat: CombatEngine<T>
  /** 装配用的原始配置(数值可能是宿主自己的类型,如 GNum 的层级表) */
  readonly config: GameConfig<T>
}

export type IssueLevel = 'error' | 'warning'

export interface ValidationIssue {
  level: IssueLevel
  code: string
  message: string
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) dup.add(id)
    seen.add(id)
  }
  return [...dup]
}

/**
 * 逐条对账。错误(引用不存在、键重复、链条断掉)会挡住装配;
 * 警告(某层某部位没有内容、首领没标记 boss)只是提示。
 */
export function validateGame<T = number>(config: GameConfig<T>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const err = (code: string, message: string): void => void issues.push({ level: 'error', code, message })
  const warn = (code: string, message: string): void => void issues.push({ level: 'warning', code, message })

  // ---- 等级 ----
  const worldIds = new Set<string>()
  let majorCount = 0
  for (const w of config.realms.worlds) {
    if (worldIds.has(w.id)) err('REALM_WORLD_DUPLICATE', `世界 id 重复:${w.id}`)
    worldIds.add(w.id)
    if (w.realms.length === 0) err('REALM_WORLD_EMPTY', `世界 ${w.id}(${w.name})没有境界`)
    majorCount += w.realms.length
  }
  if (majorCount === 0) err('REALM_EMPTY', '境界表为空 —— 至少要有 1 个世界与 1 个境界')
  const realmIds = new Set<string>()
  for (const w of config.realms.worlds) {
    for (const entry of w.realms) {
      if (typeof entry !== 'string' && entry.id !== undefined) {
        if (realmIds.has(entry.id)) err('REALM_ID_DUPLICATE', `境界 id 重复:${entry.id}`)
        realmIds.add(entry.id)
      }
    }
  }
  if (config.realms.layerNames && config.realms.layerNames.length < 2) {
    warn('REALM_LAYERS_FEW', `小层只有 ${config.realms.layerNames.length} 个 —— 通常至少要有"一层"和"圆满"`)
  }
  const lateFrom = config.realms.exp.lateFrom
  if (lateFrom !== undefined && (lateFrom < 0 || lateFrom > majorCount)) {
    err('REALM_LATE_FROM_RANGE', `成长曲线分段点 lateFrom=${lateFrom} 超出境界范围 0..${majorCount}`)
  }

  // ---- 属性 ----
  const attrKeys = new Set(config.attributes.defs.map(d => d.key))
  const dupAttrs = duplicates(config.attributes.defs.map(d => d.key))
  if (dupAttrs.length > 0) err('ATTR_DUPLICATE', `属性键重复:${dupAttrs.join('、')}`)
  for (const d of config.attributes.defs) {
    if (d.appliesTo !== undefined && !attrKeys.has(d.appliesTo)) {
      err('ATTR_APPLIES_TO', `属性 ${d.key} 的 appliesTo 指向未登记的键:${d.appliesTo}`)
    }
  }
  for (const key of config.attributes.core ?? []) {
    if (!attrKeys.has(key)) err('ATTR_CORE_UNKNOWN', `core 里的键未登记:${key}`)
  }

  // ---- 装备 ----
  const slotIds = new Set(config.equipment.slots.map(s => s.id))
  if (duplicates(config.equipment.slots.map(s => s.id)).length > 0) {
    err('EQUIP_SLOT_DUPLICATE', `槽位 id 重复:${duplicates(config.equipment.slots.map(s => s.id)).join('、')}`)
  }
  if (duplicates(config.equipment.qualities.map(q => q.id)).length > 0) {
    err('EQUIP_QUALITY_DUPLICATE', `品质 id 重复:${duplicates(config.equipment.qualities.map(q => q.id)).join('、')}`)
  }
  if (duplicates(config.equipment.templates.map(t => t.id)).length > 0) {
    err('EQUIP_TEMPLATE_DUPLICATE', `装备模板 id 重复:${duplicates(config.equipment.templates.map(t => t.id)).join('、')}`)
  }
  if (duplicates(config.equipment.affixes.map(a => a.id)).length > 0) {
    err('EQUIP_AFFIX_DUPLICATE', `词条 id 重复:${duplicates(config.equipment.affixes.map(a => a.id)).join('、')}`)
  }
  const setIds = new Set((config.equipment.sets ?? []).map(s => s.id))
  if (duplicates((config.equipment.sets ?? []).map(s => s.id)).length > 0) {
    err('EQUIP_SET_DUPLICATE', `套装 id 重复:${duplicates((config.equipment.sets ?? []).map(s => s.id)).join('、')}`)
  }
  for (const s of config.equipment.sets ?? []) {
    if (s.bonuses.length === 0) warn('EQUIP_SET_EMPTY', `套装 ${s.id}(${s.name})没有任何件数效果`)
    for (const b of s.bonuses) {
      if (b.pieces < 1) err('EQUIP_SET_PIECES', `套装 ${s.id}(${s.name})的件数门槛必须 ≥ 1,当前 ${b.pieces}`)
    }
  }
  for (const t of config.equipment.templates) {
    if (!slotIds.has(t.slot)) err('EQUIP_TEMPLATE_SLOT', `装备模板 ${t.id}(${t.name})的槽位未定义:${t.slot}`)
    if (t.setId !== undefined && !setIds.has(t.setId)) {
      err('EQUIP_TEMPLATE_SET', `装备模板 ${t.id}(${t.name})指向未定义的套装:${t.setId}`)
    }
  }
  for (const a of config.equipment.affixes) {
    if (!attrKeys.has(a.key)) err('EQUIP_AFFIX_KEY', `词条 ${a.id}(${a.name})挂在未登记的属性键上:${a.key}`)
    for (const s of a.slots ?? []) {
      if (!slotIds.has(s)) err('EQUIP_AFFIX_SLOT', `词条 ${a.id}(${a.name})限定了一个未定义的槽位:${s}`)
    }
    if (a.min > a.max) err('EQUIP_AFFIX_RANGE', `词条 ${a.id}(${a.name})的 min > max:${a.min} > ${a.max}`)
    if (a.weight <= 0) warn('EQUIP_AFFIX_WEIGHT', `词条 ${a.id}(${a.name})的权重为 ${a.weight},永远不会被抽到`)
  }
  for (const q of config.equipment.qualities) {
    if (q.affixes[0] > q.affixes[1]) err('EQUIP_QUALITY_AFFIX_RANGE', `品质 ${q.id}(${q.name})的词条区间反了`)
    if (q.weight <= 0) warn('EQUIP_QUALITY_WEIGHT', `品质 ${q.id}(${q.name})的权重为 ${q.weight},永远不会被抽到`)
  }
  for (const s of config.equipment.slots) {
    const hasTemplate = config.equipment.templates.some(t => t.slot === s.id)
    if (!hasTemplate) warn('EQUIP_SLOT_EMPTY', `槽位 ${s.id}(${s.name})没有任何装备模板`)
  }
  // 每个用到的层级,每个可掉落槽位都该有内容(否则会走退档兜底)
  const tiers = [...new Set(config.equipment.templates.map(t => t.tier))].sort((a, b) => a - b)
  for (const tier of tiers) {
    for (const s of config.equipment.slots) {
      if ((s.dropWeight ?? 1) <= 0) continue
      if (!config.equipment.templates.some(t => t.tier === tier && t.slot === s.id)) {
        warn('EQUIP_TIER_SLOT_GAP', `层级 ${tier} 的槽位 ${s.id}(${s.name})没有本层模板,会退档掉落`)
      }
    }
  }

  // ---- 副本 ----
  const enemyIds = new Set(config.dungeons.enemies.map(e => e.id))
  const regionIds = new Set(config.dungeons.regions.map(r => r.id))
  if (duplicates(config.dungeons.enemies.map(e => e.id)).length > 0) {
    err('DUNGEON_ENEMY_DUPLICATE', `敌人 id 重复:${duplicates(config.dungeons.enemies.map(e => e.id)).join('、')}`)
  }
  if (duplicates(config.dungeons.regions.map(r => r.id)).length > 0) {
    err('DUNGEON_REGION_DUPLICATE', `区域 id 重复:${duplicates(config.dungeons.regions.map(r => r.id)).join('、')}`)
  }
  for (const r of config.dungeons.regions) {
    if (r.enemies.length === 0) warn('DUNGEON_REGION_NO_ENEMY', `区域 ${r.id}(${r.name})没有普通敌人,只会出首领`)
    for (const id of r.enemies) {
      if (!enemyIds.has(id)) err('DUNGEON_REGION_ENEMY', `区域 ${r.id}(${r.name})引用了不存在的敌人:${id}`)
    }
    if (!enemyIds.has(r.boss)) err('DUNGEON_REGION_BOSS', `区域 ${r.id}(${r.name})的首领不存在:${r.boss}`)
    const boss = config.dungeons.enemies.find(e => e.id === r.boss)
    if (boss && boss.boss !== true) warn('DUNGEON_BOSS_FLAG', `区域 ${r.id} 的首领 ${r.boss}(${boss.name})没有标 boss:true`)
    if (r.requireCleared !== undefined && !regionIds.has(r.requireCleared)) {
      err('DUNGEON_REGION_CHAIN', `区域 ${r.id}(${r.name})的前置不存在:${r.requireCleared}`)
    }
    if (r.minRealm > majorCount - 1) {
      err('DUNGEON_REGION_REALM', `区域 ${r.id}(${r.name})的推荐等级 ${r.minRealm} 超出境界范围 0..${majorCount - 1}`)
    }
    if (r.tier < 1) err('DUNGEON_REGION_TIER', `区域 ${r.id}(${r.name})的层级必须 ≥ 1`)
  }
  // 链条不能有环
  for (const r of config.dungeons.regions) {
    const seen = new Set<string>([r.id])
    let cur = r.requireCleared
    while (cur !== undefined) {
      if (seen.has(cur)) {
        err('DUNGEON_REGION_CYCLE', `区域链条成环:${[...seen].join(' → ')} → ${cur}`)
        break
      }
      seen.add(cur)
      cur = config.dungeons.regions.find(x => x.id === cur)?.requireCleared
    }
  }
  for (const e of config.dungeons.enemies) {
    if (e.tier < 1) err('DUNGEON_ENEMY_TIER', `敌人 ${e.id}(${e.name})的层级必须 ≥ 1`)
    if (e.hpMult <= 0) warn('DUNGEON_ENEMY_HP', `敌人 ${e.id}(${e.name})的 hpMult=${e.hpMult},打不死也打不痛`)
  }

  return issues
}

export interface DefineOptions<T> {
  numeric?: Numeric<T>
  /** warning 也当错误(内容发布前的严格模式) */
  strict?: boolean
  newUid?: () => string
}

/**
 * 装配一个世界:返回的四套系统是纯函数 + 数据驱动,不依赖任何框架,
 * Vue / React / 命令行 / 服务端都能拿同一份配置直接用。
 */
export function defineGame<T = number>(config: GameConfig<T>, opts: DefineOptions<T> = {}): Game<T> {
  const issues = validateGame(config)
  const blocking = opts.strict === true ? issues : issues.filter(i => i.level === 'error')
  if (blocking.length > 0) {
    const text = blocking.map(i => `  [${i.level}] ${i.code}: ${i.message}`).join('\n')
    throw new Error(`世界配置有 ${blocking.length} 处问题:\n${text}`)
  }
  const numeric = opts.numeric ?? (numberNumeric as unknown as Numeric<T>)
  const attributes = createAttributeSystem<T>(config.attributes, numeric)
  const realms = createRealmSystem<T>(config.realms, numeric)
  const equipment = createEquipmentSystem<T>(config.equipment, numeric, opts.newUid)
  const dungeons = createDungeonSystem<T>(config.dungeons, numeric)
  const combat = createCombatEngine<T>(config.combat, numeric)
  return {
    name: config.name,
    version: config.version ?? '0.0.0',
    attributes,
    realms,
    equipment,
    dungeons,
    combat,
    config
  }
}
