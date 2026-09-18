/**
 * 公共库与游戏本体的**对账**。
 *
 * 本作的曲线已经改成走库(core/formulas 转发到 core/engineWorld),所以这份判据
 * 不能拿 app 现在的函数去比 —— 那是拿自己证明自己。做法是:
 *
 *   ① 等级曲线:与**迁移前冻结的旧口径**(下面 ref* 三个函数)逐条比,且是
 *      `toEqual`(GNum 精确相等),不是"差不多";
 *   ② 「迁移接线」一节:证明 app 的 formulas 确实经库计算,且与冻结口径一致;
 *   ③ 属性/装备/副本三套:与 app 里**尚未迁移**的实现(statsCalc / equipGen / regions)
 *      逐条比 —— 它们仍是各自独立的实现,故这份对账仍有意义。
 *
 * 内容可以重写,机制不能悄悄漂移。哪天有人只改了一边,这里会红。
 */
import { describe, expect, it } from 'vitest'
import type { AttributeDef } from '@engine/index'
import { attributeDefs } from '@engine/index'
import { createRng } from '@engine/rng'
import type { GNum, QualityId } from '@/types'
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
  EXP_BASE,
  EXP_MAJOR_GROWTH,
  EXP_SUB_GROWTH,
  EXPLORE_BOSS_AFTER_WINS,
  LATE_COMBAT_GROWTH,
  LATE_EXP_GROWTH,
  SOFT_CAPS,
  SUB_LEVELS,
  WORLD_STEP_EXP_MULT
} from '@/data/constants'
import { LIFESPAN_WORLDS, MAX_MAJOR, REALMS, SUB_NAMES, WORLDS, WORLD_BREAK_MAJOR, isWorldEntry, lifespanOf, realmLabel } from '@/data/realms'
import { mul, mulN, powN } from '@/utils/gnum'
import { baseCombatStats, breakthroughBaseRate, expRequirement, powerScale } from './formulas'
import { mergeMods } from './statsCalc'
import { isSoftCapped, mergeModsDetailed, modDepth } from './statsCalc'
import { AFFIXES } from '@/data/affixes'
import { QUALITIES } from '@/data/qualities'
import { EQUIPMENT_TEMPLATES } from '@/data/equipment'
import { generateEquipment, resolveEquipStats } from './equipGen'
import { winsUntilRegionBoss } from './exploration'
import { ENEMIES } from '@/data/enemies'
import { REGIONS } from '@/data/regions'
import { STAT_NAMES } from '@/ui/statNames'
import { mulberry32, RandomService } from '@/utils/random'
import { QUALITY_OUT_OF_BAND, QUALITY_TIER_SHIFT } from '@/data/constants'
import type { EquipmentInstance, EquipSlot, QualityDef } from '@/types'
import { uid as newUid } from '@/utils/id'
import { add as gnAdd, mulN as gnMulN } from '@/utils/gnum'
import { equipmentTemplate } from '@/data/equipment'
import { affixDef as realAffixDef } from '@/data/affixes'
import { qualityDef as realQualityDef } from '@/data/qualities'
import { EQUIP_BASE_FACTOR, EQUIP_LEVEL_BONUS, EQUIP_QUALITY_FLAT_EXP } from '@/data/constants'
import { powerScale as realPowerScale } from './tierScale'
import { gnZero } from '@/utils/gnum'
import type { ResolvedEquipStats } from './equipGen'
import { ENGINE_WORLD, ENGINE_WORLD_CONFIG } from './engineWorld'
import { activeSets, hasActiveSet, setCounts } from './equipSet'
import { equipmentTemplate as realTemplate } from '@/data/equipment'

/**
 * 对账就用**应用运行时那一份**世界对象(ENGINE_WORLD),不再另装一份:
 * 属性合并、装备生成与解析、副本规则都不依赖具体数值类型,
 * 于是"判据比的就是玩家真正跑到的东西",没有中间层可以掩盖差异。
 */
const NUM_WORLD = ENGINE_WORLD

// ============ 迁移前冻结的旧口径(不得 import core/formulas) ============

function refEarlyLate(major: number): { early: number; late: number } {
  const early = Math.min(Math.max(0, major), WORLD_BREAK_MAJOR)
  return { early, late: Math.max(0, major - early) }
}

function refIsWorldStepLayer(major: number, sub: number): boolean {
  return sub >= SUB_LEVELS - 1 && major < MAX_MAJOR && isWorldEntry(major + 1)
}

