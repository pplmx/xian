/**
 * 装备系统 —— 槽位 / 品质 / 模板 / 词条 / 套装,以及"生成实例 → 解析数值 → 装配"。
 *
 * ## 一件装备 = 模板 × 品质 × 词条 × 强化
 *
 *   模板(template) 决定它**是什么**(名字、部位、层级、固有词条)
 *   品质(quality)  决定它**多好**(平铺倍率与词条条数区间)
 *   词条(affix)    决定它**这一件如何**(随机数值,带稀有度)
 *   强化(level)    决定它**养了多久**(每级加成)
 *
 * 四件事分开,是这套系统能换皮的前提:
 * 换名字只动 templates / slots / qualities 的 `name`,
 * 换手感才动 `power`(平铺曲线)、`qualities[].mult`、`affixes` 的权重。
 *
 * ## 为什么按层取池,而不是累积
 *
 * 「名字要能分辨」是一条硬要求:3 层的区域只该掉 3 层之物。
 * 累积池会让同一个名字顶着不同数字出现,名字就失去意义。
 * `templatesAtTier` 因此是**精确取层**,并为"某一层某部位没有内容"留了一次退档兜底
 * (掉错一件东西,好过在上千次掉落里突然抛错)。
 */
import type { Mods } from './attributes.js'
import type { Numeric } from './numeric.js'
import { clamp, numberNumeric } from './numeric.js'
import type { Rng } from './rng.js'

export interface SlotDef {
  id: string
  name: string
  icon?: string
  /** 展示顺序(小的在前) */
  order?: number
  /** 该部位在抽取时的相对权重(默认 1) */
  dropWeight?: number
}

export interface QualityDef {
  id: string
  name: string
  /** 0 起,越大越好 */
  rank: number
  /** 平铺倍率 */
  mult: number
  /** 词条条数区间 [下限, 上限] */
  affixes: [number, number]
  /** 掉落窗口(含);窗口外按 outOfBand 衰减 */
  fromTier?: number
  toTier?: number
  /** 基础权重 */
  weight: number
  color?: string
}

export interface TemplateDef {
  id: string
  name: string
  slot: string
  /** 层级(与副本层级同一把尺子) */
  tier: number
  /** 平铺基数:键 → 权重,实际数值 = 权重 × 层级系数 × 品质倍率 */
  base?: Record<string, number>
  /** 模板固有词条(百分比/独立加成) */
  fixedMods?: Mods
  desc?: string
  icon?: string
  /** 所属套装 */
  setId?: string
}

export interface AffixDef {
  id: string
  name: string
  /** 作用到哪个属性键(必须在属性系统里登记) */
  key: string
  min: number
  max: number
  /** 抽取权重 */
  weight: number
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  /** 限定部位;省略 = 任意部位 */
  slots?: string[]
  /** 出现所需最低层级 / 最低品质序号 */
  minTier?: number
  minRank?: number
  decimals?: number
  /**
   * 词条数值进入属性前的除数。
   *
   * 上游工程的词条写的是**百分点**(「攻击提升 4.2%」→ min 2 / max 5),
   * 而属性表用的是**分数**(0.042);两边差一个 100。
   * 这类单位换算必须是配置里的一条明文规矩,不能靠"碰巧两边都用同一种写法"。
   */
  scale?: number
  /**
   * 取值曲线(**可选**):给 0~1 的档位,返回**原始数值**(之后仍按 `decimals` 取整)。
   *
   * 默认是线性的 `min + (max − min) × roll`。想让"掷得满"更值钱(凸曲线)、
   * 或让中档更常见(凹曲线),给一条函数即可 —— `min`/`max` 仍用于展示区间与筛选。
   */
  valueCurve?: (roll: number) => number
  /** 描述模板,`{v}` 为数值占位 */
  desc?: string
}

