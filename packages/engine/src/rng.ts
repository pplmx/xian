/**
 * 随机服务 —— 概率逻辑必须可复现,否则「掉率不对」这类问题只能靠抽样猜。
 * 与云隐修仙录的 `utils/random` 同形(mulberry32),所以两边可以交换种子对账。
 */
export interface Rng {
  next(): number
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number
  /** [min, max) 浮点 */
  float(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T
  /**
   * 洗牌 —— **可选**。
   *
   * 引擎自己不用它;留成可选是为了让使用方**已有的随机服务**能直接接进来
   * (例如《云隐修仙录》的 RandomService 就没有 shuffle)。
   * 接口越大,接进来要满足的条件越多,而库并不需要它。
   */
  shuffle?<T>(arr: readonly T[]): T[]
}

/** mulberry32:小、快、够用,且同一种子在任何引擎上都给同一串数 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 字符串 → 32 位种子(FNV-1a):种子可以直接写成「青云山麓」这样可读的东西 */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRng(seed: number | string = 1): Rng {
  const rand = mulberry32(typeof seed === 'string' ? seedFromString(seed) : seed)
  return {
    next: () => rand(),
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min, max) => rand() * (max - min) + min,
    chance: p => rand() < p,
    pick: arr => arr[Math.floor(rand() * arr.length)]!,
    weighted: (items, weightOf) => {
      let total = 0
      for (const it of items) total += Math.max(0, weightOf(it))
      if (total <= 0) return items[Math.floor(rand() * items.length)]!
      let roll = rand() * total
      for (const it of items) {
        roll -= Math.max(0, weightOf(it))
        if (roll <= 0) return it
      }
      return items[items.length - 1]!
    },
    shuffle: arr => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1))
        const a = out[i]!
        out[i] = out[j]!
        out[j] = a
      }
      return out
    }
  }
}

/** 默认随机源(Math.random)。要可复现时一律显式传 createRng(seed) */
export const randomRng: Rng = {
  next: () => Math.random(),
  int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  float: (min, max) => Math.random() * (max - min) + min,
  chance: p => Math.random() < p,
  pick: arr => arr[Math.floor(Math.random() * arr.length)]!,
  weighted: (items, weightOf) => {
    let total = 0
    for (const it of items) total += Math.max(0, weightOf(it))
    if (total <= 0) return items[Math.floor(Math.random() * items.length)]!
    let roll = Math.random() * total
    for (const it of items) {
      roll -= Math.max(0, weightOf(it))
      if (roll <= 0) return it
    }
    return items[items.length - 1]!
  },
  shuffle: arr => {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = out[i]!
      out[i] = out[j]!
      out[j] = a
    }
    return out
  }
}
