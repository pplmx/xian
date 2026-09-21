/**
 * Reproducible randomness. Drop-rate bugs are undiagnosable if you cannot
 * replay the same seed. Hosts that inject the same `next()` (or wrap
 * {@link mulberry32}) stay sequence-aligned with {@link createRng}.
 *
 * `createRng` and `randomRng` share {@link pickWeighted} so a host
 * RandomService can call the same kernel instead of keeping a second copy.
 */
export interface Rng {
  next(): number
  /** [min, max] closed integer */
  int(min: number, max: number): number
  /** [min, max) float */
  float(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T
  /**
   * Shuffle — **optional**.
   *
   * The engine never calls it. It stays optional so a host random service
   * can plug in without growing to match a larger interface the library
   * does not need.
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

/**
 * Weighted pick against any `[0, 1)` source.
 *
 * - Negative weights are treated as 0.
 * - Zero-weight items never win while any positive weight exists.
 * - If every weight is ≤ 0, falls back to a uniform pick (same as `pick`).
 * - Empty input returns `undefined` (typed as `T`) — same as `pick`.
 * - Buckets are half-open: `next() === 0` selects the first **positive** weight.
 *
 * `createRng` / `randomRng` / a host RandomService should all call this so
 * the algorithm cannot drift.
 */
export function pickWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  next: () => number
): T {
  const positive = items.filter(it => Math.max(0, weightOf(it)) > 0)
  const pool = positive.length > 0 ? positive : items
  if (pool.length === 0) return items[0]!
  if (positive.length === 0) return pool[Math.floor(next() * pool.length)]!
  let total = 0
  for (const it of positive) total += Math.max(0, weightOf(it))
  let roll = next() * total
  for (const it of positive) {
    roll -= Math.max(0, weightOf(it))
    if (roll < 0) return it
  }
  return positive[positive.length - 1]!
}

export function createRng(seed: number | string = 1): Rng {
  const rand = mulberry32(typeof seed === 'string' ? seedFromString(seed) : seed)
  return {
    next: () => rand(),
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min, max) => rand() * (max - min) + min,
    chance: p => rand() < p,
    pick: arr => arr[Math.floor(rand() * arr.length)]!,
    weighted: (items, weightOf) => pickWeighted(items, weightOf, rand),
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
  weighted: (items, weightOf) => pickWeighted(items, weightOf, Math.random),
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