export interface SetDef {
  id: string
  name: string
  desc?: string
  /**
   * 件数 → 效果(达到该件数即生效)。
   *
   * `mods` 是**数值**效果;`hook` 是留给玩法层的**机制标记** ——
   * 「两件套 = 首次致命伤保留 1 点气血」这类效果不是一组词条,而是一段规则。
   * 引擎只负责"件数够了、这个 hook 生效了",至于 hook 怎么解释,那是游戏自己的事。
   * 于是同一套套装模型既能表达数值套,也能表达机制套。
   */
  bonuses: { pieces: number; mods: Mods; desc?: string; hook?: string }[]
}

export interface EquipmentPowerConfig<T = number> {
  /**
   * 层级系数:`tierGrowth^(tier-1)`。
   *
   * **给了 `tierFactors` 就可以不写** —— 查表的人不必再编一个用不上的倍率
   * (与 `realms.exp.costFn` 那条先例一致:自己接管曲线,就不用再给倍率)。
   * 两样都不给时按 1 处理(每一层平铺不变)。
   */
  tierGrowth?: number
  /** 总预算系数,压住整条曲线的绝对值 */
  baseFactor?: number
  /** 品质对平铺的放大指数 */
  qualityExponent?: number
  /** 直接给出每一层的系数(覆盖指数式);第 i 项对应 tier=i+1 */
  /**
   * 直接给出每一层的系数(覆盖指数式);第 i 项对应 tier=i+1。
   *
   * 项可以是数字,也可以是**宿主自己的数值类型**(大数实现)—— 由 `Numeric.of` 收下。
   * 于是"层级表"既能写成 `[1, 2, 4]`,也能是一串 GNum,不必先投影成 double。
   */
  tierFactors?: readonly (number | T)[]
  /** 每强化一级的平铺加成 */
  levelBonus?: number
  /**
   * 自己接管强化加成(**可选**):返回**并到 1 上的比例**
   * (默认是 `level * levelBonus`,即每级线性的那一份)。
   * 想让前几级猛、后面缓,或按层级给不同的强化效率,用它。
   */
  levelBonusFn?: (level: number) => number
}

export interface EquipmentConfig<T = number> {
  slots: SlotDef[]
  qualities: QualityDef[]
  templates: TemplateDef[]
  affixes: AffixDef[]
  sets?: SetDef[]
  power: EquipmentPowerConfig<T>
  /** 窗口外权重衰减底数,默认 0.1 */
  outOfBand?: number
  /** 每层级 +1 的高品质权重倍率,默认 1.18 */
  qualityTierShift?: number
  /** 词条条数上限(防御性),默认 12 */
  maxAffixCount?: number
  /**
   * 自己接管"这一件带几条词条"(**可选**):返回值即条数(仍受 `maxAffixCount` 封顶)。
   *
   * 默认是"在品质自己的 [下限, 上限] 里均匀取一个"。想按层级给保底
   * (低层只出一条、高层至少三条)或做别的分布,给函数即可 —— 它在抽取流程里
   * 取代那一次 `rng.int(下限, 上限)`,故随机流与默认路径一致。
   */
  affixCountFn?: (quality: QualityDef, tier: number, rng: Rng) => number
  /**
   * 自己接管词条抽取权重(**可选**):返回该词条这一次的权重(默认用 `AffixDef.weight`)。
   *
   * 用途是"倾向而非门槛":高层更容易出某几条、某个品质偏爱某类词条。
   * 返回 0 表示这一次不参与;要"根本不可能出",请在词条上写 `minRank` / `minTier` / `slots`。
   */
  affixWeightFn?: (affix: AffixDef, quality: QualityDef, tier: number) => number
  /** 本作品词条数值的统一换算系数(默认 1;以百分点书写时填 100) */
  affixValueScale?: number
}

export interface AffixRoll {
  id: string
  /** 0~1 的档位 */
  roll: number
}

export interface EquipmentInstance {
  uid: string
  templateId: string
  qualityId: string
  tier: number
  level: number
  affixes: AffixRoll[]
}

export interface AffixLine {
  id: string
  name: string
  desc: string
  before: string
  value: string
  after: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  key: string
  /** 展示数值(按词条自身的书写单位) */
  amount: number
  /** 0~1 的档位 —— 展示序按它排(掷得越满越靠前) */
  roll: number
}

