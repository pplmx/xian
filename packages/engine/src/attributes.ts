/**
 * 属性系统 —— 词条登记表 + 合并规则 + 最终属性结算。
 *
 * ## 为什么属性名要能配置
 *
 * 机制键(`key`)是引擎的接口:它出现在公式、存档与内容里,不该随题材改名。
 * 展示名(`name`)是**作品的名字**:"攻击" 换成 "术法"、"暴击率" 换成 "会心率",
 * 换的是同一套机制的外衣。本文件把这两件事分开 —— 于是换皮不改机制。
 *
 * ## 三层数值
 *
 *   本值(base)  ← 等级/境界曲线给的攻防血(或别的本值)
 *   平铺(flat)  ← 装备这类"直接加到本值上"的数值
 *   词条(mods)  ← 百分比与独立加成,按 `appliesTo` 作用到某个本值上
 *   另乘(onTop) ← 转世/道果这类"不在百分比里相加,另行乘算"的全局系数
 *
 * 合并里有两道非线性(与上游工程同源,故能一一对账):
 *   一 递减词条:同一条件词条多来源时按 1 / 0.75 / 0.5 / 0.25 递减计入;
 *   二 软阈值:合计越过 cap 后,超出部分按 diminish 折算(极端堆叠的第二道防线)。
 * 两道折算都能摊回来源(见 `mergeModsDetailed`),面板明细之和才会等于面板值。
 */
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'

/** 一组词条。值为 undefined 表示"这一来源没有该词条"(便于对象字面量里按需省略) */
export type Mods = Record<string, number | undefined>

/**
 * 一条属性的定义。
 *
 * `kind`:
 *   - `flat`    本值:参与"平铺 × 百分比"的结算(攻/防/血,或你自定义的力量/敏捷/智力)
 *   - `percent` 百分比:按 `appliesTo` 作用到某个本值上(改名成"术法加成"也一样)
 *   - `rate`    独立加成:概率、倍率、速度这类不折算本值的词条(暴击率/吸血/修炼速度)
 */
export interface AttributeDef {
  key: string
  name: string
  kind: 'flat' | 'percent' | 'rate'
  /** percent 类作用到哪个本值键;省略表示只做展示 */
  appliesTo?: string
  /** 面板分组(战斗/修行/经济……),纯展示用 */
  category?: string
  desc?: string
  /** 同键多来源时按递减阶梯计入(条件/触发类词条用) */
  diminishing?: boolean
  /** 合计越过软阈值后的折算规则 */
  softCap?: { cap: number; diminish: number }
  /** 展示格式:小数位与单位 */
  decimals?: number
  unit?: string
  /** 不计入"构筑深度"统计(核心三围百分比、修炼速度这类不体现构筑厚度的) */
  noDepth?: boolean
}

export interface AttributeSystemConfig {
  defs: AttributeDef[]
  /** 参与最终属性结算的本值键;省略时取所有 kind==='flat' */
  core?: string[]
  /** 战力评分权重(键 → 权重),默认 { attack: 3, defense: 2, maxHp: 0.15 } */
  powerWeights?: Record<string, number>
  /** 递减阶梯,默认 [1, 0.75, 0.5, 0.25] */
  diminishingWeights?: readonly number[]
  /**
   * 递减**算法**本身 —— 不是所有作品都想要"按贡献降序打折"。
   *
   *   `ranked`(默认):来源按数值降序,逐个乘阶梯权重(上游工程的做法);
   *   `max`         :同名只取最强的那一份,其余不计(干脆利落,适合"不许叠"的题材);
   *   `sum`         :同名直接相加(等于关掉递减,但比逐条改 def 省事);
   *   或者给 `fold`:自己接管 —— 拿到一组数值,返回计入的合计。
   *
   * 无论哪种,面板明细都仍会摊回各来源(合计恒等于明细之和);`fold` 下按各自占比摊。
   */
  diminish?: {
    mode?: 'ranked' | 'max' | 'sum'
    fold?: (values: readonly number[]) => number
  }
}

export interface OnTopMult {
  name: string
  /** 键 → 乘数(1.2 表示 ×1.2),另行乘在最终值上 */
  mult: Record<string, number>
  desc?: string
}

export interface StatsInput<T> {
  /** 本值(等级/境界曲线给的底子) */
  base: Record<string, T>
  /** 平铺加成(数字) */
  flat?: Record<string, number>
  /** 平铺加成(已是目标数值类型,大数库用) */
  flatAmounts?: Record<string, T>
  /** 百分比与独立加成来源 */
  modSources?: readonly Mods[]
  /** 来源名,与 modSources 一一对应(面板明细用) */
  sourceNames?: readonly string[]
  /** 另乘来源(转世/道果/全局难度系数) */
  onTop?: readonly OnTopMult[]
}

