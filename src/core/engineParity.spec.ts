/**
 * 公共库与游戏本体的**对账** —— 「抽出来的引擎是这一局游戏的真身,不是另写的一套」。
 *
 * 四套系统各对一次:
 *   等级:境界名/寿元/修为需求/基础属性/进阶成功率 —— 逐境界逐层比数字
 *   属性:合并规则(递减 + 软阈值)—— 同一批来源,两边的合计必须一样
 *   装备:品质阶梯 / 每层每部位的掉落池 / 词条数值 —— 逐层比 id 与数值
 *   副本:区域链与解锁口径 —— 与 unlockClosure 在若干存档状态上逐个对账
 *
 * 之所以要有这份用例:内容可以重写,机制不能悄悄漂移。
 * 哪天有人改了公式而只改了其中一边,这里会红。
 */
import { describe, expect, it } from 'vitest'
import type { AttributeDef, GameConfig, RealmSystemConfig } from '@engine/index'
import { createAttributeSystem, createDungeonSystem, createEquipmentSystem, createRealmSystem, attributeDefs } from '@engine/index'
import type { GNum, QualityId } from '@/types'
import { LIFESPAN_WORLDS, REALMS, SUB_NAMES, WORLDS, lifespanOf, realmLabel } from '@/data/realms'
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
  EQUIP_BASE_FACTOR,
  EQUIP_LEVEL_BONUS,
  EQUIP_QUALITY_FLAT_EXP,
  EXP_BASE,
  EXP_MAJOR_GROWTH,
  EXP_SUB_GROWTH,
  LATE_COMBAT_GROWTH,
  LATE_EXP_GROWTH,
  SOFT_CAPS,
  WORLD_STEP_EXP_MULT
} from '@/data/constants'
import { WORLD_BREAK_MAJOR } from '@/data/realms'
import { baseCombatStats, breakthroughBaseRate, expRequirement, powerScale } from './formulas'
import { mergeMods } from './statsCalc'
import { AFFIXES, affixValue } from '@/data/affixes'
import { QUALITIES } from '@/data/qualities'
import { EQUIPMENT_TEMPLATES } from '@/data/equipment'
import { equipTemplatePool, resolveEquipStats } from './equipGen'
import { ENEMIES } from '@/data/enemies'
import { REGIONS, unlockClosure } from '@/data/regions'
import { STAT_NAMES } from '@/ui/statNames'
import { createRng } from '@engine/rng'

/** GNum(m × 10^e)→ number */
const num = (v: GNum | number): number => (typeof v === 'number' ? v : v.m * Math.pow(10, v.e))

const relClose = (a: number, b: number, rtol = 1e-9): void => {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  expect(Math.abs(a - b) / scale).toBeLessThan(rtol)
}

const DROP_SLOTS = ['weapon', 'head', 'body', 'wrist', 'belt', 'boots', 'necklace', 'ring', 'talisman'] as const

// ============ 等级 ============

const REALM_CONFIG: RealmSystemConfig = {
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
  lifespan: { byWorld: Object.fromEntries(Object.entries(LIFESPAN_WORLDS).map(([id, cfg]) => [id, { base: cfg.base, growth: cfg.growth }])) }
}

describe('对账 · 等级体系', () => {
  const system = createRealmSystem(REALM_CONFIG)

  it('境界名、界域划分、序号与游戏一致', () => {
    expect(system.realms.map(r => r.name)).toEqual(REALMS.map(r => r.name))
    expect(system.realms.map(r => r.id)).toEqual(REALMS.map(r => r.id))
    expect(system.worlds.map(w => [w.id, w.start, w.end])).toEqual(WORLDS.map(w => [w.id, w.start, w.end]))
    expect(system.maxMajor).toBe(REALMS.length - 1)
  })

  it('小层名与完整境界名逐条一致', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(system.label(major, sub)).toBe(realmLabel(major, sub))
      }
    }
  })

  it('寿元逐境一致', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      expect(system.lifespanOf(major)).toBe(lifespanOf(major))
      expect(system.realmAt(major).lifespanYears).toBe(REALMS[major]!.lifespanYears)
    }
  })

  it('修为需求逐境逐层一致(含跨界那一层的加价)', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        relClose(num(system.expCost(major, sub)), num(expRequirement(major, sub)), 1e-9)
      }
    }
  })

  it('基础战斗三维逐境逐层一致', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        const mine = system.baseStats(major, sub)
        const game = baseCombatStats(major, sub)
        relClose(num(mine.attack!), num(game.attack), 1e-9)
        relClose(num(mine.defense!), num(game.defense), 1e-9)
        relClose(num(mine.maxHp!), num(game.maxHp), 1e-9)
      }
    }
  })

  it('进阶成功率逐境逐层一致', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(system.breakthroughRate(major, sub)).toBeCloseTo(breakthroughBaseRate(major, sub), 12)
      }
    }
  })
})

// ============ 属性 ============

