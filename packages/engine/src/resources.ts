/**
 * 资源账本 —— 货币 / 材料 / 点数这一层。
 *
 * ## 为什么单开一个模块
 *
 * 等级、属性、装备、副本、技能、炼制、伙伴、目标、离线时长账……这些库里都有,
 * 唯独"灵石 / 信用点 / 零花钱"这一层没有 —— 于是每个拿库的人都要在库外面重写一遍
 * 钱包、上限、买得起买不起、以及"这批资源到底是哪来的"。这一层就是那件事。
 *
 * ## 三件事写死,其余全归你
 *
 * 一 **收支要带来源**(`source`):否则事后没人答得上来"这批灵石是哪来的";
 * 二 **上下限在落账时夹取**,而不是事后修补 —— 于是"上限 100 时收 150"永远是 100;
 * 三 **不够就整笔不扣**(默认):`pay` 失败时账本原样不动并给出缺口,调用方再决定
 *   是"分几次付"还是"提示买不起"。要允许部分支付就显式开 `partial`。
 *
 * 它不认识"灵石"这两个字:键名、上限、名字都由你给(与属性系统同一个约定)。
 * 数值走 `Numeric<T>` —— 大数实现照旧可以直接插进来。
 */
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'

export interface ResourceDef {
  /** 机制键:存档、账目、内容表都认它 */
  key: string
  /** 展示名;省略时用 key */
  name?: string
  /** 上限(省略 = 不封顶);`capFn` 给定时以它为准 */
  cap?: number
  /** 下限,默认 0(即"不可为负") */
  floor?: number
}

/** 一本账:资源键 → 数量。纯数据,随便序列化 */
export type Ledger<T> = Record<string, T>

export interface ResourceEntry {
  key: string
  /** 正数 = 收入,负数 = 支出 */
  amount: number
  /** 来源 / 去向标签(审计用);不填归到 "(未标)" */
  source?: string
}

export interface AppliedEntry extends ResourceEntry {
  /** 实际发生的额(被上下限夹过之后;可能是 0) */
  applied: number
  /** 这一条被上下限动过? */
  clamped: boolean
}

export interface ResourceSummary {
  income: number
  expense: number
  net: number
}

export interface ResourceSystemConfig {
  resources: readonly ResourceDef[]
  /**
   * 上限可以随账本变化(洞府升级、buff 加成)。
   * 给了它就以它为准,`ResourceDef.cap` 退成"默认值"。
   */
  capFn?: (key: string, ledger: Ledger<unknown>) => number | undefined
}