export interface ComputedStats<T> {
  base: Record<string, T>
  /** 本值 + 平铺 */
  total: Record<string, T>
  /** 合并后的词条(含递减与软阈值折算) */
  mods: Mods
  /** 应用 appliesTo 之后的最终值 */
  final: Record<string, T>
  breakdown: { name: string; mods: Mods }[]
  power: T
}

export interface AttributeSystem<T = number> {
  readonly defs: readonly AttributeDef[]
  readonly coreKeys: readonly string[]
  def(key: string): AttributeDef | undefined
  name(key: string): string
  format(key: string, value: number): string
  /** 合并多个来源的百分比/独立词条(递减 + 软阈值) */
  mergeMods(sources: readonly Mods[]): Mods
  /** 同上,并额外回答"每一份最终值是谁给的" */
  mergeModsDetailed(sources: readonly Mods[]): { mods: Mods; effective: Mods[] }
  /** 某键是否已进入软阈值递减区(展示层提示用) */
  isSoftCapped(mods: Mods, key: string): boolean
  /** 构筑深度:所有正向"构筑词条"的数值总和 */
  modDepth(mods: Mods): number
  /** 本值 × 平铺 × 百分比 × 另乘 = 最终属性 */
  compute(input: StatsInput<T>): ComputedStats<T>
  /** 把一组词条摊成人话(「攻击 +12.5%」「暴击率 +3%」) */
  describe(mods: Mods): string[]
}

const DEFAULT_DIMINISHING_WEIGHTS = [1, 0.75, 0.5, 0.25] as const

function percentText(def: AttributeDef | undefined, value: number): string {
  const decimals = def?.decimals ?? 1
  const unit = def?.unit ?? (def?.kind === 'percent' ? '%' : '')
  return `${(value * 100).toFixed(decimals)}${unit || '%'}`
}

