/**
 * 等级体系 —— 大境界(世界层级)+ 小层(境界内层数)+ 修为/进阶/寿元/基础属性。
 *
 * ## 名称全是配置
 *
 * 引擎只认**序号**与 **id**:`major` 是大境界下标、`layer` 是境界内小层下标。
 * 「炼气·三层」与「青铜·Ⅲ 阶」是同一件事的两种叫法 —— 换名字不用碰公式,
 * 只要给出 `worlds[].realms` 的名字列表与 `layerNames`。
 *
 * ## 世界(界域)概念
 *
 * 等级不是一条直线:上游工程是「人间界 → 仙界 → 神界 → 混沌海」,
 * 每一次跨界都是一次大跃(寿元、修为需求、基础属性都会跳一档)。
 * 引擎把这件事抽象成 `worlds` —— 每个世界一段序号区间,区间相接即"跨界"。
 * 只做一条直线的游戏给一个世界即可,引擎不会额外要求什么。
 *
 * ## 成长曲线的两段式
 *
 * 前段(通常第一个世界)与后段用不同的倍率,是放置类游戏最常见的一招:
 * 前期靠大倍率撑起"越修越快"的手感,后期换成平坦倍率以免数字爆炸。
 * `lateFrom` 指定切换的序号,缺省是第一世界之后的那个境界。
 */
import type { Numeric } from './numeric.js'
import { clamp, numberNumeric } from './numeric.js'
import type { Rng } from './rng.js'

export interface RealmEntry {
  id?: string
  name: string
  desc?: string
  lore?: string
  /** 寿元;省略时按 lifespan 曲线算 */
  lifespanYears?: number
  /**
   * 这一境界自己的小层名目(**可选**)。
   *
   * 不写就用 `layerNames` 那一套;写了就只有这一境按它走 ——
   * 前几境九层、后几境三层的作品不必再被迫拉成同一长度。
   * 长度即这一境的层数(含"圆满"那一层)。
   */
  layers?: readonly string[]
}

export interface WorldConfig {
  id: string
  name: string
  desc?: string
  /** 该世界的境界名(顺序即序号) */
  realms: (string | RealmEntry)[]
}

export interface RealmDef {
  id: string
  name: string
  world: string
  /** 大境界全局序号 */
  major: number
  desc?: string
  lore?: string
  lifespanYears: number
  /** 这一境界的小层名目(未覆盖时即全局那套) */
  layers: readonly string[]
}

export interface WorldDef {
  id: string
  name: string
  desc?: string
  start: number
  end: number
}

/** 两段式成长:前段 realmGrowth,序号 ≥ lateFrom 之后用 lateRealmGrowth */
export interface GrowthCurve {
  realmGrowth: number
  lateFrom?: number
  lateRealmGrowth?: number
}

/**
 * 每层成长需求的两条路:**用曲线**,或**自己接管**。
 *
 * `costFn` 一给,引擎就完全不猜 —— 手里有张手调的等级表(或一段非指数的公式)时,
 * 直接写函数,不必把表硬塞成"倍率 × 倍率"的形状。
 */
export type RealmExpConfig =
  | (GrowthCurve & { base: number; layerGrowth: number; worldStepMult?: number; costFn?: undefined })
  | (GrowthCurve & { costFn: (major: number, layer: number) => number })

/** 基础本值的两条路:曲线,或自己接管(引擎只要求"给我一个大境界+层 → 一组本值") */
export type RealmCombatConfig =
  | (GrowthCurve & { base: Record<string, number>; layerGrowth: number; statsFn?: undefined })
  | (GrowthCurve & { statsFn: (major: number, layer: number) => Record<string, number> })

/**
 * 进阶成功率的两条路:**线性衰减**(小层看层数、大关看境界),或**自己接管**。
 *
 * 两条路都仍受 `min/max` 夹取 —— 那是"这个骰子的取值范围",属于结构;
 * `rateFn` 只回答"基础值是多少",调用方给的天赋/道具加成照旧叠加。
 */
