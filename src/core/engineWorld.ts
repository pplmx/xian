/**
 * 公共库与本作之间的桥 —— 「游戏自己的数据 + 公共库的机制」。
 *
 * 这里只做一件事:把 data/ 里的内容(境界、属性名、兵器谱、词条、区域、敌人)
 * 装成一份 `GameConfig`,交给 `defineGame` 装配。**内容留在 data/,机制交给库**。
 *
 * 于是本作的曲线只有一处实现:`core/formulas` 的 expRequirement / baseCombatStats /
 * breakthroughBaseRate 已改为经这里调用库的实现;engineParity.spec 拿着**迁移前冻结的
 * 旧口径**与库对账,保证搬过去之后玩家看到的数字一个不变。
 *
 * 数值走 GNum 适配器(见 core/engineNumeric):库不认识 GNum,只认识 Numeric<T>。
 */
import type { Game, GameConfig } from '@engine/index'
import { attributeDefs, defineGame } from '@engine/index'
import type { AttributeDef } from '@engine/index'
import type { GNum } from '@/types'
import { LIFESPAN_WORLDS, REALMS, SUB_NAMES, WORLDS } from '@/data/realms'
import { WORLD_BREAK_MAJOR } from '@/data/realms'
import {
  BT_MAJOR_BASE_RATE,
  BT_MAJOR_DECAY,
  BT_MAX_RATE,
  BT_MIN_RATE,
  BT_SUB_BASE_RATE,
  BT_SUB_DECAY,
  COMBAT_ATK_BASE,
  COMBAT_DEF_BASE,
  COMBAT_HP_BASE,
  COMBAT_MAJOR_GROWTH,
  COMBAT_SUB_GROWTH,
  DIMINISH_KEYS,
  DIMINISH_WEIGHTS,
  EQUIP_BASE_FACTOR,
  EQUIP_LEVEL_BONUS,
  EQUIP_QUALITY_FLAT_EXP,
  EXP_BASE,
  EXP_MAJOR_GROWTH,
  EXP_SUB_GROWTH,
  LATE_COMBAT_GROWTH,
  LATE_EXP_GROWTH,
  QUALITY_OUT_OF_BAND,
  QUALITY_TIER_SHIFT,
  SOFT_CAPS,
  WORLD_STEP_EXP_MULT
} from '@/data/constants'
import { AFFIXES } from '@/data/affixes'
import { QUALITIES } from '@/data/qualities'
import { EQUIPMENT_TEMPLATES } from '@/data/equipment'
import { EQUIP_SETS } from './equipSet'
import { ENEMIES } from '@/data/enemies'
import { REGIONS } from '@/data/regions'
import { STAT_NAMES } from '@/ui/statNames'
import { toNum } from '@/utils/gnum'
import { uid } from '@/utils/id'
import { powerScale } from './tierScale'
import { gnumNumeric } from './engineNumeric'

/** 九个可掉落槽位(法宝是另一套池子,见 data/artifacts) */
export const DROP_SLOTS = ['weapon', 'head', 'body', 'wrist', 'belt', 'boots', 'necklace', 'ring', 'talisman'] as const

/**
 * 属性定义 —— 名目取自 ui/statNames(玩家看到的名字),
 * 递减键与软阈值取自 data/constants(平衡口径的唯一定义处)。
 */
function attributes(): AttributeDef[] {
  const percentTargets: Record<string, string> = { attackPct: 'attack', defensePct: 'defense', maxHpPct: 'maxHp' }
  const diminishing = new Set<string>(DIMINISH_KEYS)
  return attributeDefs({
    patch: Object.entries(STAT_NAMES).map(([key, name]) => {
      const def: AttributeDef = { key, name, kind: percentTargets[key] ? 'percent' : 'rate' }
      if (percentTargets[key]) {
        def.appliesTo = percentTargets[key]
        def.noDepth = true
      }
      if (key === 'cultivationSpeed') def.noDepth = true
      if (diminishing.has(key)) def.diminishing = true
      const cap = SOFT_CAPS[key as keyof typeof SOFT_CAPS]
      if (cap) def.softCap = { cap: cap.cap, diminish: cap.diminish }
      return def
    })
  })
}

