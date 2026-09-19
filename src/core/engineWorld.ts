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
import type { Game, GameConfig } from 'wanxiang-engine'
import { attributeDefs, defineGame } from 'wanxiang-engine'
import type { AttributeDef } from 'wanxiang-engine'
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
  EXPLORE_BOSS_AFTER_WINS,
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
import { QUALITIES, qualityDef } from '@/data/qualities'
import { EQUIPMENT_TEMPLATES } from '@/data/equipment'
import { EQUIP_SETS } from '@/data/equipSets'
import { ENEMIES } from '@/data/enemies'
import { REGIONS } from '@/data/regions'
import { GONGFA } from '@/data/gongfa'
import { GONGFA_BRANCHES } from '@/data/gongfaBranches'
import { STAT_NAMES } from '@/ui/statNames'
import { uid } from '@/utils/id'
import {
  GONGFA_UP_GROWTH,
  GONGFA_UP_WUDAO_BASE
} from '@/data/constants'
import { createSkillSystem } from 'wanxiang-engine'
import { createCompanionSystem } from 'wanxiang-engine'
import { PET_TRAITS } from '@/data/petTraits'
import { PETS } from '@/data/pets'
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
export const ENGINE_WORLD_CONFIG: GameConfig<GNum> = {
  name: '玄枢录',
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
      // 库允许整表覆盖,且允许表里就是**宿主的大数**(Numeric.of 收下),故这里直接给 GNum ——
      // 不经过 double 投影,装备平铺与解析都能逐位一致。
      tierFactors: Array.from({ length: Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier)) }, (_, i) => powerScale(i + 1))
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
    // 区域之主的门槛与节奏:本作是"攒够 10 胜出一位首领,击败即通关、此后不再出"
    // (妖气复聚会把「已靖」收回去,那是另一层的世界节律,不改变这条节奏)
    bossProgress: EXPLORE_BOSS_AFTER_WINS,
    bossRhythm: 'once',
    /*
     * 这组数**本作一处都不读** —— 本作的敌人数值走 `core/combat.makeEnemySnap`
     * (powerScale(层级) × 三围基数 × 层级补偿),与库的 `snapshot()`(基数 × 倍率 ×
     * tierGrowth^(tier-1))不是同一个模型:两套后期差 3 个数量级(见 engineProgressionAudit
     * 那一节实测)。它留着只为满足库的类型声明(库要求这一节存在),**别拿它当本作的内容强度**。
     *
     * 谁哪天真的改用 `game.dungeons.snapshot()`,上面那条判据会当场红 —— 那时再来对齐两套模型,
     * 而不是现在为"将来可能用"先付利息。
     */
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

/**
 * 功法(技能)系统 —— 内容取自 data/gongfa 与 data/gongfaBranches,
 * 成长曲线(第 N 级 = 基础 + 每级 ×(N-1))与升级消耗曲线由公共库算。
 *
 * 放在这里而不是塞进 GameConfig:技能不是"世界的四件套"之一,而是一层可选的装配,
 * 库也把它写成独立系统(见 packages/engine 的 skills)。
 */
const qualityRankOf = (id: string): number => qualityDef(id as (typeof QUALITIES)[number]['id']).rank

export const GONGFA_SYSTEM = createSkillSystem({
  skills: GONGFA.map(def => {
    const qualityRank = qualityRankOf(def.quality)
    return {
      id: def.id,
      name: def.name,
      kind: def.type,
      maxLevel: def.maxLevel,
      baseMods: def.baseMods,
      perLevelMods: def.perLevelMods,
      requiredLevel: def.minRealm,
      // 本作的消耗曲线:悟道点 = 基数 ×(1 + 品质序 × 0.6) × 倍率^等级;残页 = 等级 ×(1 + 品质序 × 0.5)
      costs: [
        { key: 'wudao', base: GONGFA_UP_WUDAO_BASE * (1 + qualityRank * 0.6), growth: GONGFA_UP_GROWTH },
        // 残页不打折:本作只有悟道点吃洞府折扣(见 gongfaService.gongfaUpgradeCost)
        { key: 'page', base: 0, levelStep: 1 + qualityRank * 0.5, discountable: false }
      ],
      branches: GONGFA_BRANCHES.filter(b => b.gongfaId === def.id).map(b => ({ id: b.id, name: b.name, mods: b.mods, desc: b.desc })),
      desc: def.desc
    }
  })
})

/**
 * 灵兽(伙伴)系统 —— 内容取自 data/pets 与 data/petTraits,
 * 「性格 → 一组行为系数」的叠加规则由公共库算。
 *
 * 中性基线由本作给:倍率类的中性是 1、加法类的中性是 0 —— 库猜不出这个,
 * 所以必须显式写出来(否则"没带灵兽"那天会悄悄改变历练时长与掉落)。
 */
export const COMPANION_SYSTEM = createCompanionSystem({
  companions: PETS.map(p => ({ id: p.id, name: p.name, traitId: p.personality, mods: p.mods })),
  traits: PET_TRAITS,
  neutral: { exploreDurMult: 1, dangerMult: 1, dropLuck: 0, lossReduction: 0 }
})