export interface ResolvedEquipment<T> {
  template: TemplateDef | undefined
  quality: QualityDef
  /** 平铺数值(加到本值上) */
  flats: Record<string, T>
  /** 词条(模板固有 + 随机) */
  mods: Mods
  affixLines: AffixLine[]
}

export interface Loadout {
  /** 槽位 → 装备 uid */
  equipped: Record<string, string | undefined>
}

export interface LoadoutStats<T> {
  flats: Record<string, T>
  mods: Mods
  /** 生效的套装效果 */
  sets: { id: string; name: string; pieces: number; active: { pieces: number; desc?: string; mods: Mods; hook?: string }[] }[]
}

export interface RollOptions {
  tier: number
  slot?: string
  /** 气运:提高高品质权重 */
  luck?: number
  /** 强制品质下限(首领/秘境/际遇的剧情性例外,不吃窗口) */
  minQualityRank?: number
  /** 强制品质下限但不锁窗口 */
  floorRank?: number
}

/**
 * 重掷词条的选项 —— "洗练 / 重铸"那一类玩法的骨架。
 *
 * 库只管**怎么重掷**:保留哪些、掷几条、从哪个池里按什么权重掷、数值要不要重掷。
 * 至于"洗一次花什么""能不能无限洗""封存上限几个" —— 那是内容,归作品。
 */
export interface RerollOptions {
  rng: Rng
  /** 品质:决定条数区间与词条门槛(与生成时同一把尺子) */
  quality: QualityDef
  /** 层级:用于词条的 `minTier` 门槛 */
  tier: number
  /** 部位:限定只出该部位的词条;不给则不限 */
  slot?: string
  /** 保留哪些词条 id(封存 / 锁定)—— 它们原样留下,不参与重掷 */
  keep?: readonly string[]
  /**
   * 指定这一件重掷出几条;不给就在品质区间里掷。
   * 目标条数取"品质区间"与"`keep.length + 1`"里较大的那个 —— **尽量**每次至少给一条新的;
   * 若池子被门槛排空(部位 / 品阶都不合),那就给不出新的,只保留你指定的那些
   * (要不要允许这种"洗了等于没洗",由作品的代价与判据决定)。
   */
  count?: number
}

export interface EquipmentSystem<T = number> {
  readonly slots: readonly SlotDef[]
  readonly qualities: readonly QualityDef[]
  readonly affixes: readonly AffixDef[]
  readonly sets: readonly SetDef[]
  slot(id: string): SlotDef | undefined
  quality(id: string): QualityDef
  template(id: string): TemplateDef | undefined
  affix(id: string): AffixDef | undefined
  /** 某层某部位可掉的模板(精确取层 + 退档兜底) */
  templatesAtTier(tier: number, slot: string): TemplateDef[]
  /** 某层可掉的模板(不指定部位时按部位分组,避免行序影响出场率) */
  poolAtTier(tier: number, slot?: string): TemplateDef[]
  /** 品质抽取权重(掉落与审计共用这一处) */
  qualityWeightAt(quality: QualityDef, tier: number, opts?: RollOptions): number
  rollQuality(tier: number, rng: Rng, opts?: RollOptions): QualityDef
  /** 词条数值 = min + (max-min) × roll */
  affixValue(def: AffixDef, roll: number): number
  generate(rng: Rng, opts: RollOptions): EquipmentInstance
  /**
   * 重掷一件的词条(洗练 / 重铸):保留你指定的、其余换成新词条与新掷点。
   *
   * 与 `generate` **共用同一处掷词条的实现** —— 池子、门槛、权重、数值曲线都走同一份配置,
   * 于是"掉出来的"与"洗出来的"不会有两套口径。纯函数:返回新的列表,入参不动,
   * 品质 / 层级 / 部位也不动(洗的是词条构成,不是出身)。
   */
  rerollAffixes(affixes: readonly AffixRoll[], opts: RerollOptions): AffixRoll[]
  resolve(instance: EquipmentInstance): ResolvedEquipment<T>
  /** 装配:把一件装备放进对应槽位,返回新的装配方案 */
  equip(loadout: Loadout, instance: EquipmentInstance): Loadout
  /** 汇总一整套装备的平铺、词条与套装效果 */
  resolveLoadout(loadout: Loadout, byUid: ReadonlyMap<string, EquipmentInstance>): LoadoutStats<T>
}

