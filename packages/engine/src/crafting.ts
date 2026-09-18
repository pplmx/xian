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
}

export function leverFactor(value: number, spec: LeverSpec): number {
  return spec.floor + spec.span * Math.max(0, Math.min(1, value))
}

export interface CraftFormula {
  /** 各项皆满且不越级时的成功率上限 —— 剩下的留给天意 */
  baseRate: number
  /** 配方掌握度(0~1)的乘区 */
  mastery: LeverSpec
  /** 材料认知度(0~1)的乘区 */
  lore: LeverSpec
  /** 技艺水平(已归一到 0~1)的乘区 */
  skill: LeverSpec
  /** 越级惩罚 */
  overReach: OverReachSpec
}

export interface CraftLevers {
  /** 配方掌握度 0~1 */
  mastery: number
  /** 材料认知度 0~1 */
  lore: number
  /** 技艺水平 0~1(作品侧把 0~100 除以 100 再传进来) */
  skill: number
  /** 越级阶数,>0 即强炼 */
  overReach: number
}

/**
 * 合成成功率 = 基准 × 掌握 × 认知 × 技艺 × 越级。
 *
 * 乘法顺序与《云隐修仙录》一致(逐位对齐,迁移时数字一位不变)。
 */
export function composeCraftRate(levers: CraftLevers, formula: CraftFormula): number {
  return (
    formula.baseRate *
    leverFactor(levers.mastery, formula.mastery) *
    leverFactor(levers.lore, formula.lore) *
    leverFactor(levers.skill, formula.skill) *
    overReachFactor(levers.overReach, formula.overReach)
  )
}
