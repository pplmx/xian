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
 * ## 解析那半边也进库了
 *
 * resolveEquipStats 曾经留在这里,理由是它用的是本作自己的层级战力表(GNum),
 * 而库那时只收得下 number 表 —— 搬过去会在双精度末位上漂。
 * 库现在允许配置里直接放**宿主的大数**(`Numeric.of`),故这条理由没有了:
 * 解析改由库算,本作只做一次形状适配(quality → qualityId、补齐三个平铺键),
 * 数字与迁移前逐位相同。
 */
import type { AffixRarity, EquipmentInstance, EquipSlot, GNum, QualityDef, QualityId, StatMods } from '@/types'
import type { EquipmentInstance as EngineEquipmentInstance } from '@engine/index'
import type { RandomService } from '@/utils/random'
import { gnZero } from '@/utils/gnum'
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
/** 解析装备实例的实际数值 —— 实现已搬进公共库的装备系统,此处只做形状适配 */
export function resolveEquipStats(inst: EquipmentInstance): ResolvedEquipStats {
  const resolved = ENGINE_WORLD.equipment.resolve(toEngineInstance(inst))
  return {
    // 本作的三个平铺键恒定存在(取值处直接读 flats.attack),故补齐零值
    flats: {
      attack: resolved.flats.attack ?? gnZero(),
      defense: resolved.flats.defense ?? gnZero(),
      maxHp: resolved.flats.maxHp ?? gnZero()
    },
    mods: resolved.mods as StatMods,
    affixLines: resolved.affixLines
  }
}

/**
 * 本作的装备实例 → 库的装备实例(字段名不同:本作叫 quality,库叫 qualityId)。
 *
 * 只有这一处知道两种形状的对应关系,故凡要把本作的实例交给库的地方都走它 ——
 * 少了这道转换,库读到的品质会是 undefined(静默退回凡品)。
 */
export function toEngineInstance(inst: EquipmentInstance): EngineEquipmentInstance {
  return {
    uid: inst.uid,
    templateId: inst.templateId,
    qualityId: inst.quality,
    tier: inst.tier,
    level: inst.level,
    affixes: inst.affixes
  }
}