export function createAttributeSystem<T = number>(
  config: AttributeSystemConfig,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
): AttributeSystem<T> {
  const defs = [...config.defs]
  const byKey = new Map<string, AttributeDef>()
  for (const d of defs) {
    if (byKey.has(d.key)) throw new Error(`属性系统:键重复 —— ${d.key}`)
    byKey.set(d.key, d)
  }
  const coreKeys = config.core ?? defs.filter(d => d.kind === 'flat').map(d => d.key)
  for (const k of coreKeys) {
    if (!byKey.has(k)) throw new Error(`属性系统:core 里的键未登记 —— ${k}`)
  }
  for (const d of defs) {
    if (d.appliesTo !== undefined && !byKey.has(d.appliesTo)) {
      throw new Error(`属性系统:${d.key} 的 appliesTo 指向未登记的键 —— ${d.appliesTo}`)
    }
  }
  const powerWeights = config.powerWeights ?? { attack: 3, defense: 2, maxHp: 0.15 }
  const weights = config.diminishingWeights ?? DEFAULT_DIMINISHING_WEIGHTS

  const mergeModsDetailed = (sources: readonly Mods[]): { mods: Mods; effective: Mods[] } => {
    const out: Mods = {}
    const effective: Mods[] = sources.map(() => ({}))
    const diminished = new Map<string, { src: number; value: number }[]>()

    sources.forEach((src, si) => {
      for (const k in src) {
        const v = src[k]
        if (typeof v !== 'number' || v === 0 || Number.isNaN(v)) continue
        if (v > 0 && byKey.get(k)?.diminishing === true) {
          const list = diminished.get(k)
          if (list) list.push({ src: si, value: v })
          else diminished.set(k, [{ src: si, value: v }])
        } else {
          out[k] = (out[k] ?? 0) + v
          effective[si]![k] = (effective[si]![k] ?? 0) + v
        }
      }
    })

    const diminish = config.diminish
    const attribute = (src: number, key: string, counted: number): void => {
      const bucket = effective[src]!
      bucket[key] = (bucket[key] ?? 0) + counted
    }
    for (const [key, list] of diminished) {
      let total = 0
      if (diminish?.fold) {
        // 自己接管:按各来源占比摊回,保证"明细之和 = 合计"
        const raw = list.reduce((acc, e) => acc + e.value, 0)
        total = diminish.fold(list.map(e => e.value))
        if (raw > 0) for (const e of list) attribute(e.src, key, (e.value / raw) * total)
      } else if ((diminish?.mode ?? 'ranked') === 'sum') {
        for (const e of list) {
          total += e.value
          attribute(e.src, key, e.value)
        }
      } else if (diminish?.mode === 'max') {
        let best = list[0]!
        for (const e of list) if (e.value > best.value) best = e
        total = best.value
        attribute(best.src, key, best.value)
      } else {
        const sorted = [...list].sort((a, b) => b.value - a.value)
        for (let i = 0; i < sorted.length; i += 1) {
          const entry = sorted[i]!
          const counted = entry.value * (weights[Math.min(i, weights.length - 1)] ?? 0.25)
          total += counted
          attribute(entry.src, key, counted)
        }
      }
      out[key] = (out[key] ?? 0) + total
    }

    // 软阈值:同乘一个系数摊回各来源,故明细之和仍等于合计
    for (const d of defs) {
      const rule = d.softCap
      const v = out[d.key]
      if (!rule || typeof v !== 'number' || v <= rule.cap) continue
      const scaled = rule.cap + (v - rule.cap) * rule.diminish
      const factor = scaled / v
      for (const bucket of effective) {
        const own = bucket[d.key]
        if (typeof own === 'number' && own !== 0) bucket[d.key] = own * factor
      }
      out[d.key] = scaled
    }
    return { mods: out, effective }
  }

  const mergeMods = (sources: readonly Mods[]): Mods => mergeModsDetailed(sources).mods

  const isSoftCapped = (mods: Mods, key: string): boolean => {
    const rule = byKey.get(key)?.softCap
    const v = mods[key]
    return rule !== undefined && typeof v === 'number' && v >= rule.cap
  }

  const modDepth = (mods: Mods): number => {
    let sum = 0
    for (const k in mods) {
      const v = mods[k]
      if (typeof v !== 'number' || v <= 0) continue
      const def = byKey.get(k)
      if (def?.noDepth || def?.kind === 'percent') continue
      sum += v
    }
    return sum
  }

  const compute = (input: StatsInput<T>): ComputedStats<T> => {
    const sources = input.modSources ?? []
    const { mods, effective } = mergeModsDetailed(sources)
    const total: Record<string, T> = {}
    for (const key of coreKeys) {
      const base = input.base[key] ?? numeric.zero
      const flat = numeric.add(numeric.from(input.flat?.[key] ?? 0), input.flatAmounts?.[key] ?? numeric.zero)
      total[key] = numeric.add(base, flat)
    }
    const final: Record<string, T> = { ...total }
    for (const key of coreKeys) {
      let pct = 0
      for (const d of defs) {
        if (d.kind !== 'percent' || d.appliesTo !== key) continue
        const v = mods[d.key]
        if (typeof v === 'number') pct += v
      }
      let value = pct !== 0 ? numeric.mulN(total[key] ?? numeric.zero, 1 + pct) : total[key] ?? numeric.zero
      for (const onTop of input.onTop ?? []) {
        const m = onTop.mult[key]
        if (typeof m === 'number' && m !== 1) value = numeric.mulN(value, m)
      }
      final[key] = value
    }
    let power = numeric.zero
    for (const key of coreKeys) {
      const w = powerWeights[key]
      if (typeof w !== 'number' || w === 0) continue
      power = numeric.add(power, numeric.mulN(final[key] ?? numeric.zero, w))
    }
    const breakdown = sources.map((_src, i) => ({
      name: input.sourceNames?.[i] ?? `来源 ${i + 1}`,
      mods: effective[i] ?? {}
    }))
    return { base: input.base, total, mods, final, breakdown, power }
  }

  const describe = (mods: Mods): string[] => {
    const out: string[] = []
    for (const key in mods) {
      const v = mods[key]
      if (typeof v !== 'number' || v === 0) continue
      const def = byKey.get(key)
      out.push(`${def?.name ?? key} +${percentText(def, v)}`)
    }
    return out
  }

  return {
    defs,
    coreKeys,
    def: key => byKey.get(key),
    name: key => byKey.get(key)?.name ?? key,
    format: (key, value) => percentText(byKey.get(key), value),
    mergeMods,
    mergeModsDetailed,
    isSoftCapped,
    modDepth,
    compute,
    describe
  }
}

/**
 * 起始属性集 —— 一套"能直接跑"的通用词条。
 *
 * 换皮的做法是覆盖 `name`(可只写要改的那几条),机制键保持不变:
 *   `attributeDefs([{ key: 'critRate', name: '会心率' }])`
 * 想加自己的维度(例如"内力""神识")就追加新定义,再把 `core` 指过去。
 */