/** 用游戏的 STAT_NAMES 与递减/软阈值表装出一份属性定义 —— 与游戏同口径 */
function realAttributeDefs(): AttributeDef[] {
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

describe('对账 · 属性合并规则', () => {
  const system = createAttributeSystem({ defs: realAttributeDefs() })

  it('覆盖到游戏登记过的每一个词条键', () => {
    for (const key of Object.keys(STAT_NAMES)) expect(system.def(key)).toBeDefined()
  })

  it('同一批来源,合并结果逐键一致(含递减与软阈值)', () => {
    const rng = createRng(2026)
    const keys = ['attackPct', 'defensePct', 'maxHpPct', 'critRate', 'critDamage', 'damageBonus', 'damageReduction', 'counterRate', 'shieldOnStart', 'firstStrike', 'lifesteal', 'speed', 'cultivationSpeed', 'dodgeRate', 'luck']
    for (let round = 0; round < 200; round += 1) {
      const sources: Record<string, number>[] = []
      const sourceCount = rng.int(1, 5)
      for (let i = 0; i < sourceCount; i += 1) {
        const src: Record<string, number> = {}
        for (const key of keys) {
          if (rng.chance(0.4)) src[key] = rng.float(0, key === 'critRate' || key === 'dodgeRate' ? 0.6 : 0.5)
        }
        sources.push(src)
      }
      const mine = system.mergeMods(sources)
      const game = mergeMods(sources as never)
      for (const key of keys) {
        const a = mine[key] ?? 0
        const b = game[key as keyof typeof game] ?? 0
        expect(a).toBeCloseTo(b as number, 9)
      }
    }
  })
})

// ============ 装备 ============

const EQUIPMENT_CONFIG = {
  slots: DROP_SLOTS.map((id, i) => ({ id, name: id, order: i })),
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
  power: {
    tierGrowth: 1,
    baseFactor: EQUIP_BASE_FACTOR,
    qualityExponent: EQUIP_QUALITY_FLAT_EXP,
    levelBonus: EQUIP_LEVEL_BONUS,
    // 直接给出每一层的战力系数 —— 与游戏的 powerScale 同一张表,
    // 于是两边的平铺数值可以逐个对账(指数式是给新游戏的默认,不是唯一写法)
    tierFactors: Array.from({ length: Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier)) }, (_, i) => num(powerScale(i + 1)))
  },
  affixValueScale: 100
}

describe('对账 · 装备系统', () => {
  const system = createEquipmentSystem(EQUIPMENT_CONFIG)

  it('模板与品质表逐条搬进来,没有丢件', () => {
    expect(system.qualities.length).toBe(QUALITIES.length)
    for (const q of QUALITIES) {
      const mine = system.quality(q.id)
      expect([mine.name, mine.rank, mine.mult, mine.affixes, mine.weight]).toEqual([q.name, q.rank, q.mult, q.affixes, q.weight])
    }
    const dropTemplates = EQUIPMENT_TEMPLATES.filter(t => (DROP_SLOTS as readonly string[]).includes(t.slot))
    expect(system.poolAtTier(1, 'weapon').length).toBeGreaterThan(0)
    expect(system.template(dropTemplates[0]!.id)?.name).toBe(dropTemplates[0]!.name)
  })

  it('每层每部位的掉落池与 equipTemplatePool 完全一致(逐 id 比)', () => {
    const maxTier = Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier))
    for (let tier = 1; tier <= maxTier; tier += 1) {
      for (const slot of DROP_SLOTS) {
        const mine = system.templatesAtTier(tier, slot).map(t => t.id)
        const game = equipTemplatePool(tier, slot).map(t => t.id)
        expect(mine).toEqual(game)
      }
      expect(system.poolAtTier(tier).map(t => t.id)).toEqual(equipTemplatePool(tier).map(t => t.id))
    }
  })

  it('词条数值逐条一致(roll 0 / 0.25 / 0.5 / 0.75 / 1)', () => {
    for (const def of AFFIXES) {
      const mine = system.affix(def.id)!
      expect(mine.name).toBe(def.name)
      expect(mine.minRank).toBe(def.minRank)
      expect(mine.slots).toEqual(def.slots)
      for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
        expect(system.affixValue(mine, roll)).toBe(affixValue(def, roll))
      }
    }
  })

  it('品质抽取权重与游戏同口径(同一 tiers 下同序)', () => {
    for (const tier of [1, 5, 13, 21, 30]) {
      for (const q of QUALITIES) {
        const mine = system.qualityWeightAt(system.quality(q.id), tier, { tier })
        const gameRankWeight = q.weight
        const distance = Math.max(0, q.fromTier - tier, tier - q.toTier)
        const band = distance === 0 ? 1 : Math.pow(0.1, distance)
        if (q.rank === 0) {
          expect(mine).toBeCloseTo(gameRankWeight * band, 9)
          continue
        }
        const expected = q.weight * Math.pow(1.18, (tier - 1) * Math.min(q.rank, 4) * 0.35) * band
        expect(mine).toBeCloseTo(expected, 6)
      }
    }
  })

  it('解析一件装备:平铺数值 = 基数 × 层级系数 × 品质倍率,固有词条照搬', () => {
    const template = EQUIPMENT_TEMPLATES.find(t => t.slot === 'weapon' && t.fixedMods)!
    const instance = { uid: 'u1', templateId: template.id, qualityId: 'divine', tier: template.tier, level: 0, affixes: [] }
    const resolved = system.resolve(instance)
    const tierFactor = num(powerScale(template.tier))
    const expected = (template.base.attack ?? 0) * tierFactor * EQUIP_BASE_FACTOR * 9.5 ** EQUIP_QUALITY_FLAT_EXP
    relClose(Number(resolved.flats.attack), expected, 1e-9)
    expect(resolved.mods).toEqual(template.fixedMods!)
  })

  it('同一件装备的平铺与词条结算,与游戏的 resolveEquipStats 逐项一致', () => {
    const samples = EQUIPMENT_TEMPLATES.filter(t => (DROP_SLOTS as readonly string[]).includes(t.slot)).filter((_, i) => i % 7 === 0)
    const affixes = [
      { id: 'atk1', roll: 0.37 },
      { id: 'crit1', roll: 0.8 },
      { id: 'qi1', roll: 0.15 }
    ]
    for (const template of samples) {
      for (const quality of ['mortal', 'fine', 'divine']) {
        for (const level of [0, 5]) {
          const mine = system.resolve({ uid: 'u', templateId: template.id, qualityId: quality, tier: template.tier, level, affixes })
          const game = resolveEquipStats({ uid: 'u', templateId: template.id, quality: quality as QualityId, tier: template.tier, level, affixes })
          relClose(Number(mine.flats.attack ?? 0), num(game.flats.attack), 1e-9)
          relClose(Number(mine.flats.defense ?? 0), num(game.flats.defense), 1e-9)
          relClose(Number(mine.flats.maxHp ?? 0), num(game.flats.maxHp), 1e-9)
          const keys = new Set([...Object.keys(mine.mods), ...Object.keys(game.mods)])
          for (const key of keys) {
            expect(mine.mods[key] ?? 0, `${template.id}/${quality}/${key}`).toBeCloseTo((game.mods as Record<string, number>)[key] ?? 0, 10)
          }
          expect(mine.affixLines.map(l => l.value)).toEqual(game.affixLines.map(l => l.value))
        }
      }
    }
  })
})