export function createResourceSystem<T = number>(
  config: ResourceSystemConfig,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
) {
  const defs = [...config.resources]
  const byKey = new Map(defs.map(d => [d.key, d]))
  const zero = numeric.zero

  const floorOf = (key: string): number => byKey.get(key)?.floor ?? 0
  const capOf = (key: string, ledger: Ledger<T>): number => {
    const fromFn = config.capFn?.(key, ledger as Ledger<unknown>)
    if (fromFn !== undefined) return fromFn
    return byKey.get(key)?.cap ?? Number.POSITIVE_INFINITY
  }
  const of = (ledger: Ledger<T>, key: string): T => ledger[key] ?? zero
  const numberOf = (ledger: Ledger<T>, key: string): number => numeric.toNumber(of(ledger, key))

  const clampValue = (key: string, ledger: Ledger<T>, value: number): number => {
    const floor = floorOf(key)
    const cap = capOf(key, ledger)
    return Math.min(cap, Math.max(floor, value))
  }

  /** 逐条落账;返回新账本(不改入参)与每条的实际发生额 */
  const apply = (
    ledger: Ledger<T>,
    entries: readonly ResourceEntry[]
  ): { ledger: Ledger<T>; entries: AppliedEntry[]; rejected: ResourceEntry[] } => {
    const next: Ledger<T> = { ...ledger }
    const applied: AppliedEntry[] = []
    const rejected: ResourceEntry[] = []
    for (const entry of entries) {
      if (!entry || typeof entry.key !== 'string' || !Number.isFinite(entry.amount)) {
        // 内容写错不该让整场结算炸掉:这一条丢掉,其余照收照付
        if (entry) rejected.push(entry)
        continue
      }
      const before = numeric.toNumber(next[entry.key] ?? zero)
      const after = clampValue(entry.key, next, before + entry.amount)
      const delta = after - before
      next[entry.key] = numeric.from(after)
      applied.push({ ...entry, applied: delta, clamped: Math.abs(delta - entry.amount) > 1e-9 })
    }
    return { ledger: next, entries: applied, rejected }
  }

  /** 缺口:买不起时缺多少(逐项;只报正数) */
  const shortfall = (ledger: Ledger<T>, costs: readonly ResourceEntry[]): { key: string; short: number }[] => {
    const need = new Map<string, number>()
    for (const cost of costs) {
      if (cost && typeof cost.key === 'string' && Number.isFinite(cost.amount)) {
        need.set(cost.key, (need.get(cost.key) ?? 0) + cost.amount)
      }
    }
    const out: { key: string; short: number }[] = []
    for (const [key, amount] of need) {
      const short = Math.max(0, amount - numberOf(ledger, key))
      if (short > 0) out.push({ key, short })
    }
    return out
  }

  const canAfford = (ledger: Ledger<T>, costs: readonly ResourceEntry[]): boolean => shortfall(ledger, costs).length === 0

  /**
   * 支出。
   *
   * 默认**整笔要么全成、要么不动** —— 因为"扣了一半发现不够"是最难跟玩家解释的状态;
   * 要允许分次付(先付多少算多少)就显式开 `partial`。
   */
  const pay = (
    ledger: Ledger<T>,
    costs: readonly ResourceEntry[],
    opts: { partial?: boolean } = {}
  ): { ok: boolean; ledger: Ledger<T>; entries: AppliedEntry[]; shortfall: { key: string; short: number }[] } => {
    const lacking = shortfall(ledger, costs)
    if (lacking.length > 0 && !opts.partial) {
      return { ok: false, ledger, entries: [], shortfall: lacking }
    }
    // 支出按"要付多少"写(正数),落账时才变成负的 —— 调用方不必自己记"这里得写负号"
    const result = apply(
      ledger,
      costs.map(cost => ({ ...cost, amount: -Math.abs(cost.amount) }))
    )
    return { ok: lacking.length === 0, ledger: result.ledger, entries: result.entries, shortfall: lacking }
  }

  /** 收入(照夹上限) */
  const grant = (ledger: Ledger<T>, gains: readonly ResourceEntry[]): { ledger: Ledger<T>; entries: AppliedEntry[] } => {
    const result = apply(ledger, gains)
    return { ledger: result.ledger, entries: result.entries }
  }

  /**
   * 按步产出 —— 与 `idle` 的步数账对接:每一步给一份,逐步夹上限。
   *
   * 为什么要"逐步"而不是"乘起来":上限会在中途生效(挂机 8 小时只吃到上限那一段),
   * 一次乘完再加是算不出来的 —— 这正是挂机收益最常算错的地方。
   */
  const produce = (
    ledger: Ledger<T>,
    steps: number,
    perStep: readonly ResourceEntry[],
    opts: { source?: string } = {}
  ): { ledger: Ledger<T>; entries: AppliedEntry[] } => {
    let current = ledger
    const entries: AppliedEntry[] = []
    const n = Math.max(0, Math.floor(steps))
    for (let i = 0; i < n; i += 1) {
      const step = perStep.map(e => ({ ...e, source: opts.source ?? e.source }))
      const result = apply(current, step)
      current = result.ledger
      entries.push(...result.entries)
    }
    return { ledger: current, entries }
  }

  /** 审计:按资源、按来源各汇总一份。明细恒等于合计 —— 这条由用例钉着 */
  const audit = (entries: readonly AppliedEntry[]): { byKey: Record<string, ResourceSummary>; bySource: Record<string, ResourceSummary> } => {
    const byKey: Record<string, ResourceSummary> = {}
    const bySource: Record<string, ResourceSummary> = {}
    const bump = (table: Record<string, ResourceSummary>, label: string, amount: number): void => {
      const row = (table[label] ??= { income: 0, expense: 0, net: 0 })
      if (amount >= 0) row.income += amount
      else row.expense += -amount
      row.net += amount
    }
    for (const entry of entries) {
      bump(byKey, entry.key, entry.applied)
      bump(bySource, entry.source ?? '(未标)', entry.applied)
    }
    return { byKey, bySource }
  }

  /** 新建一本账:按定义铺零,再叠加初始值(初始值也夹上下限) */
  const create = (initial: Record<string, number> = {}): Ledger<T> => {
    const ledger: Ledger<T> = {}
    for (const def of defs) ledger[def.key] = numeric.from(clampValue(def.key, ledger, initial[def.key] ?? 0))
    return ledger
  }

  /**
   * 形状修复:存档里那一格可能是字符串、null、负数、超过上限的数 —— 一律按定义兜回来。
   * 未知键原样留着(可能是更老的存档留下的,删了更糟)。
   */
  const normalize = (raw: unknown): Ledger<T> => {
    const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const ledger: Ledger<T> = {}
    for (const def of defs) {
      const value = Number(source[def.key])
      const safe = Number.isFinite(value) ? value : 0
      ledger[def.key] = numeric.from(clampValue(def.key, ledger, safe))
    }
    for (const [key, value] of Object.entries(source)) {
      if (key in ledger) continue
      const n = Number(value)
      if (Number.isFinite(n)) ledger[key] = numeric.from(n)
    }
    return ledger
  }

  return {
    defs,
    def: (key: string): ResourceDef | undefined => byKey.get(key),
    name: (key: string): string => byKey.get(key)?.name ?? key,
    capOf,
    floorOf,
    create,
    of,
    numberOf,
    canAfford,
    shortfall,
    pay,
    grant,
    apply,
    produce,
    audit,
    normalize
  }
}

export type ResourceSystem<T = number> = ReturnType<typeof createResourceSystem<T>>