/** 迁移前 core/formulas.expRequirement 的原式 */
function refExpRequirement(major: number, sub: number): GNum {
  const { early, late } = refEarlyLate(major)
  const majorFactor = mul(powN(EXP_MAJOR_GROWTH, early), powN(LATE_EXP_GROWTH, late))
  const stepMult = refIsWorldStepLayer(major, sub) ? WORLD_STEP_EXP_MULT : 1
  return mulN(mul(majorFactor, powN(EXP_SUB_GROWTH, sub)), EXP_BASE * stepMult)
}

/** 迁移前 core/formulas.realmScale + baseCombatStats 的原式 */
function refBaseCombatStats(major: number, sub: number): { attack: GNum; defense: GNum; maxHp: GNum } {
  const { early, late } = refEarlyLate(major)
  const scale = mul(mul(powN(COMBAT_MAJOR_GROWTH, early), powN(LATE_COMBAT_GROWTH, late)), powN(COMBAT_SUB_GROWTH, sub))
  return {
    attack: mulN(scale, COMBAT_ATK_BASE),
    defense: mulN(scale, COMBAT_DEF_BASE),
    maxHp: mulN(scale, COMBAT_HP_BASE)
  }
}

/** 迁移前 core/formulas.breakthroughBaseRate 的原式 */
function refBreakthroughBaseRate(major: number, sub: number): number {
  const isMajorStep = sub >= SUB_LEVELS - 1
  const raw = isMajorStep ? BT_MAJOR_BASE_RATE - major * BT_MAJOR_DECAY : BT_SUB_BASE_RATE - sub * BT_SUB_DECAY
  return Math.max(BT_MIN_RATE, Math.min(BT_MAX_RATE, raw))
}

// ---- 迁移前 core/equipGen 的生成路径(池子 / 品质权重 / 掷品质 / 生成实例) ----

const REF_DROP_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'wrist', 'belt', 'boots', 'necklace', 'ring', 'talisman']

function refTemplatesAtTier(tier: number, slot: EquipSlot) {
  return EQUIPMENT_TEMPLATES.filter(t => t.tier === tier && t.slot === slot)
}

function refTemplatesForDrop(tier: number, slot: EquipSlot) {
  const here = refTemplatesAtTier(tier, slot)
  if (here.length > 0) return here
  const tiers = [...new Set(EQUIPMENT_TEMPLATES.filter(t => t.slot === slot).map(t => t.tier))].sort((a, b) => b - a)
  const fallback = tiers.find(t => t < tier) ?? tiers[tiers.length - 1]
  return fallback === undefined ? [] : refTemplatesAtTier(fallback, slot)
}

function refEquipTemplatePool(tier: number, slot?: EquipSlot) {
  if (slot !== undefined) return refTemplatesForDrop(tier, slot)
  return REF_DROP_SLOTS.flatMap(s => refTemplatesForDrop(tier, s))
}

function refBandFactor(q: QualityDef, tier: number, opts: { minQualityRank?: number }): number {
  if (opts.minQualityRank !== undefined) return 1
  const distance = Math.max(0, q.fromTier - tier, tier - q.toTier)
  return distance === 0 ? 1 : Math.pow(QUALITY_OUT_OF_BAND, distance)
}

function refQualityWeightAt(q: QualityDef, tier: number, opts: { luck?: number; minQualityRank?: number } = {}): number {
  const luck = opts.luck ?? 0
  if (q.rank === 0) return q.weight * refBandFactor(q, tier, opts)
  const tierBoost = Math.pow(QUALITY_TIER_SHIFT, (tier - 1) * Math.min(q.rank, 4) * 0.35)
  const luckBoost = 1 + luck * (q.rank >= 3 ? 1.5 : 0.5)
  return q.weight * tierBoost * luckBoost * refBandFactor(q, tier, opts)
}

function refRollQuality(tier: number, rng: RandomService, opts: { minQualityRank?: number; luck?: number } = {}): QualityDef {
  const floor = opts.minQualityRank ?? 0
  const pool = QUALITIES.filter(q => q.rank >= floor)
  return rng.weighted(pool, q => refQualityWeightAt(q, tier, opts))
}

