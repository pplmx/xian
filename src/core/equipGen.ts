/**
 * 装备生成与数值解析 —— Template + 随机品质 + 随机词条 → Instance
 *
 * ## 生成那半边已经搬进公共库
 *
 * 「哪个层级掉哪几件」「品质怎么掷」「词条怎么筛」都是**通用规则**,已经在库的
 * 装备系统里(见 core/engineWorld 装配的那一份)。这里的
 * equipTemplatePool / rollQuality / qualityWeightAt / generateEquipment
 * 保留同名入口转发过去,故调用方一行不用改。
 *
 * 判据同样照「冻结旧口径 + 精确相等」的规矩:engineParity 里冻着迁移前的实现,
 * 连**掷完之后的随机流状态**都要对上 —— 生成同样的东西还不够,
 * 还得消耗同样多的随机数,否则同一种子后面的掉落会整体错位。
 *
 * ## 解析那半边仍住在这里
 *
 * resolveEquipStats 用的是本作自己的层级战力表(core/tierScale.powerScale,GNum)。
 * 库那边同一张表是以 number 投影进去的(见 engineWorld 注释),差在双精度末位;
 * 「玩家看到的数字一位不变」这条线要求解析仍走 GNum,故它留在这里。
 */
import type { AffixRarity, AnyStatKey, EquipmentInstance, EquipSlot, GNum, QualityDef, QualityId, StatMods } from '@/types'
import type { RandomService } from '@/utils/random'
import { gnZero, mulN, add } from '@/utils/gnum'
import { AFFIX_RARITY_RANK, affixDef, affixValue } from '@/data/affixes'
import { equipmentTemplate } from '@/data/equipment'
import { qualityDef } from '@/data/qualities'
import { EQUIP_BASE_FACTOR, EQUIP_LEVEL_BONUS, EQUIP_QUALITY_FLAT_EXP } from '@/data/constants'
import { powerScale } from './formulas'
import { ENGINE_WORLD } from './engineWorld'

export interface GenOptions {
  slot?: EquipSlot
  minQualityRank?: number
  /** 气运(提高高品质权重) */
  luck?: number
}

/**
 * 某一档品质在某层级的掉落权重 —— **掉落与审计共用这一处**。
 *
 * 抽出来不是为了好看:平衡审计要问「这个层级的玩家,身上通常是哪一档品质」,
 * 而这个问题只能用同一份权重来答。审计若自己再写一份近似公式,
 * 那么改了窗口、改了层阶加成之后,审计还在按旧口径夸人(或骂人)。
 *
 * 「按权重掷出哪一档」也一并搬进了库(equipment.rollQuality);本作只留这条
 * 权重查询,因为经济/膨胀审计要按它算期望,而审计读的是本作的品质表。
 */
export function qualityWeightAt(q: QualityDef, tier: number, opts: GenOptions = {}): number {
  return ENGINE_WORLD.equipment.qualityWeightAt(q, tier, { tier, ...opts })
}

/** 生成一件装备实例 */
export function generateEquipment(tier: number, rng: RandomService, opts: GenOptions = {}): EquipmentInstance {
  const inst = ENGINE_WORLD.equipment.generate(rng, { tier, ...opts })
  // 库的实例用 qualityId 指品质;本作的 EquipmentInstance 一直叫 quality(存档字段)。
  return {
    uid: inst.uid,
    templateId: inst.templateId,
    quality: inst.qualityId as QualityId,
    tier: inst.tier,
    level: inst.level,
    affixes: inst.affixes.map(a => ({ id: a.id, roll: a.roll }))
  }
}

export interface ResolvedEquipStats {
  flats: { attack: GNum; defense: GNum; maxHp: GNum }
  mods: StatMods
  /**
   * 词条展示行 —— **已是展示序**(见 sortAffixLines),不是掷出的先后。
   * 掷出的顺序是随机的,照着印出来等于把「哪条要紧」交给运气。
   *
   * 每行除了整句 desc,还把数值切成 before / value / after 三段
   * (按词条定义里那一处 `{v}` 切)。理由是排版:一列词条要能**扫**——
   *   「锋锐」 常见   攻击提升 **4.2%**
   *   「洞虚」 传世   攻击时无视目标 **8%** 防御
   * 数值单独拎出来,界面才好右对齐、加粗;只给整句的话,
   * 每行长短不一,玩家对比的是句子长度而不是数字。
   */
  affixLines: {
    id: string
    name: string
    /** 整句(数值已代入)—— 说得出这条管什么 */
    desc: string
    /** 数值之前的话(如「攻击提升 」) */
    before: string
    /** 数值本身(如「4.2」) */
    value: string
    /** 数值之后的话(如「%」) */
    after: string
    rarity: AffixRarity
  }[]
}

/**
 * 词条展示序:先稀有的(传世 → 常见),同稀有度先看掷得满的,最后按 id 稳定。
 *
 * 判据:玩家扫一眼装备卡片,第一条就该是这件东西最值钱的地方。
 * 稀有度写在词条定义里(权重推出来的),成色就是这一件的 roll —— 两者都是既有数据。
 */
export function sortAffixLines<T extends { id: string; roll: number }>(rolls: readonly T[]): T[] {
  return [...rolls].sort((a, b) => {
    const ra = AFFIX_RARITY_RANK[affixDef(a.id)?.rarity ?? 'common']
    const rb = AFFIX_RARITY_RANK[affixDef(b.id)?.rarity ?? 'common']
    return rb - ra || b.roll - a.roll || a.id.localeCompare(b.id)
  })
}

/** 解析装备实例的实际数值 */
export function resolveEquipStats(inst: EquipmentInstance): ResolvedEquipStats {
  const template = equipmentTemplate(inst.templateId)
  const flats = { attack: gnZero(), defense: gnZero(), maxHp: gnZero() }
  const mods: StatMods = {}
  const affixLines: ResolvedEquipStats['affixLines'] = []
  if (!template) return { flats, mods, affixLines }

  const q = qualityDef(inst.quality)
  const scale = powerScale(inst.tier)
  // 品质对平铺按 EQUIP_QUALITY_FLAT_EXP 压缩:高品质的价值主要体现在词条数量上,
  // 而不是把平铺数值再翻几倍(Phase 33.2,详见常量处注释)
  const factor = EQUIP_BASE_FACTOR * Math.pow(q.mult, EQUIP_QUALITY_FLAT_EXP) * (1 + inst.level * EQUIP_LEVEL_BONUS)

  for (const key of ['attack', 'defense', 'maxHp'] as const) {
    const weight = template.base[key]
    if (weight) flats[key] = add(flats[key], mulN(scale, weight * factor))
  }
  if (template.fixedMods) {
    for (const k in template.fixedMods) {
      const key = k as AnyStatKey
      mods[key] = (mods[key] ?? 0) + (template.fixedMods[key] ?? 0)
    }
  }
  for (const roll of sortAffixLines(inst.affixes)) {
    const def = affixDef(roll.id)
    if (!def) continue
    const value = affixValue(def, roll.roll)
    mods[def.key] = (mods[def.key] ?? 0) + value / 100
    // desc 里 {v} 是数值的落点:切开它,界面才能只给数字加粗、并把它右对齐
    const [before = '', after = ''] = def.desc.split('{v}')
    affixLines.push({
      id: def.id,
      name: def.name,
      desc: def.desc.replace('{v}', String(value)),
      before,
      value: String(value),
      after,
      rarity: def.rarity
    })
  }
  return { flats, mods, affixLines }
}