export type RealmBreakthroughConfig = {
  min: number
  max: number
  /** true = 大关必须走天劫/试炼,不掷这个骰子 */
  majorRequiresTrial?: boolean
} & (
  | {
      /** 小层进阶基础成功率与每层衰减 */
      layerBase: number
      layerDecay: number
      /** 大关(跨大境界)基础成功率与每大境界衰减 */
      majorBase: number
      majorDecay: number
      rateFn?: undefined
    }
  | { rateFn: (major: number, layer: number) => number }
)

export interface RealmSystemConfig {
  worlds: WorldConfig[]
  /** 小层名目,默认 ['一层'…'九层','圆满'] —— 顺序即小层序号 */
  layerNames?: readonly string[]
  /** 大境界与小层拼成一行字的模板,默认 '{realm}·{layer}' */
  labelFormat?: string
  /** 每层成长需求:曲线,或 costFn 自己接管 */
  exp: RealmExpConfig
  /** 基础本值:曲线,或 statsFn 自己接管 */
  combat: RealmCombatConfig
  breakthrough: RealmBreakthroughConfig
  /**
   * 「一段生涯的长度」:世界内按 growth 复利,跨界那一次是"大跃"(base 直接给定)。
   * 只给 base/growth 时,后续世界的 base = 上一世界末境寿元 × worldStepMult。
   *
   * **可以不给**:修仙/武侠这类"寿元即压力"的题材需要它,而日常、学习、经营这类
   * 没有生死的游戏不该被迫编一个数字 —— 省略时 `lifespanOf` 返回 Infinity,
   * 境界数据里的 lifespanYears 也是 Infinity(界面显示成"无限"即可)。
   */
  lifespan?:
    | { byWorld: Record<string, { base: number; growth: number }> }
    | { base: number; growth: number; worldStepMult: number }
}

export interface RealmState<T> {
  major: number
  layer: number
  exp: T
}

export interface ProgressView<T> {
  major: number
  layer: number
  label: string
  exp: T
  cost: T
  /** 0~1,已满为 1 */
  ratio: number
  /** 修为已满,可以尝试进阶 */
  ready: boolean
  isMajorStep: boolean
  isWorldStep: boolean
  /** 走完这一步就跨界 */
  atWorldEnd: boolean
}

export interface BreakthroughResult<T> {
  ok: boolean
  rate: number
  /** 成功后的新状态 */
  state: RealmState<T>
  /** 大关:这一步必须走试炼/天劫,本函数不做判定 */
  requiresTrial: boolean
  isMajorStep: boolean
  isWorldStep: boolean
  from: string
  to: string
  /** 未成功时的原因 */
  reason?: 'not-ready' | 'trial' | 'failed' | 'max'
}

export interface RealmSystem<T = number> {
  readonly worlds: readonly WorldDef[]
  readonly realms: readonly RealmDef[]
  readonly layerNames: readonly string[]
  readonly maxMajor: number
  /** **所有境界里最多的层数**(逐境层数可能不同);要问某一境,用 maxLayerOf */
  readonly maxLayer: number
  /** 某境界的小层名目 */
  layersOf(major: number): readonly string[]
  /** 某境界的最大层序号(= 其层数 − 1) */
  maxLayerOf(major: number): number
  realmAt(major: number): RealmDef
  worldOf(major: number): WorldDef
  worldById(id: string): WorldDef | undefined
  /** 跨界点:worldIndex>0 的那些世界的起始大境界序号 */
  worldEntries(): number[]
  isWorldEntry(major: number): boolean
  label(major: number, layer: number): string
  /** 修为需求 */
  expCost(major: number, layer: number): T
  /** 基础本值(攻/防/血,或自定义的任意本值集) */
  baseStats(major: number, layer: number): Record<string, T>
  lifespanOf(major: number): number
  breakthroughRate(major: number, layer: number): number
  isMajorStep(major: number, layer: number): boolean
  isWorldStep(major: number, layer: number): boolean
  progress(state: RealmState<T>): ProgressView<T>
  /** 加修为,封顶在当前小层的需求上(与上游工程同口径:修为不会溢出到下一层) */
  addExp(state: RealmState<T>, amount: T): RealmState<T>
  /** 修为满了才允许进阶;失败保留修为(放置类的宽容口径,可配置) */
  attemptBreakthrough(
    state: RealmState<T>,
    opts: { rng: Rng; bonusRate?: number; keepExpOnFail?: boolean }
  ): BreakthroughResult<T>
}