function uidFactory(): () => string {
  let n = 0
  return () => `e${(n += 1).toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`
}

export function createEquipmentSystem<T = number>(
  config: EquipmentConfig<T>,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>,
  newUid: () => string = uidFactory()
): EquipmentSystem<T> {
  const slots = [...config.slots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const slotIds = new Set(slots.map(s => s.id))
  const qualities = [...config.qualities].sort((a, b) => a.rank - b.rank)
  const templates = [...config.templates]
  const affixes = [...config.affixes]
  const sets = [...(config.sets ?? [])]
  const outOfBand = config.outOfBand ?? 0.1
  const tierShift = config.qualityTierShift ?? 1.18
  const baseFactor = config.power.baseFactor ?? 1
  const qualityExp = config.power.qualityExponent ?? 1
  const levelBonus = config.power.levelBonus ?? 0.12
  const maxAffixCount = config.maxAffixCount ?? 12
  const globalAffixScale = config.affixValueScale ?? 1

  const qualityById = new Map(qualities.map(q => [q.id, q]))
  const templateById = new Map(templates.map(t => [t.id, t]))
  const affixById = new Map(affixes.map(a => [a.id, a]))
  const slotById = new Map(slots.map(s => [s.id, s]))
  const setById = new Map(sets.map(s => [s.id, s]))

  const tierScale = (tier: number): T => {
    const t = Math.max(1, tier)
    const override = config.power.tierFactors?.[t - 1]
    return override !== undefined ? numeric.of(override) : numeric.powN(config.power.tierGrowth ?? 1, t - 1)
  }

  const templatesAtTier = (tier: number, slot: string): TemplateDef[] =>
    templates.filter(t => t.tier === tier && t.slot === slot)

  const poolAtTier = (tier: number, slot?: string): TemplateDef[] => {
    const pickSlot = (s: string): TemplateDef[] => {
      const here = templatesAtTier(tier, s)
      if (here.length > 0) return here
      const tiers = [...new Set(templates.filter(t => t.slot === s).map(t => t.tier))].sort((a, b) => b - a)
      const fallback = tiers.find(t => t < tier) ?? tiers[tiers.length - 1]
      return fallback === undefined ? [] : templatesAtTier(fallback, s)
    }
    if (slot !== undefined) return pickSlot(slot)
    return slots.flatMap(s => pickSlot(s.id))
  }

  const bandFactor = (q: QualityDef, tier: number, opts: RollOptions): number => {
    if (opts.minQualityRank !== undefined) return 1
    const from = q.fromTier ?? 1
    const to = q.toTier ?? Number.MAX_SAFE_INTEGER
    const distance = Math.max(0, from - tier, tier - to)
    return distance === 0 ? 1 : outOfBand ** distance
  }

  const qualityWeightAt = (q: QualityDef, tier: number, opts: RollOptions = { tier }): number => {
    const luck = opts.luck ?? 0
    const band = bandFactor(q, tier, opts)
    if (q.rank === 0) return q.weight * band
    const tierBoost = tierShift ** ((tier - 1) * Math.min(q.rank, 4) * 0.35)
    const luckBoost = 1 + luck * (q.rank >= 3 ? 1.5 : 0.5)
    return q.weight * tierBoost * luckBoost * band
  }

  const rollQuality = (tier: number, rng: Rng, opts: RollOptions = { tier }): QualityDef => {
    // 品质表是空的 = 这款游戏没有装备这一层(配置里写的是 equipment: null)。
    // 这里必须出声:往下走会掷出一个 undefined 的品质,然后带着它去读 affixes ——
    // 那种错会在很远的地方以"读不到属性"的样子出现,这里的这句话才是能用的话。
    if (qualities.length === 0) throw new Error('装备系统:品质表是空的,没有可用的品质')
    const floor = Math.max(opts.minQualityRank ?? 0, opts.floorRank ?? 0)
    const pool = qualities.filter(q => q.rank >= floor)
    if (pool.length === 0) return qualities[qualities.length - 1]!
    return rng.weighted(pool, q => qualityWeightAt(q, tier, opts))
  }

  const affixValue = (def: AffixDef, roll: number): number => {
    const r = clamp(roll, 0, 1)
    const v = def.valueCurve ? def.valueCurve(r) : def.min + (def.max - def.min) * r
    const f = Math.pow(10, def.decimals ?? 1)
    return Math.round(v * f) / f
  }

  /**
   * 掷一批词条 —— `generate` 与 `rerollAffixes` 共用这一处。
   *
   * 池子怎么筛(minRank / minTier / 部位)、权重怎么算(`affixWeightFn`)、
   * 每条掷点怎么来(`rng.next()`),都只写在这里一次:两处各写一份,迟早分叉成两套口径。
   */
  const pickAffixes = (
    rng: Rng,
    ctx: { tier: number; quality: QualityDef; slot?: string; count: number; exclude?: ReadonlySet<string> }
  ): AffixRoll[] => {
    const chosen: AffixRoll[] = []
    const used = new Set<string>(ctx.exclude ?? [])
    let guard = 0
    while (chosen.length < ctx.count && guard < 60) {
      guard += 1
      const candidates = affixes.filter(
        a =>
          !used.has(a.id) &&
          (a.minRank === undefined || ctx.quality.rank >= a.minRank) &&
          (a.minTier === undefined || ctx.tier >= a.minTier) &&
          (a.slots === undefined || ctx.slot === undefined || a.slots.includes(ctx.slot))
      )
      if (candidates.length === 0) break
      const picked = rng.weighted(candidates, a => (config.affixWeightFn ? config.affixWeightFn(a, ctx.quality, ctx.tier) : a.weight))
      used.add(picked.id)
      chosen.push({ id: picked.id, roll: rng.next() })
    }
    return chosen
  }

  const generate = (rng: Rng, opts: RollOptions): EquipmentInstance => {
    const tier = Math.max(1, opts.tier)
    const dropSlots = slots.filter(s => (s.dropWeight ?? 1) > 0)
    if (dropSlots.length === 0) throw new Error('装备系统:没有任何可掉落的槽位')
    /*
     * 掷槽位时只在该层**真的有内容**的槽位里掷。
     *
     * 起因:装配时的 `EQUIP_SLOT_EMPTY` / `EQUIP_TIER_SLOT_GAP` 只是警告(内容还没写全很常见),
     * 但"掷到一个没有模板的槽位"原本会直接抛错 —— 于是内容不全的存档点会在战斗中随机炸掉,
     * 而装配时明明只给了警告。警告的东西不该在运行时变成崩溃:退档掉落那条路(见 poolAtTier)
     * 本来就表达了"这一层没内容,拿有内容的顶上"。
     *
     * `opts.slot` 是**点名**要某个槽位,那种情况仍然大声报错并指名道姓。
     */
    const withContent = dropSlots.filter(s => poolAtTier(tier, s.id).length > 0)
    if (withContent.length === 0) throw new Error(`装备系统:层级 ${tier} 没有任何可掉落的模板`)
    const slot = opts.slot ?? rng.weighted(withContent, s => s.dropWeight ?? 1).id
    const eligible = poolAtTier(tier, slot)
    if (eligible.length === 0) throw new Error(`装备系统:层级 ${tier} 的槽位 ${slot} 没有任何模板`)
    const template = rng.weighted(eligible, () => 1)
    const quality = rollQuality(tier, rng, opts)
    const [minA, maxA] = quality.affixes
    const wanted = config.affixCountFn ? config.affixCountFn(quality, tier, rng) : rng.int(minA, maxA)
    const count = Math.min(maxAffixCount, Math.max(0, Math.floor(wanted)))
    const chosen = pickAffixes(rng, { tier, quality, slot, count })
    return { uid: newUid(), templateId: template.id, qualityId: quality.id, tier, level: 0, affixes: chosen }
  }

  const rerollAffixes = (affixes: readonly AffixRoll[], opts: RerollOptions): AffixRoll[] => {
    const keep = new Set(opts.keep ?? [])
    const kept = affixes.filter(a => keep.has(a.id))
    const [minCount, maxCount] = opts.quality.affixes
    // 指定条数就用它;否则在品质区间里掷 —— 但无论哪种,都不少于"保留数 + 1":
    // 每次重掷至少给你一条新的,否则"洗练"就成了花钱不办事
    const band = Math.min(maxAffixCount, opts.count ?? opts.rng.int(minCount, maxCount))
    const count = Math.max(kept.length + 1, band)
    const fresh = pickAffixes(opts.rng, {
      tier: opts.tier,
      quality: opts.quality,
      slot: opts.slot,
      count: count - kept.length,
      exclude: keep
    })
    return [...kept, ...fresh]
  }

  const rarityRank = (r: AffixLine['rarity']): number => (r === 'legendary' ? 3 : r === 'epic' ? 2 : r === 'rare' ? 1 : 0)

  const resolve = (instance: EquipmentInstance): ResolvedEquipment<T> => {
    const template = templateById.get(instance.templateId)
    const quality = qualityById.get(instance.qualityId) ?? qualities[0]!
    const flats: Record<string, T> = {}
    const mods: Mods = {}
    const affixLines: AffixLine[] = []
    if (!template) return { template, quality, flats, mods, affixLines }

    const scale = tierScale(instance.tier)
    // 与上游工程同形:平铺 = 层级系数 × (基数 × 总预算系数 × 品质倍率 × 强化加成)
    // —— 乘法的结合顺序也照搬,大数库下才能逐位一致
    const levelPart = config.power.levelBonusFn ? config.power.levelBonusFn(instance.level) : instance.level * levelBonus
    const factor = baseFactor * quality.mult ** qualityExp * (1 + levelPart)
    for (const [key, weight] of Object.entries(template.base ?? {})) {
      if (!weight) continue
      flats[key] = numeric.add(flats[key] ?? numeric.zero, numeric.mulN(scale, weight * factor))
    }
    for (const k in template.fixedMods) {
      const v = template.fixedMods[k]
      if (typeof v === 'number') mods[k] = (mods[k] ?? 0) + v
    }
    for (const roll of instance.affixes) {
      const def = affixById.get(roll.id)
      if (!def) continue
      const amount = affixValue(def, roll.roll)
      // 展示用原始数值(「4.2」),入属性用换算后的分数(0.042)
      mods[def.key] = (mods[def.key] ?? 0) + amount / (def.scale ?? globalAffixScale)
      const decimals = def.decimals ?? 1
      const text = `${amount.toFixed(decimals)}`
      const desc = (def.desc ?? `${def.name} {v}`).replace('{v}', text)
      const at = desc.indexOf(text)
      affixLines.push({
        id: def.id,
        name: def.name,
        desc,
        before: at >= 0 ? desc.slice(0, at) : desc,
        value: text,
        after: at >= 0 ? desc.slice(at + text.length) : '',
        rarity: def.rarity ?? 'common',
        key: def.key,
        amount,
        roll: roll.roll
      })
    }
    // 展示序:先稀有,同稀有先看掷得满的 —— 第一条就该是这件最值钱的地方
    affixLines.sort(
      (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.roll - a.roll || a.id.localeCompare(b.id)
    )
    return { template, quality, flats, mods, affixLines }
  }

  const equip = (loadout: Loadout, instance: EquipmentInstance): Loadout => {
    const template = templateById.get(instance.templateId)
    if (!template || !slotIds.has(template.slot)) return loadout
    return { equipped: { ...loadout.equipped, [template.slot]: instance.uid } }
  }

  const resolveLoadout = (
    loadout: Loadout,
    byUid: ReadonlyMap<string, EquipmentInstance>
  ): LoadoutStats<T> => {
    const flats: Record<string, T> = {}
    const mods: Mods = {}
    const setCount = new Map<string, number>()
    for (const slotId of slotIds) {
      const uid = loadout.equipped[slotId]
      if (!uid) continue
      const inst = byUid.get(uid)
      if (!inst) continue
      const resolved = resolve(inst)
      for (const [key, value] of Object.entries(resolved.flats)) {
        flats[key] = numeric.add(flats[key] ?? numeric.zero, value)
      }
      for (const k in resolved.mods) {
        const v = resolved.mods[k]
        if (typeof v === 'number') mods[k] = (mods[k] ?? 0) + v
      }
      const setId = resolved.template?.setId
      if (setId) setCount.set(setId, (setCount.get(setId) ?? 0) + 1)
    }
    const activeSets: LoadoutStats<T>['sets'] = []
    for (const [setId, count] of setCount) {
      const def = setById.get(setId)
      if (!def) continue
      const active: { pieces: number; desc?: string; mods: Mods; hook?: string }[] = []
      for (const bonus of def.bonuses) {
        if (count < bonus.pieces) continue
        active.push({ pieces: bonus.pieces, desc: bonus.desc, mods: bonus.mods, hook: bonus.hook })
        for (const k in bonus.mods) {
          const v = bonus.mods[k]
          if (typeof v === 'number') mods[k] = (mods[k] ?? 0) + v
        }
      }
      if (active.length > 0) activeSets.push({ id: setId, name: def.name, pieces: count, active })
    }
    return { flats, mods, sets: activeSets }
  }

  return {
    slots,
    qualities,
    affixes,
    sets,
    slot: id => slotById.get(id),
    quality: id => {
      const found = qualityById.get(id)
      if (found) return found
      // 表里有品质但认不出这个 id 时退到最弱那一档(旧存档里可能留着删掉的品质);
      // 表本身就是空的(这游戏没有装备这一层)则要出声,不能返回一个 undefined
      if (qualities.length === 0) throw new Error('装备系统:品质表是空的,没有可用的品质')
      return qualities[0]!
    },
    template: id => templateById.get(id),
    affix: id => affixById.get(id),
    templatesAtTier,
    poolAtTier,
    qualityWeightAt,
    rollQuality,
    affixValue,
    generate,
    rerollAffixes,
    resolve,
    equip,
    resolveLoadout
  }
}

/**
 * 从"名目表"生成整套模板 —— 给不想手写几百件装备的人。
 *
 * 输入:每层每个部位的名字(base 权重按部位默认表给,或显式指定),
 * 输出:`TemplateDef[]`。上游工程那 288 件是手写的;一个新游戏
 * 往往只需要"这九层每层九件"的名字。
 */
export function generateTemplates(opts: {
  /** 第 i 项对应 tier=i+1 */
  tiers: { names: string[]; desc?: string; fixedMods?: Mods }[] | string[][]
  slots: SlotDef[]
  /** 部位默认平铺权重 */
  baseBySlot?: Record<string, Record<string, number>>
  /** 名字与部位的对应:names[i] → slots[i % slots.length] */
  setsByTier?: (string | undefined)[]
}): TemplateDef[] {
  const defaultBase: Record<string, Record<string, number>> = opts.baseBySlot ?? {
    weapon: { attack: 20 },
    head: { defense: 5, maxHp: 18 },
    body: { defense: 8, maxHp: 36 },
    wrist: { attack: 3, defense: 3 },
    belt: { defense: 4, maxHp: 28 },
    boots: { defense: 4, maxHp: 14 },
    necklace: { maxHp: 24 },
    ring: { attack: 4 },
    talisman: { maxHp: 20 }
  }
  const out: TemplateDef[] = []
  opts.tiers.forEach((entry, ti) => {
    const tier = ti + 1
    const names = Array.isArray(entry) ? entry : entry.names
    const desc = Array.isArray(entry) ? undefined : entry.desc
    const fixedMods = Array.isArray(entry) ? undefined : entry.fixedMods
    names.forEach((name, ni) => {
      const slot = opts.slots[ni % opts.slots.length]
      if (!slot) return
      out.push({
        id: `t${tier}_${slot.id}_${ni + 1}`,
        name,
        slot: slot.id,
        tier,
        base: defaultBase[slot.id] ?? {},
        desc,
        fixedMods,
        setId: opts.setsByTier?.[ti]
      })
    })
  })
  return out
}
