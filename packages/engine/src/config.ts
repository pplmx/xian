/**
 * 世界装配 —— 把四套系统(等级/属性/装备/副本)装成一个可运行的世界。
 *
 * 这里也是"公共库"最关键的一道门:**交叉校验**。
 * 内容表之间全是引用(装备的槽位、词条挂的属性键、区域的敌人与首领、区域的前置),
 * 一处写错,游戏跑起来是"某张图永远掉不出装备"或"某件装备永远不出现"这种静默故障。
 * 所以装配时就逐条对账,把这类错误变成一句能读懂的报错。
 */
import type { AttributeSystem, AttributeSystemConfig } from './attributes.js'
import { createAttributeSystem } from './attributes.js'
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'
import type { RealmSystem, RealmSystemConfig } from './realms.js'
import { createRealmSystem } from './realms.js'
import type { EquipmentConfig, EquipmentSystem } from './equipment.js'
import { createEquipmentSystem } from './equipment.js'
import type { DungeonConfig, DungeonSystem } from './dungeons.js'
import { createDungeonSystem } from './dungeons.js'
import type { BattleConfig, CombatEngine } from './combat.js'
import { createCombatEngine } from './combat.js'

export interface GameConfig<T = number> {
  /** 作品名 —— 引擎不会把它插进任何文案,只用来标识这份配置 */
  name: string
  version?: string
  attributes: AttributeSystemConfig
  realms: RealmSystemConfig
  /**
   * 装备这一层。**没有这一层就显式写 `null`**(门面里那一层仍然在,是"空系统":0 槽 0 件)。
   *
   * 为什么写成必填、而不是"省略就等于没有":省略是静默的 —— 一款本来要装装备的游戏漏了这一节,
   * 会装出一个"永远掉不出装备"的世界,而这类故障在装配时看不出来(仓库里最想消灭的正是它)。
   * 写成必填之后,"有"与"没有"都是一句明确的话;真去用空的那一层(抽一件)也会当场说明白。
   */
  equipment: EquipmentConfig<T> | null
  /** 副本这一层:口径同 `equipment` —— 没有就写 `null`,门面里那一层是空系统 */
  dungeons: DungeonConfig<T> | null
  combat?: BattleConfig<T>
}

export interface Game<T = number> {
  readonly name: string
  readonly version: string
  readonly attributes: AttributeSystem<T>
  readonly realms: RealmSystem<T>
  /** 装备层。配置里写 `equipment: null` 时这里是空系统(0 槽 0 件)—— 判读用 `config.equipment === null` */
  readonly equipment: EquipmentSystem<T>
  /** 副本层。配置里写 `dungeons: null` 时这里是空系统(0 区域 0 敌人)—— 判读用 `config.dungeons === null` */
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