export const DEFAULT_LAYER_NAMES = ['一层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '圆满'] as const

function slugify(name: string, fallback: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

export function createRealmSystem<T = number>(
  config: RealmSystemConfig,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
): RealmSystem<T> {
  const layerNames = [...(config.layerNames ?? DEFAULT_LAYER_NAMES)]
  if (layerNames.length === 0) throw new Error('等级体系:layerNames 不能为空')
  const labelFormat = config.labelFormat ?? '{realm}·{layer}'

  const realms: RealmDef[] = []
  const worlds: WorldDef[] = []
  let major = 0
  for (const w of config.worlds) {
    if (w.realms.length === 0) throw new Error(`等级体系:世界 ${w.id} 一个境界都没有`)
    const start = major
    for (const entry of w.realms) {
      const def: RealmEntry = typeof entry === 'string' ? { name: entry } : entry
      realms.push({
        id: def.id ?? `${w.id}-${slugify(def.name, String(major))}`,
        name: def.name,
        world: w.id,
        major,
        desc: def.desc,
        lore: def.lore,
        lifespanYears: def.lifespanYears ?? 0,
        layers: def.layers !== undefined && def.layers.length > 0 ? [...def.layers] : layerNames
      })
      major += 1
    }
    worlds.push({ id: w.id, name: w.name, desc: w.desc, start, end: major - 1 })
  }
  const maxMajor = realms.length - 1
  if (maxMajor < 0) throw new Error('等级体系:境界表为空')

  // 成长曲线的分段点:缺省取第一世界之后的那个境界(即"跨界之后")
  const defaultLateFrom = worlds[1]?.start ?? maxMajor + 1
  const expLateFrom = config.exp.lateFrom ?? defaultLateFrom
  const combatLateFrom = config.combat.lateFrom ?? defaultLateFrom
  /** 第 m 境的最后一层(逐境层数可以不同) */
  const endOf = (m: number): number => realms[clamp(m, 0, maxMajor)]!.layers.length - 1
  const maxLayer = Math.max(...realms.map(r => r.layers.length - 1))

  const splitAt = (i: number, lateFrom: number): { early: number; late: number } => {
    const e = Math.min(Math.max(0, i), lateFrom)
    return { early: e, late: Math.max(0, i - e) }
  }
  const realmFactor = (i: number, curve: GrowthCurve, lateFrom: number): T => {
    const seg = splitAt(i, lateFrom)
    const lateGrowth = curve.lateRealmGrowth ?? curve.realmGrowth
    return numeric.mul(numeric.powN(curve.realmGrowth, seg.early), numeric.powN(lateGrowth, seg.late))
  }

  // ---- 寿元表:世界内复利,跨界为大跃 ----
  const lifespanByWorld = new Map<string, { base: number; growth: number; start: number }>()
  const lifespanCfg = config.lifespan
  if (lifespanCfg && 'byWorld' in lifespanCfg) {
    for (const w of worlds) {
      const cfg = lifespanCfg.byWorld[w.id]
      if (!cfg) throw new Error(`等级体系:缺少世界 ${w.id} 的寿元参数`)
      lifespanByWorld.set(w.id, { ...cfg, start: w.start })
    }
  } else if (lifespanCfg) {
    const { base, growth, worldStepMult } = lifespanCfg
    for (const w of worlds) {
      if (w.start === 0) {
        lifespanByWorld.set(w.id, { base, growth, start: 0 })
        continue
      }
      const prev = worlds[worlds.findIndex(x => x.id === w.id) - 1]!
      const prevCfg = lifespanByWorld.get(prev.id)!
      const prevLast = Math.round(prevCfg.base * Math.pow(prevCfg.growth, prev.end - prevCfg.start))
      lifespanByWorld.set(w.id, { base: prevLast * worldStepMult, growth, start: w.start })
    }
  }
  const lifespanOfRaw = (i: number): number => {
    // 没配寿命 = 无限:这类题材里没有"到点就死"的设计
    if (lifespanByWorld.size === 0) return Number.POSITIVE_INFINITY
    const idx = Math.max(0, Math.min(maxMajor, i))
    const w = worlds.find(x => idx >= x.start && idx <= x.end) ?? worlds[0]!
    const cfg = lifespanByWorld.get(w.id)!
    return Math.round(cfg.base * Math.pow(cfg.growth, idx - cfg.start))
  }
  for (const r of realms) r.lifespanYears = r.lifespanYears || lifespanOfRaw(r.major)

  const worldEntries = worlds.slice(1).map(w => w.start)

  const isMajorStep = (m: number, layer: number): boolean => layer >= endOf(m)
  const isWorldStep = (major_: number, layer: number): boolean =>
    isMajorStep(major_, layer) && major_ < maxMajor && worldEntries.includes(major_ + 1)

  const expCost = (major_: number, layer: number): T => {
    const m = clamp(major_, 0, maxMajor)
    const l = clamp(layer, 0, endOf(m))
    // 自己接管需求曲线的:原样用它的数(引擎不插值、不缩放)
    if (config.exp.costFn) return numeric.from(config.exp.costFn(m, l))
    const stepMult = isWorldStep(m, l) ? config.exp.worldStepMult ?? 1 : 1
    const majorFactor = realmFactor(m, config.exp, expLateFrom)
    return numeric.mulN(numeric.mul(majorFactor, numeric.powN(config.exp.layerGrowth, l)), config.exp.base * stepMult)
  }

  const baseStats = (major_: number, layer: number): Record<string, T> => {
    const m = clamp(major_, 0, maxMajor)
    const l = clamp(layer, 0, endOf(m))
    if (config.combat.statsFn) {
      const out: Record<string, T> = {}
      for (const [key, value] of Object.entries(config.combat.statsFn(m, l))) out[key] = numeric.from(value)
      return out
    }
    const factor = numeric.mul(realmFactor(m, config.combat, combatLateFrom), numeric.powN(config.combat.layerGrowth, l))
    const out: Record<string, T> = {}
    for (const [key, base] of Object.entries(config.combat.base)) out[key] = numeric.mulN(factor, base)
    return out
  }

  const breakthroughRate = (major_: number, layer: number): number => {
    const m = clamp(major_, 0, maxMajor)
    const l = clamp(layer, 0, endOf(m))
    const bt = config.breakthrough
    // 自己接管成功率曲线的:原样用它的数(仍受 min/max 夹取 —— 那是取值范围,不是曲线)
    const raw = bt.rateFn ? bt.rateFn(m, l) : isMajorStep(m, l) ? bt.majorBase - m * bt.majorDecay : bt.layerBase - l * bt.layerDecay
    // NaN(0/0、缺参数、表里那一格是空的)先按 0 处理再夹取:它无法比较,`clamp` 也兜不住 ——
    // 而 NaN 一旦传到骰子上就是"永远失败",玩家只看到"我明明满了却一直失败",界面上连个可疑的数都没有。
    // ±Infinity 不在此列:它仍有方向(照旧被夹到 min/max 那一端),行为与旧版逐位一致。
    return clamp(Number.isNaN(raw) ? 0 : raw, bt.min, bt.max)
  }

  const label = (major_: number, layer: number): string => {
    const r = realms[clamp(major_, 0, maxMajor)]!
    const name = r.layers[clamp(layer, 0, r.layers.length - 1)] ?? String(layer)
    /*
     * 三个占位符:`{realm}` 境界名、`{layer}` 小层名、`{world}` 界域名。
     *
     * `{world}` 是后补的 —— 起因是"拿发布包按定制表改一遍"的探针写了 `{world}/{realm}/{layer}`,
     * 结果标签里原样留着 `{world}` 四个字符:模板不认识它,也不报错。界域名字本来就是现成的
     * (`worldOf(major).name`),而"人间界/炼气/三层"这种写法对多界域题材很常见,所以补上;
     * **不认识的占位符仍然原样保留**(那是排版自由,不是错误)。
     */
    return labelFormat
      .replace('{world}', worlds.find(w => r.major >= w.start && r.major <= w.end)?.name ?? '')
      .replace('{realm}', r.name)
      .replace('{layer}', name)
  }

  const progress = (state: RealmState<T>): ProgressView<T> => {
    const m = clamp(state.major, 0, maxMajor)
    const l = clamp(state.layer, 0, endOf(m))
    const cost = expCost(m, l)
    const ratioNum = cost === numeric.zero ? 1 : numeric.toNumber(numeric.div(state.exp, cost))
    const ratio = clamp(Number.isFinite(ratioNum) ? ratioNum : 1, 0, 1)
    return {
      major: m,
      layer: l,
      label: label(m, l),
      exp: state.exp,
      cost,
      ratio,
      ready: numeric.cmp(state.exp, cost) >= 0,
      isMajorStep: isMajorStep(m, l),
      isWorldStep: isWorldStep(m, l),
      atWorldEnd: l >= endOf(m)
    }
  }

  const addExp = (state: RealmState<T>, amount: T): RealmState<T> => {
    const cost = expCost(state.major, state.layer)
    const sum = numeric.add(state.exp, amount)
    return { ...state, exp: numeric.cmp(sum, cost) > 0 ? cost : sum }
  }

  const attemptBreakthrough = (
    state: RealmState<T>,
    opts: { rng: Rng; bonusRate?: number; keepExpOnFail?: boolean }
  ): BreakthroughResult<T> => {
    const m = clamp(state.major, 0, maxMajor)
    const l = clamp(state.layer, 0, endOf(m))
    const majorStep = isMajorStep(m, l)
    const worldStep = isWorldStep(m, l)
    const from = label(m, l)
    // 加成那一项也可能是 NaN(道具/天赋叠出来的、缺字段),一并挡在这里(Infinity 照旧有方向)
    const rawBonus = opts.bonusRate ?? 0
    const bonus = Number.isNaN(rawBonus) ? 0 : rawBonus
    const rate = clamp(breakthroughRate(m, l) + bonus, config.breakthrough.min, config.breakthrough.max)
    const atMax = m >= maxMajor && l >= endOf(m)
    if (atMax) {
      return { ok: false, rate, state, requiresTrial: false, isMajorStep: majorStep, isWorldStep: worldStep, from, to: from, reason: 'max' }
    }
    if (numeric.cmp(state.exp, expCost(m, l)) < 0) {
      return { ok: false, rate, state, requiresTrial: false, isMajorStep: majorStep, isWorldStep: worldStep, from, to: from, reason: 'not-ready' }
    }
    if (config.breakthrough.majorRequiresTrial && majorStep) {
      return { ok: false, rate, state, requiresTrial: true, isMajorStep: majorStep, isWorldStep: worldStep, from, to: from, reason: 'trial' }
    }
    const ok = opts.rng.chance(rate)
    if (!ok) {
      const kept = opts.keepExpOnFail === false ? { ...state, exp: numeric.zero } : state
      return { ok: false, rate, state: kept, requiresTrial: false, isMajorStep: majorStep, isWorldStep: worldStep, from, to: from, reason: 'failed' }
    }
    const next: RealmState<T> = majorStep ? { major: m + 1, layer: 0, exp: numeric.zero } : { major: m, layer: l + 1, exp: numeric.zero }
    return { ok: true, rate, state: next, requiresTrial: false, isMajorStep: majorStep, isWorldStep: worldStep, from, to: label(next.major, next.layer) }
  }

  return {
    worlds,
    realms,
    layerNames,
    maxMajor,
    maxLayer,
    layersOf: m => realms[clamp(m, 0, maxMajor)]!.layers,
    maxLayerOf: m => endOf(clamp(m, 0, maxMajor)),
    realmAt: major_ => realms[clamp(major_, 0, maxMajor)]!,
    worldOf: major_ => worlds.find(w => clamp(major_, 0, maxMajor) >= w.start && clamp(major_, 0, maxMajor) <= w.end) ?? worlds[0]!,
    worldById: id => worlds.find(w => w.id === id),
    worldEntries: () => [...worldEntries],
    isWorldEntry: major_ => worldEntries.includes(major_),
    label,
    expCost,
    baseStats,
    lifespanOf: lifespanOfRaw,
    breakthroughRate,
    isMajorStep,
    isWorldStep,
    progress,
    addExp,
    attemptBreakthrough
  }
}

/** 一行字的进度描述:「炼气·三层 120/400(30%)」 */
export function progressText<T>(system: RealmSystem<T>, state: RealmState<T>, format: (v: T) => string): string {
  const p = system.progress(state)
  return `${p.label} ${format(p.exp)}/${format(p.cost)}(${Math.floor(p.ratio * 100)}%)`
}