function refGenerateEquipment(
  tier: number,
  rng: RandomService,
  opts: { slot?: EquipSlot; minQualityRank?: number; luck?: number } = {}
): EquipmentInstance {
  const slot = opts.slot ?? REF_DROP_SLOTS[Math.min(REF_DROP_SLOTS.length - 1, rng.int(0, REF_DROP_SLOTS.length - 1))]!
  const eligible = refEquipTemplatePool(tier, slot)
  const template = rng.weighted(eligible, () => 1)
  const quality = refRollQuality(tier, rng, opts)
  const [minA, maxA] = quality.affixes
  const affixCount = rng.int(minA, maxA)
  const chosen: { id: string; roll: number }[] = []
  const used = new Set<string>()
  let guard = 0
  while (chosen.length < affixCount && guard < 50) {
    guard += 1
    const candidates = AFFIXES.filter(
      a =>
        !used.has(a.id) &&
        (a.minRank === undefined || quality.rank >= a.minRank) &&
        (a.slots === undefined || a.slots.includes(template.slot))
    )
    if (candidates.length === 0) break
    const picked = rng.weighted(candidates, a => a.weight)
    used.add(picked.id)
    chosen.push({ id: picked.id, roll: rng.next() })
  }
  return { uid: newUid(), templateId: template.id, quality: quality.id, tier, level: 0, affixes: chosen }
}

// ---- 迁移前 data/regions 的解锁补票 与 core/exploration 的首领门槛 ----

/** 迁移前 data/regions.unlockClosure 的原式(含 while(grew) 的不动点写法) */
function refUnlockClosure(unlocked: readonly string[], cleared: readonly string[]): string[] {
  const out = [...unlocked]
  const have = new Set(out)
  const beaten = new Set(cleared)
  let grew = true
  while (grew) {
    grew = false
    for (const region of REGIONS) {
      if (have.has(region.id) || !region.requireCleared) continue
      if (!beaten.has(region.requireCleared)) continue
      have.add(region.id)
      out.push(region.id)
      grew = true
    }
  }
  return out
}

/** 迁移前 core/exploration.winsUntilRegionBoss 的原式 */
function refWinsUntilRegionBoss(wins: number, cleared: boolean): number | null {
  if (cleared) return null
  return Math.max(0, EXPLORE_BOSS_AFTER_WINS - wins)
}

/** 迁移前 data/affixes.affixValue 的原式(词条数值 = min + (max-min) × roll,按小数位取整) */
function refAffixValue(def: { min: number; max: number; decimals: number }, roll: number): number {
  const v = def.min + (def.max - def.min) * Math.max(0, Math.min(1, roll))
  const f = Math.pow(10, def.decimals)
  return Math.round(v * f) / f
}

/** 迁移前 core/equipSet 的统计口径(直接按数组里的件数计,不看槽位) */
function refSetCounts(equipped: EquipmentInstance[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const it of equipped) {
    const tpl = realTemplate(it.templateId)
    if (tpl?.set) counts.set(tpl.set, (counts.get(tpl.set) ?? 0) + 1)
  }
  return counts
}

function refActiveSetIds(equipped: EquipmentInstance[]): string[] {
  const out: string[] = []
  for (const [setId, n] of refSetCounts(equipped)) {
    // 本作五套共鸣的 required 都是 2
    if (n >= 2) out.push(setId)
  }
  return out.sort()
}

/** 迁移前 core/equipGen.resolveEquipStats 的原式(平铺 / 固有词条 / 随机词条 / 展示行) */
function refResolveEquipStats(inst: EquipmentInstance): ResolvedEquipStats {
  const rarityRank: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }
  const template = equipmentTemplate(inst.templateId)
  const flats = { attack: gnZero(), defense: gnZero(), maxHp: gnZero() }
  const mods: Record<string, number> = {}
  const affixLines: ResolvedEquipStats['affixLines'] = []
  if (!template) return { flats, mods, affixLines }

  const q = realQualityDef(inst.quality)
  const scale = realPowerScale(inst.tier)
  const factor = EQUIP_BASE_FACTOR * Math.pow(q.mult, EQUIP_QUALITY_FLAT_EXP) * (1 + inst.level * EQUIP_LEVEL_BONUS)

  for (const key of ['attack', 'defense', 'maxHp'] as const) {
    const weight = template.base[key]
    if (weight) flats[key] = gnAdd(flats[key], gnMulN(scale, weight * factor))
  }
  if (template.fixedMods) {
    for (const k in template.fixedMods) mods[k] = (mods[k] ?? 0) + ((template.fixedMods as Record<string, number>)[k] ?? 0)
  }
  const sorted = [...inst.affixes].sort((a, b) => {
    const ra = rarityRank[realAffixDef(a.id)?.rarity ?? 'common']!
    const rb = rarityRank[realAffixDef(b.id)?.rarity ?? 'common']!
    return rb - ra || b.roll - a.roll || a.id.localeCompare(b.id)
  })
  for (const roll of sorted) {
    const def = realAffixDef(roll.id)
    if (!def) continue
    const value = refAffixValue(def, roll.roll)
    mods[def.key] = (mods[def.key] ?? 0) + value / 100
    const [before = '', after = ''] = def.desc.split('{v}')
    affixLines.push({ id: def.id, name: def.name, desc: def.desc.replace('{v}', String(value)), before, value: String(value), after, rarity: def.rarity })
  }
  return { flats, mods, affixLines }
}