  /**
   * ---- 节形状:先于一切 ----
   *
   * 为什么把这件放在最前面:下面那些对账是"逐字段互相引用"(槽位、属性键、区域、敌人),
   * 一旦某一节整个缺了或形状错了,它们读到的是 `undefined.map(...)` —— 使用者拿到的不是
   * "你少写了一节",而是一句 `Cannot read properties of undefined`。
   *
   * 两件事在这里定死:
   *   ① **缺节 = 报错**,并告诉他"没有这一层就显式写 null"(省略是静默的,那正是要拦的);
   *   ② **形状不对就到此为止** —— 后面的对账在没有形状的前提下没有意义,继续跑只会再崩一次。
   */
  const shapeOf = (name: string, value: unknown, fields: readonly { key: string; kind: 'array' | 'object' }[]): boolean => {
    if (value === undefined) {
      err('CONFIG_SECTION_MISSING', `配置里缺了 ${name} 这一节 —— 这款游戏没有这一层就显式写 ${name}: null`)
      return false
    }
    if (value === null || typeof value !== 'object') {
      err('CONFIG_SECTION_SHAPE', `${name} 必须是对象${name === 'equipment' || name === 'dungeons' ? '(没有这一层写 null)' : ''} —— 现在是 ${value === null ? 'null' : typeof value}`)
      return false
    }
    let ok = true
    for (const field of fields) {
      const got = (value as Record<string, unknown>)[field.key]
      const good = field.kind === 'array' ? Array.isArray(got) : got !== undefined && got !== null && typeof got === 'object'
      if (!good) {
        err('CONFIG_FIELD_SHAPE', `${name}.${field.key} 必须是${field.kind === 'array' ? '数组' : '对象'} —— 现在是 ${got === undefined ? '缺的' : Array.isArray(got) ? '数组' : typeof got}`)
        ok = false
      }
    }
    return ok
  }
  const realmsOk = shapeOf('realms', config.realms, [
    { key: 'worlds', kind: 'array' },
    { key: 'exp', kind: 'object' },
    { key: 'combat', kind: 'object' }
  ])
  const attributesOk = shapeOf('attributes', config.attributes, [{ key: 'defs', kind: 'array' }])
  // null = 明确说"没有这一层";undefined 由 shapeOf 报出来(省略是静默的)
  const equipmentOk = config.equipment === null ? false : shapeOf('equipment', config.equipment, [
    { key: 'slots', kind: 'array' },
    { key: 'qualities', kind: 'array' },
    { key: 'templates', kind: 'array' },
    { key: 'affixes', kind: 'array' },
    { key: 'power', kind: 'object' }
  ])
  const dungeonsOk = config.dungeons === null ? false : shapeOf('dungeons', config.dungeons, [
    { key: 'regions', kind: 'array' },
    { key: 'enemies', kind: 'array' }
  ])
  // 形状不对就不再往下逐条对账(继续跑只会以 TypeError 再崩一次)
  if (!realmsOk || !attributesOk || config.equipment === undefined || config.dungeons === undefined) return issues
  if (config.equipment !== null && !equipmentOk) return issues
  if (config.dungeons !== null && !dungeonsOk) return issues

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
  // `null` = 这款游戏没有装备这一层:不校验,也不抱怨(已由上面 shapeOf 判过)
  if (config.equipment !== null) {
    const equipment = config.equipment
    const slotIds = new Set(equipment.slots.map(s => s.id))
    if (duplicates(equipment.slots.map(s => s.id)).length > 0) {
      err('EQUIP_SLOT_DUPLICATE', `槽位 id 重复:${duplicates(equipment.slots.map(s => s.id)).join('、')}`)
    }
    if (duplicates(equipment.qualities.map(q => q.id)).length > 0) {
      err('EQUIP_QUALITY_DUPLICATE', `品质 id 重复:${duplicates(equipment.qualities.map(q => q.id)).join('、')}`)
    }
    if (duplicates(equipment.templates.map(t => t.id)).length > 0) {
      err('EQUIP_TEMPLATE_DUPLICATE', `装备模板 id 重复:${duplicates(equipment.templates.map(t => t.id)).join('、')}`)
    }
    if (duplicates(equipment.affixes.map(a => a.id)).length > 0) {
      err('EQUIP_AFFIX_DUPLICATE', `词条 id 重复:${duplicates(equipment.affixes.map(a => a.id)).join('、')}`)
    }
    const setIds = new Set((equipment.sets ?? []).map(s => s.id))
    if (duplicates((equipment.sets ?? []).map(s => s.id)).length > 0) {
      err('EQUIP_SET_DUPLICATE', `套装 id 重复:${duplicates((equipment.sets ?? []).map(s => s.id)).join('、')}`)
    }
    for (const s of equipment.sets ?? []) {
      if (s.bonuses.length === 0) warn('EQUIP_SET_EMPTY', `套装 ${s.id}(${s.name})没有任何件数效果`)
      for (const b of s.bonuses) {
        if (b.pieces < 1) err('EQUIP_SET_PIECES', `套装 ${s.id}(${s.name})的件数门槛必须 ≥ 1,当前 ${b.pieces}`)
      }
    }
    for (const t of equipment.templates) {
      if (!slotIds.has(t.slot)) err('EQUIP_TEMPLATE_SLOT', `装备模板 ${t.id}(${t.name})的槽位未定义:${t.slot}`)
      if (t.setId !== undefined && !setIds.has(t.setId)) {
        err('EQUIP_TEMPLATE_SET', `装备模板 ${t.id}(${t.name})指向未定义的套装:${t.setId}`)
      }
    }
    for (const a of equipment.affixes) {
      if (!attrKeys.has(a.key)) err('EQUIP_AFFIX_KEY', `词条 ${a.id}(${a.name})挂在未登记的属性键上:${a.key}`)
      for (const s of a.slots ?? []) {
        if (!slotIds.has(s)) err('EQUIP_AFFIX_SLOT', `词条 ${a.id}(${a.name})限定了一个未定义的槽位:${s}`)
      }
      if (a.min > a.max) err('EQUIP_AFFIX_RANGE', `词条 ${a.id}(${a.name})的 min > max:${a.min} > ${a.max}`)
      if (a.weight <= 0) warn('EQUIP_AFFIX_WEIGHT', `词条 ${a.id}(${a.name})的权重为 ${a.weight},永远不会被抽到`)
    }
    for (const q of equipment.qualities) {
      if (q.affixes[0] > q.affixes[1]) err('EQUIP_QUALITY_AFFIX_RANGE', `品质 ${q.id}(${q.name})的词条区间反了`)
      if (q.weight <= 0) warn('EQUIP_QUALITY_WEIGHT', `品质 ${q.id}(${q.name})的权重为 ${q.weight},永远不会被抽到`)
    }
    for (const s of equipment.slots) {
      const hasTemplate = equipment.templates.some(t => t.slot === s.id)
      if (!hasTemplate) warn('EQUIP_SLOT_EMPTY', `槽位 ${s.id}(${s.name})没有任何装备模板`)
    }
    // 每个用到的层级,每个可掉落槽位都该有内容(否则会走退档兜底)
    const tiers = [...new Set(equipment.templates.map(t => t.tier))].sort((a, b) => a - b)
    for (const tier of tiers) {
      for (const s of equipment.slots) {
        if ((s.dropWeight ?? 1) <= 0) continue
        if (!equipment.templates.some(t => t.tier === tier && t.slot === s.id)) {
          warn('EQUIP_TIER_SLOT_GAP', `层级 ${tier} 的槽位 ${s.id}(${s.name})没有本层模板,会退档掉落`)
        }
      }
  }
  }

