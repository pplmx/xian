/**
 * 炼制 / 技艺 —— 「成功率由几个乘区相乘」这件事的通用骨架。
 *
 * ## 为什么不是一个"够级就成"的硬门槛
 *
 * 硬门槛的问题是它把"我准备得怎么样"压成一个布尔值:够级必成、不够级必败。
 * 于是知识(记得多少配方)、材料(认不认得方中之物)、技艺(练到什么程度)、
 * 越级(方子高出我多少)这四条本可以各自权衡的线,全被一条线吞掉。
 *
 * 这里的写法是**四个乘区相乘、各有下限**:
 *   任何一项弱都不会把成功率直接归零,但四项全弱时结果自然低到不该开炉。
 * 越级另走一条**陡峭**的曲线(不是禁止,是代价陡)。
 *
 * ## 另外两条配套的曲线
 *
 *   熟练度:双曲饱和 `100·e/(e+scale)` —— 永远逼近上限而不到顶。
 *     技艺没有"练满"一说,也就不存在"满级通吃";要练满就得把 scale 调没,
 *     那是作品的选择,不是引擎的默认。
 *   分档:给裸数字起名字(生疏 → 大成)。玩家读名字,不读数字。
 */

// ============ 熟练度 ============

/**
 * 累积经验 → 熟练度 0~上限(默认 100)。
 *
 * 双曲饱和:经验越多越接近上限,但**永远不到顶**。想给"练满"留口子,
 * 就在上层按 level ≥ 某阈值判定,而不是让这条曲线到顶 —— 后者会让后期经验白涨。
 */
export function proficiencyFromExp(exp: number, scale: number, cap = 100): number {
  const e = Math.max(0, exp)
  if (!(scale > 0)) return cap
  return (cap * e) / (e + scale)
}

/** 分档:给裸数字起名字(按 min 从高到低找第一档) */
export interface StageDef {
  min: number
  name: string
}

export function stageNameOf(level: number, stages: readonly StageDef[], fallback = ''): string {
  return stages.find(s => level >= s.min)?.name ?? fallback
}

// ============ 技艺水平 ============

/** 按权重求技艺水平(权重为 0 或 undefined 的项不参与,全无权重时返回 0) */
export function weightedSkill(
  weights: Readonly<Record<string, number | undefined>>,
  levelOf: (id: string) => number
): number {
  let total = 0
  let weight = 0
  for (const [id, w] of Object.entries(weights)) {
    if (w === undefined) continue
    total += levelOf(id) * w
    weight += w
  }
  return weight > 0 ? total / weight : 0
}

/** 平均认知度:每项按 max 归一后取平均;空列表视为"全懂"(没有未知之物) */
export function averageLore(ids: readonly string[], loreOf: (id: string) => number, max: number): number {
  if (ids.length === 0) return 1
  if (!(max > 0)) return 0
  let sum = 0
  for (const id of ids) sum += Math.min(max, Math.max(0, loreOf(id))) / max
  return sum / ids.length
}

// ============ 成功率 ============

/**
 * 越级惩罚:前几档查表,再往深处走指数衰减。
 *
 * 表是"高一阶还有几成把握"的意思([1, 0.6, 0.35, 0.18] = 高三阶只剩一成八),
 * 表外用 decay 继续衰减 —— 强炼是陡峭的代价,不是一堵墙。
 */
export interface OverReachSpec {
  /** 各档系数,下标即超出的阶数(下标 0 = 没越级) */
  table: readonly number[]
  /** 表外每多一阶乘的系数 */
  decay: number
}

export function overReachFactor(over: number, spec: OverReachSpec): number {
  if (over <= 0) return 1
  const last = spec.table.length - 1
  if (over <= last) return spec.table[over] ?? 1
  const tail = spec.table[last] ?? 1
  return tail * Math.pow(spec.decay, over - last)
}

/**
 * 一个乘区:`下限 + 跨度 × clamp01(值)`。
 *
 * 下限的存在是刻意的 —— 四项全弱时成功率应当**低到不该开炉**,而不是等于 0:
 * 0 会让"赌一把"这个选择消失,而那正是这套设计想留给玩家的事。
 */
export interface LeverSpec {
  floor: number
  span: number
  /**
   * 自定义曲线(**可选**):给了它就用它,`floor/span` 只当兜底。
   *
   * 默认曲线是线性的(下限 + 跨度 × clamp01),但"技艺越高越陡"、
   * "前几级几乎没差别"这类手感需要别的形状 —— 直接给一条函数,不必让库猜。
   * 契约:返回一个乘数,0~1 之间最自然(库不替你夹取)。
   */
  curve?: (value: number) => number
}

export function leverFactor(value: number, spec: LeverSpec): number {
  if (spec.curve) return spec.curve(Math.max(0, Math.min(1, value)))
  return spec.floor + spec.span * Math.max(0, Math.min(1, value))
}

export interface CraftFormula {
  /** 各项皆满且不越级时的成功率上限 —— 剩下的留给天意 */
  baseRate: number
  /**
   * 乘区表:**几个、叫什么,全由作品定**。
   *
   * 云隐修仙录用的是"掌握 / 认知 / 技艺"三区(再加越级),而换个题材可能完全不同 ——
   * 做饭是"火候 / 备料 / 调味",铸剑是"炉温 / 锻打 / 淬火",写代码是"需求理解 /
   * 设计与实现"。键名只是标签,引擎只做一件事:**按乘区表逐项取 `下限 + 跨度 × clamp01(值)`
   * 再乘起来**(顺序即对象键的顺序,故结果可复现)。
   */
  levers: Record<string, LeverSpec>
  /**
   * 越级惩罚(可选):把某一项的值当作"越了几级"来陡峭折算,作为最后一个因子乘上去。
   *
   * `key` 指向输入里的哪一项(它不必出现在 `levers` 里);
   * 不给就是没有越级这回事 —— 有些题材根本没有"越级"。
   */
  overReach?: { key: string; spec: OverReachSpec }
}

export interface CraftLevers {
  /** 乘区名 → 值(作品侧负责归一:0~100 的先除 100);越级那一项也放这里 */
  [key: string]: number
}

/**
 * 合成成功率 = 基准 × Π(各乘区) × 越级因子。
 *
 * 乘法顺序 = 基准、按 `formula.levers` 的键序、最后越级 ——
 * 与《云隐修仙录》原式一致(逐位对齐,迁移时数字一位不变)。
 */
export function composeCraftRate(values: CraftLevers, formula: CraftFormula): number {
  let rate = formula.baseRate
  for (const [key, spec] of Object.entries(formula.levers)) {
    rate *= leverFactor(values[key] ?? 0, spec)
  }
  if (formula.overReach) rate *= overReachFactor(values[formula.overReach.key] ?? 0, formula.overReach.spec)
  return rate
}