// ============ 等级 ============

describe('对账 · 等级体系(库 与 冻结的旧口径)', () => {
  const system = ENGINE_WORLD.realms

  it('名目、序号与寿元都取自 data,库没有改写它们', () => {
    expect(system.realms.map(r => r.name)).toEqual(REALMS.map(r => r.name))
    expect(system.realms.map(r => r.id)).toEqual(REALMS.map(r => r.id))
    expect(system.realms.map(r => r.lifespanYears)).toEqual(REALMS.map(r => r.lifespanYears))
    expect(system.worlds.map(w => [w.id, w.start, w.end])).toEqual(WORLDS.map(w => [w.id, w.start, w.end]))
    expect(system.maxMajor).toBe(REALMS.length - 1)
    expect(Object.keys(LIFESPAN_WORLDS).length).toBe(4)
  })

  it('完整境界名与 data/realms 的 realmLabel 逐条相同', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(system.label(major, sub)).toBe(realmLabel(major, sub))
      }
    }
  })

  it('寿元逐境相同(realms 里那份寿命表尚未迁移)', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      expect(system.lifespanOf(major)).toBe(lifespanOf(major))
    }
  })

  it('修为需求逐境逐层与冻结口径精确相等(含跨界那一层的加价)', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(system.expCost(major, sub), `${major}-${sub}`).toEqual(refExpRequirement(major, sub))
      }
    }
  })

  it('基础战斗三维逐境逐层与冻结口径精确相等', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        const mine = system.baseStats(major, sub)
        const ref = refBaseCombatStats(major, sub)
        expect(mine.attack, `${major}-${sub}-atk`).toEqual(ref.attack)
        expect(mine.defense, `${major}-${sub}-def`).toEqual(ref.defense)
        expect(mine.maxHp, `${major}-${sub}-hp`).toEqual(ref.maxHp)
      }
    }
  })

  it('进阶成功率逐境逐层与冻结口径相同', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(system.breakthroughRate(major, sub)).toBe(refBreakthroughBaseRate(major, sub))
      }
    }
  })
})

describe('迁移接线 · app 的 formulas 确实经库计算', () => {
  const system = ENGINE_WORLD.realms

  it('expRequirement / baseCombatStats / breakthroughBaseRate 与库同一份结果', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(expRequirement(major, sub)).toEqual(system.expCost(major, sub))
        const stats = system.baseStats(major, sub)
        expect(baseCombatStats(major, sub)).toEqual({ attack: stats.attack, defense: stats.defense, maxHp: stats.maxHp })
        expect(breakthroughBaseRate(major, sub)).toBe(system.breakthroughRate(major, sub))
      }
    }
  })

  it('转发之后数字没变:app 的四个函数与冻结口径一致', () => {
    for (let major = 0; major < REALMS.length; major += 1) {
      for (let sub = 0; sub < SUB_NAMES.length; sub += 1) {
        expect(expRequirement(major, sub)).toEqual(refExpRequirement(major, sub))
        expect(baseCombatStats(major, sub)).toEqual(refBaseCombatStats(major, sub))
        expect(breakthroughBaseRate(major, sub)).toBe(refBreakthroughBaseRate(major, sub))
      }
    }
  })

  it('库里的层级战力表就是 core/tierScale.powerScale 的那张表', () => {
    const factors = ENGINE_WORLD_CONFIG.equipment.power.tierFactors ?? []
    const maxTier = Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier))
    expect(factors.length).toBe(maxTier)
    // 表里就是 GNum(宿主的大数),故这里是**精确相等**,不是"接近"
    for (let tier = 1; tier <= factors.length; tier += 1) {
      expect(factors[tier - 1]!).toEqual(powerScale(tier))
    }
  })
})