export const DEFAULT_ATTRIBUTES: readonly AttributeDef[] = [
  { key: 'attack', name: '攻击', kind: 'flat', category: '战斗' },
  { key: 'defense', name: '防御', kind: 'flat', category: '战斗' },
  { key: 'maxHp', name: '生命上限', kind: 'flat', category: '战斗' },
  { key: 'attackPct', name: '攻击加成', kind: 'percent', appliesTo: 'attack', noDepth: true, category: '战斗' },
  { key: 'defensePct', name: '防御加成', kind: 'percent', appliesTo: 'defense', noDepth: true, category: '战斗' },
  { key: 'maxHpPct', name: '生命加成', kind: 'percent', appliesTo: 'maxHp', noDepth: true, category: '战斗' },
  { key: 'critRate', name: '暴击率', kind: 'rate', softCap: { cap: 0.75, diminish: 0.5 }, category: '战斗' },
  { key: 'critDamage', name: '暴击伤害', kind: 'rate', decimals: 0, category: '战斗' },
  { key: 'damageBonus', name: '伤害增幅', kind: 'rate', category: '战斗' },
  { key: 'damageReduction', name: '伤害减免', kind: 'rate', softCap: { cap: 0.55, diminish: 0.4 }, category: '战斗' },
  { key: 'accuracy', name: '命中', kind: 'rate', softCap: { cap: 0.55, diminish: 0.4 }, category: '战斗' },
  { key: 'dodgeRate', name: '闪避', kind: 'rate', softCap: { cap: 0.55, diminish: 0.4 }, category: '战斗' },
  { key: 'speed', name: '先手判定', kind: 'rate', category: '战斗' },
  { key: 'lifesteal', name: '吸血', kind: 'rate', category: '战斗' },
  { key: 'counterRate', name: '反击概率', kind: 'rate', diminishing: true, category: '战斗' },
  { key: 'shieldOnStart', name: '开战护盾', kind: 'rate', diminishing: true, softCap: { cap: 0.8, diminish: 0.5 }, category: '战斗' },
  { key: 'regenPerRound', name: '回合回复', kind: 'rate', category: '战斗' },
  { key: 'firstStrike', name: '首回合伤害', kind: 'rate', diminishing: true, category: '战斗' },
  { key: 'cultivationSpeed', name: '修炼速度', kind: 'rate', noDepth: true, category: '修行' },
  { key: 'breakthroughRate', name: '进阶成功率', kind: 'rate', category: '修行' },
  { key: 'expGain', name: '战斗修为', kind: 'rate', category: '修行' },
  { key: 'qiRegen', name: '灵气恢复', kind: 'rate', category: '修行' },
  { key: 'lifespanPct', name: '寿元上限', kind: 'rate', category: '修行' },
  { key: 'luck', name: '气运', kind: 'rate', category: '经济' },
  { key: 'dropRate', name: '掉落率', kind: 'rate', category: '经济' },
  { key: 'spiritStoneGain', name: '货币获取', kind: 'rate', category: '经济' },
  { key: 'explorationSpeed', name: '探索速度', kind: 'rate', category: '经济' }
]

/**
 * 用默认属性集 + 覆盖项生成一份定义表。
 *
 * - 覆盖同名键 = 换名字/改格式,机制不变
 * - `extra` = 追加新维度
 * - `omit` = 删掉不要的(删掉 core 三围之一时请同时改 `core`)
 */
export function attributeDefs(opts: {
  rename?: Partial<Record<string, string>>
  patch?: (Partial<AttributeDef> & { key: string })[]
  extra?: AttributeDef[]
  omit?: string[]
  base?: readonly AttributeDef[]
}): AttributeDef[] {
  const omit = new Set(opts.omit ?? [])
  const out: AttributeDef[] = []
  for (const d of opts.base ?? DEFAULT_ATTRIBUTES) {
    if (omit.has(d.key)) continue
    const renamed = opts.rename?.[d.key]
    out.push(renamed ? { ...d, name: renamed } : { ...d })
  }
  const index = new Map(out.map((d, i) => [d.key, i]))
  for (const p of opts.patch ?? []) {
    const i = index.get(p.key)
    if (i === undefined) out.push({ ...(p as AttributeDef) })
    else out[i] = { ...out[i]!, ...p }
  }
  out.push(...(opts.extra ?? []))
  return out
}