  // ---- 副本 ----
  // `null` = 这款游戏没有副本这一层:同上
  if (config.dungeons !== null) {
    const dungeons = config.dungeons
    const enemyIds = new Set(dungeons.enemies.map(e => e.id))
    const regionIds = new Set(dungeons.regions.map(r => r.id))
    if (duplicates(dungeons.enemies.map(e => e.id)).length > 0) {
      err('DUNGEON_ENEMY_DUPLICATE', `敌人 id 重复:${duplicates(dungeons.enemies.map(e => e.id)).join('、')}`)
    }
    if (duplicates(dungeons.regions.map(r => r.id)).length > 0) {
      err('DUNGEON_REGION_DUPLICATE', `区域 id 重复:${duplicates(dungeons.regions.map(r => r.id)).join('、')}`)
    }
    for (const r of dungeons.regions) {
      if (r.enemies.length === 0) warn('DUNGEON_REGION_NO_ENEMY', `区域 ${r.id}(${r.name})没有普通敌人,只会出首领`)
      for (const id of r.enemies) {
        if (!enemyIds.has(id)) err('DUNGEON_REGION_ENEMY', `区域 ${r.id}(${r.name})引用了不存在的敌人:${id}`)
      }
      if (!enemyIds.has(r.boss)) err('DUNGEON_REGION_BOSS', `区域 ${r.id}(${r.name})的首领不存在:${r.boss}`)
      const boss = dungeons.enemies.find(e => e.id === r.boss)
      if (boss && boss.boss !== true) warn('DUNGEON_BOSS_FLAG', `区域 ${r.id} 的首领 ${r.boss}(${boss.name})没有标 boss:true`)
      const prereqs = r.requireCleared === undefined ? [] : typeof r.requireCleared === 'string' ? [r.requireCleared] : r.requireCleared
      for (const id of prereqs) {
        if (!regionIds.has(id)) err('DUNGEON_REGION_CHAIN', `区域 ${r.id}(${r.name})的前置不存在:${id}`)
      }
      if (r.requireMode === 'any' && prereqs.length < 2) {
        warn('DUNGEON_REGION_MODE', `区域 ${r.id}(${r.name})写了 requireMode: 'any' 但前置不足两条,等价于默认`)
      }
      if (r.minRealm > majorCount - 1) {
        err('DUNGEON_REGION_REALM', `区域 ${r.id}(${r.name})的推荐等级 ${r.minRealm} 超出境界范围 0..${majorCount - 1}`)
      }
      if (r.tier < 1) err('DUNGEON_REGION_TIER', `区域 ${r.id}(${r.name})的层级必须 ≥ 1`)
    }
    // 前置关系不能有环(多条前置时把每条边都走一遍)
    const prereqList = (id: string): readonly string[] => {
      const r = dungeons.regions.find(x => x.id === id)
      if (!r || r.requireCleared === undefined) return []
      return typeof r.requireCleared === 'string' ? [r.requireCleared] : r.requireCleared
    }
    for (const r of dungeons.regions) {
      const stack: string[] = [...prereqList(r.id)]
      const seen = new Set<string>()
      while (stack.length > 0) {
        const cur = stack.pop()!
        if (cur === r.id) {
          err('DUNGEON_REGION_CYCLE', `区域 ${r.id}(${r.name})的前置关系成环`)
          break
        }
        if (seen.has(cur)) continue
        seen.add(cur)
        stack.push(...prereqList(cur))
      }
    }
    for (const e of dungeons.enemies) {
      if (e.tier < 1) err('DUNGEON_ENEMY_TIER', `敌人 ${e.id}(${e.name})的层级必须 ≥ 1`)
      if (e.hpMult <= 0) warn('DUNGEON_ENEMY_HP', `敌人 ${e.id}(${e.name})的 hpMult=${e.hpMult},打不死也打不痛`)
    }
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
 * "没有装备这一层"与"没有副本这一层"装成的那两份空表。
 *
 * 它们的字段是照 `EquipmentConfig` / `DungeonConfig` 的最小合法形状写的 —— 目的是让
 * "这款游戏没有这层"走**同一条装配路径**,而不是在门面上留一个 undefined:
 * 门面里那一层的读数会是有意义的空(0 槽 0 件 / 0 区域),真去用它才会出错,且那句错说得明白。
 */
const EMPTY_EQUIPMENT = { slots: [], qualities: [], templates: [], affixes: [], power: {} } as EquipmentConfig<never>
const EMPTY_DUNGEONS = { regions: [], enemies: [] } as DungeonConfig<never>

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
  // 写了 null 的那一层装成"空系统":门面照常有这一层(读数都是 0 件 / 0 区域),
  // 真去用它(抽一件 / 取第一处区域)会当场说明白 —— 而不是在门面上留一个 undefined。
  const equipment = createEquipmentSystem<T>(
    config.equipment ?? (EMPTY_EQUIPMENT as unknown as EquipmentConfig<T>),
    numeric,
    opts.newUid
  )
  const dungeons = createDungeonSystem<T>(config.dungeons ?? (EMPTY_DUNGEONS as unknown as DungeonConfig<T>), numeric)
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