// ============ 属性 ============

/** 用游戏的 STAT_NAMES 与递减/软阈值表装出一份属性定义 —— 与 app 的 statsCalc 同口径 */
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

/** 迁移前 core/statsCalc.mergeModsDetailed 的原式(含递减与软阈值两道折算) */
function refMergeModsDetailed(sources: Record<string, number>[]): { mods: Record<string, number>; effective: Record<string, number>[] } {
  const out: Record<string, number> = {}
  const effective: Record<string, number>[] = sources.map(() => ({}))
  const diminished = new Map<string, { src: number; value: number }[]>()
  sources.forEach((src, si) => {
    for (const key in src) {
      const v = src[key]
      if (typeof v !== 'number' || v === 0) continue
      if (v > 0 && (DIMINISH_KEYS as readonly string[]).includes(key)) {
        const list = diminished.get(key)
        if (list) list.push({ src: si, value: v })
        else diminished.set(key, [{ src: si, value: v }])
      } else {
        out[key] = (out[key] ?? 0) + v
        effective[si]![key] = v
      }
    }
  })
  for (const [key, list] of diminished) {
    list.sort((a, b) => b.value - a.value)
    let sum = out[key] ?? 0
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i]!
      const counted = entry.value * (DIMINISH_WEIGHTS[Math.min(i, DIMINISH_WEIGHTS.length - 1)] ?? 0.25)
      sum += counted
      const bucket = effective[entry.src]!
      bucket[key] = (bucket[key] ?? 0) + counted
    }
    out[key] = sum
  }
  for (const key in SOFT_CAPS) {
    const rule = SOFT_CAPS[key as keyof typeof SOFT_CAPS]
    const v = out[key]
    if (rule && typeof v === 'number' && v > rule.cap) {
      const scaled = rule.cap + (v - rule.cap) * rule.diminish
      const factor = scaled / v
      for (const bucket of effective) {
        const own = bucket[key]
        if (typeof own === 'number' && own !== 0) bucket[key] = own * factor
      }
      out[key] = scaled
    }
  }
  return { mods: out, effective }
}

describe('对账 · 属性合并规则(库 与 冻结的旧口径)', () => {
  const system = NUM_WORLD.attributes

  it('覆盖到游戏登记过的每一个词条键', () => {
    for (const key of Object.keys(STAT_NAMES)) expect(system.def(key)).toBeDefined()
    expect([...system.defs.map(d => d.key)].sort()).toEqual([...realAttributeDefs().map(d => d.key)].sort())
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
      const ref = refMergeModsDetailed(sources)
      expect(Object.keys(mine).sort()).toEqual(Object.keys(ref.mods).sort())
      for (const key of Object.keys(ref.mods)) {
        expect(mine[key] ?? 0, `round ${round} · ${key}`).toBeCloseTo(ref.mods[key]!, 12)
      }
    }
  })

  it('来源明细也一致:两道折算都摊回来源,明细之和等于合计', () => {
    const rng = createRng(77)
    const keys = ['critRate', 'dodgeRate', 'counterRate', 'shieldOnStart', 'firstStrike', 'attackPct', 'lifesteal']
    for (let round = 0; round < 200; round += 1) {
      const sources: Record<string, number>[] = []
      for (let i = 0, n = rng.int(1, 5); i < n; i += 1) {
        const src: Record<string, number> = {}
        for (const key of keys) if (rng.chance(0.5)) src[key] = rng.float(0, 0.6)
        sources.push(src)
      }
      const mine = system.mergeModsDetailed(sources)
      const ref = refMergeModsDetailed(sources)
      expect(mine.effective.length).toBe(ref.effective.length)
      for (let i = 0; i < ref.effective.length; i += 1) {
        const a = mine.effective[i] ?? {}
        const b = ref.effective[i]!
        expect(Object.keys(a).sort(), `round ${round} · row ${i}`).toEqual(Object.keys(b).sort())
        for (const key of Object.keys(b)) expect(a[key] ?? 0).toBeCloseTo(b[key]!, 12)
      }
      for (const key of Object.keys(ref.mods)) expect(mine.mods[key] ?? 0).toBeCloseTo(ref.mods[key]!, 12)
    }
  })

  it('迁移接线:statsCalc 的合并与判定都经库计算', () => {
    const sources = [{ critRate: 0.5 }, { critRate: 0.45, attackPct: 0.2 }]
    const detailed = mergeModsDetailed(sources)
    expect(detailed.mods).toEqual(system.mergeModsDetailed(sources).mods)
    expect(detailed.effective).toEqual(system.mergeModsDetailed(sources).effective)
    expect(mergeMods(sources)).toEqual(system.mergeMods(sources))
    expect(isSoftCapped(detailed.mods, 'critRate')).toBe(system.isSoftCapped(detailed.mods, 'critRate'))
    expect(modDepth(detailed.mods)).toBe(system.modDepth(detailed.mods))
    expect(modDepth({ attackPct: 0.5, critRate: 0.1, dodgeRate: 0.05, cultivationSpeed: 0.3 })).toBeCloseTo(0.15, 12)
  })
})