// ============ 副本 ============

const DUNGEON_CONFIG: GameConfig['dungeons'] = {
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
  }))
}

describe('对账 · 副本系统', () => {
  const system = createDungeonSystem(DUNGEON_CONFIG)

  it('区域表逐条一致,且引用的敌人都存在', () => {
    expect(system.regions.length).toBe(REGIONS.length)
    for (const r of REGIONS) {
      const mine = system.region(r.id)!
      expect([mine.name, mine.tier, mine.minRealm, mine.boss, mine.requireCleared]).toEqual([r.name, r.tier, r.minRealm, r.boss, r.requireCleared])
      expect(mine.enemies).toEqual(r.enemies)
      expect(system.enemy(r.boss)).toBeDefined()
      for (const id of r.enemies) expect(system.enemy(id)).toBeDefined()
    }
  })

  it('敌人表逐条一致(数值与首领标记)', () => {
    expect(system.enemies.length).toBe(ENEMIES.length)
    for (const e of ENEMIES) {
      const mine = system.enemy(e.id)!
      expect([mine.name, mine.tier, mine.hpMult, mine.atkMult, mine.defMult, mine.speed, mine.boss === true]).toEqual([
        e.name,
        e.tier,
        e.hpMult,
        e.atkMult,
        e.defMult,
        e.speed,
        e.isBoss === true
      ])
    }
  })

  it('解锁口径与 unlockClosure 一致(若干存档状态逐一比)', () => {
    const cases: string[][] = [[], ['qingyun'], ['qingyun', 'luoxia'], ['qingyun', 'luoxia', 'heifeng'], ['luoxia'], ['guzhanchang', 'qingyun']]
    for (const cleared of cases) {
      const progress = { cleared, bossWins: {}, runs: {} }
      const mine = system.unlocked(progress, 99).map(r => r.id)
      const game = unlockClosure(['qingyun'], cleared)
      expect(mine).toEqual(game)
    }
  })

  it('等级门槛:同一份通关记录,等级不到就开不了那张图', () => {
    const gated = REGIONS.find(r => r.requireCleared !== undefined && r.minRealm > 0)!
    // 前置链要整段带上:只给直接前置,那个前置自己还没解锁
    const cleared = ['qingyun', gated.requireCleared!]
    const progress = { cleared, bossWins: {}, runs: {} }
    const low = system.unlocked(progress, 0).map(r => r.id)
    expect(low).toContain(gated.requireCleared!)
    expect(low).not.toContain(gated.id)
    expect(system.unlocked(progress, gated.minRealm).map(r => r.id)).toContain(gated.id)
  })
})