/** 一份完整的世界配置:内容全部来自本作的 data/,机制全部来自公共库 */
export const ENGINE_WORLD_CONFIG: GameConfig = {
  name: '云隐修仙录',
  version: '1.33.0',
  attributes: {
    defs: attributes(),
    // 递减阶梯的来源仍是 data/constants(平衡口径的唯一定义处)——
    // 传进去,而不是让库用它自己的默认值:哪天调平衡,这里跟得上。
    diminishingWeights: DIMINISH_WEIGHTS
  },
  realms: {
    worlds: WORLDS.map(w => ({
      id: w.id,
      name: w.name,
      desc: w.desc,
      realms: REALMS.slice(w.start, w.end + 1).map(r => ({ id: r.id, name: r.name, desc: r.desc, lifespanYears: r.lifespanYears }))
    })),
    layerNames: SUB_NAMES,
    labelFormat: '{realm}·{layer}',
    exp: {
      base: EXP_BASE,
      realmGrowth: EXP_MAJOR_GROWTH,
      lateFrom: WORLD_BREAK_MAJOR,
      lateRealmGrowth: LATE_EXP_GROWTH,
      layerGrowth: EXP_SUB_GROWTH,
      worldStepMult: WORLD_STEP_EXP_MULT
    },
    combat: {
      base: { attack: COMBAT_ATK_BASE, defense: COMBAT_DEF_BASE, maxHp: COMBAT_HP_BASE },
      realmGrowth: COMBAT_MAJOR_GROWTH,
      lateFrom: WORLD_BREAK_MAJOR,
      lateRealmGrowth: LATE_COMBAT_GROWTH,
      layerGrowth: COMBAT_SUB_GROWTH
    },
    breakthrough: {
      layerBase: BT_SUB_BASE_RATE,
      layerDecay: BT_SUB_DECAY,
      majorBase: BT_MAJOR_BASE_RATE,
      majorDecay: BT_MAJOR_DECAY,
      min: BT_MIN_RATE,
      max: BT_MAX_RATE
    },
    lifespan: {
      byWorld: Object.fromEntries(Object.entries(LIFESPAN_WORLDS).map(([id, cfg]) => [id, { base: cfg.base, growth: cfg.growth }]))
    }
  },
  equipment: {
    slots: DROP_SLOTS.map((id, order) => ({ id, name: id, order })),
    qualities: QUALITIES.map(q => ({
      id: q.id,
      name: q.name,
      rank: q.rank,
      mult: q.mult,
      affixes: q.affixes,
      fromTier: q.fromTier,
      toTier: q.toTier,
      weight: q.weight,
      color: q.color
    })),
    templates: EQUIPMENT_TEMPLATES.filter(t => (DROP_SLOTS as readonly string[]).includes(t.slot)).map(t => ({
      id: t.id,
      name: t.name,
      slot: t.slot,
      tier: t.tier,
      base: t.base as Record<string, number>,
      fixedMods: t.fixedMods,
      desc: t.desc,
      icon: t.icon,
      setId: t.set
    })),
    affixes: AFFIXES.map(a => ({
      id: a.id,
      name: a.name,
      key: a.key as string,
      min: a.min,
      max: a.max,
      weight: a.weight,
      rarity: a.rarity,
      slots: a.slots,
      minRank: a.minRank,
      decimals: a.decimals,
      desc: a.desc
    })),
    // 本作的共鸣是**机制套**(铁壁 = 首次致命伤留 1 点气血),不是数值套:
    // 故挂 hook、mods 留空 —— 库只回答"件数够没够",hook 由战斗引擎解释。
    sets: EQUIP_SETS.map(s => ({
      id: s.id,
      name: s.name,
      bonuses: [{ pieces: s.required, mods: {}, desc: s.effectDesc, hook: s.hook }]
    })),
    power: {
      tierGrowth: 1.9,
      baseFactor: EQUIP_BASE_FACTOR,
      qualityExponent: EQUIP_QUALITY_FLAT_EXP,
      levelBonus: EQUIP_LEVEL_BONUS,
      // 本作的层级系数不是一条指数曲线,而是一张按区域层级排的战力表(见 core/tierScale.powerScale)。
      // 库允许整表覆盖,于是两边共用同一张表;指数式是留给新游戏的默认写法。
      // 表以 number 投影过来(GNum → double):一致到相对 1e-15,只差在双精度的
      // 第 16 位有效数字上 —— 装备平铺的显示与判定都看不出这一位。
      tierFactors: Array.from({ length: Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier)) }, (_, i) => toNum(powerScale(i + 1)))
    },
    // 词条按百分点书写(「攻击提升 4.2%」),入属性时统一 ÷100
    affixValueScale: 100,
    // 品质窗口与层阶加成同样取自 data/constants —— 凡库有默认值的平衡参数,
    // 本作一律显式传入(见 DEC-071):默认值接管平衡是最难被发现的一种分叉。
    outOfBand: QUALITY_OUT_OF_BAND,
    qualityTierShift: QUALITY_TIER_SHIFT
  },
  dungeons: {
    regions: REGIONS.map(r => ({
      id: r.id,
      name: r.name,
      desc: r.desc,
      icon: r.icon,
      tier: r.tier,
      minRealm: r.minRealm,
      danger: r.danger,
      enemies: r.enemies,
      boss: r.boss,
      eventTags: r.eventTags,
      requireCleared: r.requireCleared
    })),
    enemies: ENEMIES.map(e => ({
      id: e.id,
      name: e.name,
      tier: e.tier,
      icon: e.icon,
      hpMult: e.hpMult,
      atkMult: e.atkMult,
      defMult: e.defMult,
      speed: e.speed,
      skills: e.skills,
      boss: e.isBoss,
      mods: e.mods,
      archetype: e.archetype,
      tags: e.element ? [e.element] : undefined
    })),
    bossProgress: 8,
    enemyPower: {
      baseHp: COMBAT_HP_BASE,
      baseAttack: COMBAT_ATK_BASE,
      baseDefense: COMBAT_DEF_BASE,
      tierGrowth: 1.9
    }
  },
  combat: { maxRounds: 30, critMultiplier: 1.5, variance: 0.08 }
}

/** GNum 版世界(本作实际使用的入口) */
export const ENGINE_WORLD: Game<GNum> = defineGame<GNum>(ENGINE_WORLD_CONFIG, { numeric: gnumNumeric, newUid: uid })