// ============ 装备 ============

const DROP_SLOTS = ['weapon', 'head', 'body', 'wrist', 'belt', 'boots', 'necklace', 'ring', 'talisman'] as const

describe('对账 · 装备系统(库 与 尚未迁移的 equipGen)', () => {
  const system = NUM_WORLD.equipment

  it('模板与品质表逐条搬进来,没有丢件', () => {
    expect(system.qualities.length).toBe(QUALITIES.length)
    for (const q of QUALITIES) {
      const mine = system.quality(q.id)
      expect([mine.name, mine.rank, mine.mult, mine.affixes, mine.weight]).toEqual([q.name, q.rank, q.mult, q.affixes, q.weight])
    }
    expect(system.template(EQUIPMENT_TEMPLATES[0]!.id)?.name).toBe(EQUIPMENT_TEMPLATES[0]!.name)
  })

  it('每层每部位的掉落池与冻结的旧池子完全一致(逐 id 比)', () => {
    const maxTier = Math.max(...EQUIPMENT_TEMPLATES.map(t => t.tier))
    for (let tier = 1; tier <= maxTier; tier += 1) {
      for (const slot of DROP_SLOTS) {
        expect(system.templatesAtTier(tier, slot).map(t => t.id)).toEqual(refEquipTemplatePool(tier, slot).map(t => t.id))
      }
      expect(system.poolAtTier(tier).map(t => t.id)).toEqual(refEquipTemplatePool(tier).map(t => t.id))
    }
  })

  it('品质权重与冻结口径逐档相同(含窗口、气运与强制下限)', () => {
    for (const tier of [1, 3, 9, 16, 24, 30]) {
      for (const q of QUALITIES) {
        const mine = system.qualityWeightAt(system.quality(q.id), tier, { tier })
        expect(mine, `tier ${tier} · ${q.id}`).toBe(refQualityWeightAt(q, tier))
        const lucky = system.qualityWeightAt(system.quality(q.id), tier, { tier, luck: 0.4 })
        expect(lucky, `tier ${tier} · ${q.id} · luck`).toBe(refQualityWeightAt(q, tier, { luck: 0.4 }))
        const floored = system.qualityWeightAt(system.quality(q.id), tier, { tier, minQualityRank: 3 })
        expect(floored, `tier ${tier} · ${q.id} · floor`).toBe(refQualityWeightAt(q, tier, { minQualityRank: 3 }))
      }
    }
  })

  it('生成一件装备:与冻结口径逐字段相同,且**消耗同样多的随机数**', () => {
    const strip = (inst: EquipmentInstance): Record<string, unknown> => {
      const copy: Record<string, unknown> = { ...inst }
      delete copy.uid
      return copy
    }
    const cases: { tier: number; opts: { slot?: EquipSlot; luck?: number; minQualityRank?: number } }[] = [
      { tier: 1, opts: {} },
      { tier: 1, opts: { slot: 'weapon' } },
      { tier: 7, opts: { luck: 0.5 } },
      { tier: 13, opts: { slot: 'body', minQualityRank: 4 } },
      { tier: 25, opts: {} },
      { tier: 32, opts: { minQualityRank: 8 } }
    ]
    for (const { tier, opts } of cases) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const mineRng = new RandomService(mulberry32(seed))
        const refRng = new RandomService(mulberry32(seed))
        const mine = generateEquipment(tier, mineRng, opts)
        const ref = refGenerateEquipment(tier, refRng, opts)
        expect(strip(mine), `tier ${tier} seed ${seed}`).toEqual(strip(ref))
        // 随机流状态也要一致:否则同一种子后面所有掉落都会整体错位
        expect(mineRng.next(), `tier ${tier} seed ${seed} · 随机流`).toBe(refRng.next())
      }
    }
  })

  it('词条数值逐条一致(roll 0 / 0.25 / 0.5 / 0.75 / 1)', () => {
    for (const def of AFFIXES) {
      const mine = system.affix(def.id)!
      expect(mine.name).toBe(def.name)
      expect(mine.minRank).toBe(def.minRank)
      expect(mine.slots).toEqual(def.slots)
      for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
        expect(system.affixValue(mine, roll)).toBe(refAffixValue(def, roll))
      }
    }
  })

  it('品质抽取权重与游戏同口径', () => {
    for (const tier of [1, 5, 13, 21, 30]) {
      for (const q of QUALITIES) {
        const mine = system.qualityWeightAt(system.quality(q.id), tier, { tier })
        const distance = Math.max(0, q.fromTier - tier, tier - q.toTier)
        const band = distance === 0 ? 1 : Math.pow(0.1, distance)
        const expected =
          q.rank === 0 ? q.weight * band : q.weight * Math.pow(1.18, (tier - 1) * Math.min(q.rank, 4) * 0.35) * band
        expect(mine).toBeCloseTo(expected, 6)
      }
    }
  })

  it('同一件装备的解析与冻结的旧口径**精确相等**(平铺是 GNum,逐位比)', () => {
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
          const ref = refResolveEquipStats({ uid: 'u', templateId: template.id, quality: quality as QualityId, tier: template.tier, level, affixes })
          const where = `${template.id}/${quality}/${level}`
          expect(mine.flats.attack ?? gnZero(), where).toEqual(ref.flats.attack)
          expect(mine.flats.defense ?? gnZero(), where).toEqual(ref.flats.defense)
          expect(mine.flats.maxHp ?? gnZero(), where).toEqual(ref.flats.maxHp)
          const keys = new Set([...Object.keys(mine.mods), ...Object.keys(ref.mods)])
          for (const key of keys) {
            expect(mine.mods[key] ?? 0, `${where} · ${key}`).toBe((ref.mods as Record<string, number>)[key] ?? 0)
          }
          expect(mine.affixLines.map(l => l.value), where).toEqual(ref.affixLines.map(l => l.value))
        }
      }
    }
  })

  it('迁移接线:app 的 resolveEquipStats 与库同一份结果(含缺模板时补零)', () => {
    const inst: EquipmentInstance = {
      uid: 'u',
      templateId: EQUIPMENT_TEMPLATES[0]!.id,
      quality: 'spirit',
      tier: EQUIPMENT_TEMPLATES[0]!.tier,
      level: 3,
      affixes: [{ id: 'atk1', roll: 0.5 }]
    }
    const app = resolveEquipStats(inst)
    const lib = system.resolve({ uid: inst.uid, templateId: inst.templateId, qualityId: inst.quality, tier: inst.tier, level: inst.level, affixes: inst.affixes })
    expect(app.flats).toEqual({ attack: lib.flats.attack ?? gnZero(), defense: lib.flats.defense ?? gnZero(), maxHp: lib.flats.maxHp ?? gnZero() })
    expect(app.mods).toEqual(lib.mods)
    expect(app.affixLines.map(l => l.desc)).toEqual(lib.affixLines.map(l => l.desc))
    // 模板不存在时:三个平铺键仍要在(调用处直接读 flats.attack),值为零
    const missing = resolveEquipStats({ ...inst, templateId: '不存在的模板' })
    expect(missing.flats).toEqual({ attack: gnZero(), defense: gnZero(), maxHp: gnZero() })
    expect(missing.mods).toEqual({})
    expect(missing.affixLines).toEqual([])
  })

  it('共鸣的件数与激活:与冻结的旧口径一致(真实装配是一槽一件)', () => {
    const inst = (uid: string, templateId: string): EquipmentInstance => ({
      uid,
      templateId,
      quality: 'fine' as QualityId,
      tier: 3,
      level: 0,
      affixes: []
    })
    // 一槽一件的真实装配:玄铁重剑(武)+ 玄铁冠(头)= 铁壁两件
    const tiebi = [inst('a', 'w_xuantie'), inst('b', 'h_xuantie')]
    // 星辰冠(头)+ 星罗法衣(身)= 星斗两件
    const xingdou = [inst('c', 'h_xingchen'), inst('d', 'b_xingluo')]
    const tiebiThree = [...tiebi, inst('e', 'b_xuanwu')]
    for (const equipped of [tiebi, xingdou, tiebiThree]) {
      expect(setCounts(equipped), equipped.map(i => i.templateId).join('+')).toEqual(refSetCounts(equipped))
      expect(activeSets(equipped).map(s => s.id).sort()).toEqual(refActiveSetIds(equipped))
    }
    expect(activeSets(tiebi).map(s => s.id)).toEqual(['s_tiebi'])
    expect(hasActiveSet(tiebi, 'ironwall')).toBe(true)
    expect(hasActiveSet(tiebi, 'astral')).toBe(false)
    expect(hasActiveSet(xingdou, 'astral')).toBe(true)
  })
})

// ============ 副本 ============

describe('对账 · 副本系统(库 与 尚未迁移的 regions/enemies)', () => {
  const system = NUM_WORLD.dungeons

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

  it('解锁口径与冻结的旧 unlockClosure 一致(若干存档状态逐一比)', () => {
    const cases: string[][] = [[], ['qingyun'], ['qingyun', 'luoxia'], ['qingyun', 'luoxia', 'heifeng'], ['luoxia'], ['guzhanchang', 'qingyun']]
    for (const cleared of cases) {
      const progress = { cleared, bossWins: {}, runs: {} }
      // ① 等级充裕时的解锁集合 = 旧口径的补票结果
      expect(system.unlocked(progress, 99).map(r => r.id)).toEqual(refUnlockClosure(['qingyun'], cleared))
      // ② 读档补票(不看等级)直接对库的 prereqClosure
      expect(system.prereqClosure(['qingyun'], cleared)).toEqual(refUnlockClosure(['qingyun'], cleared))
    }
  })

  it('读档补票的不变量:只补该补的、保留不认识的历史 id、幂等', () => {
    const cases: [string[], string[]][] = [
      [['qingyun'], []],
      [['qingyun', '鸿蒙裂隙(旧档)'], ['qingyun']],
      [['qingyun'], ['luoxia']],
      [['qingyun', 'luoxia'], ['qingyun', 'luoxia']]
    ]
    for (const [unlocked, cleared] of cases) {
      const once = system.prereqClosure(unlocked, cleared)
      expect(once).toEqual(refUnlockClosure(unlocked, cleared))
      // 幂等:补过再补是同一份
      expect(system.prereqClosure(once, cleared)).toEqual(once)
    }
  })

  it('首领门槛与冻结的旧口径一致(online/offline 共用这一处)', () => {
    for (let wins = 0; wins <= EXPLORE_BOSS_AFTER_WINS + 5; wins += 1) {
      expect(system.winsUntilBoss(wins, false), `wins=${wins}`).toBe(refWinsUntilRegionBoss(wins, false))
      expect(system.winsUntilBoss(wins, true), `wins=${wins} · cleared`).toBe(refWinsUntilRegionBoss(wins, true))
    }
    // 应用侧的入口确实经库计算
    expect(winsUntilRegionBoss(EXPLORE_BOSS_AFTER_WINS - 3, false)).toBe(system.winsUntilBoss(EXPLORE_BOSS_AFTER_WINS - 3, false))
    expect(winsUntilRegionBoss(0, true)).toBeNull()
    // 本作是 once 节奏:攒够即出一次,通关后此地再无首领
    const progress = { cleared: [], bossWins: { qingyun: EXPLORE_BOSS_AFTER_WINS }, runs: {} }
    expect(system.nextEncounter('qingyun', progress, createRng(1)).kind).toBe('boss')
    const cleared = { cleared: ['qingyun'], bossWins: { qingyun: 0 }, runs: {} }
    expect(system.nextEncounter('qingyun', cleared, createRng(1)).kind).toBe('normal')
  })

  it('等级门槛:同一份通关记录,等级不到就开不了那张图', () => {
    const gated = REGIONS.find(r => r.requireCleared !== undefined && r.minRealm > 0)!
    const cleared = ['qingyun', gated.requireCleared!]
    const progress = { cleared, bossWins: {}, runs: {} }
    const low = system.unlocked(progress, 0).map(r => r.id)
    expect(low).toContain(gated.requireCleared!)
    expect(low).not.toContain(gated.id)
    expect(system.unlocked(progress, gated.minRealm).map(r => r.id)).toContain(gated.id)
  })
})
