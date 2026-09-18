/**
 * 存档形状修复 —— 读档时把"形状不对"的字段修回可用的样子。
 *
 * 起因(从《云隐修仙录》抽出来时的那次复盘):把存档里逐个字段灌成 `undefined`,
 * 一次就抓出 7 处会抛错的读档路径。这些字段的共同点是**读的时候假设了形状**:
 * `for...of` 假设数组、`Object.entries` 假设对象、算术假设数字。
 * 存档一旦被写坏、从旧版本补回来、或被人手工改过,这些假设就变成白屏。
 *
 * 故这里提供几个最小判据,让各处的读档代码一行写完:
 * **形状不对就用兜底值,而不是抛错**。
 *
 * 这些函数与具体游戏无关 —— 凡是"从外部读回来的数据"(存档、导入、云同步)都用得上。
 */

/**
 * 是数组就用它,否则兜底。
 *
 * 元素也要过一遍:出现 `[null]` 这种"数组形状对、元素是垃圾"的情形时,
 * 后面的 `.someField` 会在渲染期抛错。
 *
 * `isValid` 拿到的元素**已经保证不是 null/undefined**(先滤一层再判)—— 判据自己
 * 不必再写 `!!x && …`:那种写法人人都会忘一次,而忘的那次就是白屏。
 */
export function asArray<T>(v: unknown, fallback: T[] = [], isValid?: (x: unknown) => boolean): T[] {
  if (!Array.isArray(v)) return fallback
  const present = (v as unknown[]).filter((x): x is T => x !== null && x !== undefined)
  return isValid ? present.filter(isValid) : present
}

/** 字符串数组:顺带滤掉混进去的非字符串 */
export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** 是对象(且不是数组/null)就用它,否则兜底 */
export function asRecord<T>(v: unknown, fallback: Record<string, T> = {}): Record<string, T> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : fallback
}

/**
 * 记录里只留下"值还像样"的条目。
 * 键对、值烂(如 `{ a: null }`)同样会在渲染期炸。
 */
export function asRecordOf<T>(v: unknown, isValid: (x: unknown) => boolean): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [k, raw] of Object.entries(asRecord<T>(v))) {
    if (isValid(raw)) out[k] = raw
  }
  return out
}

/** 有限数字就用它,否则兜底;可选下限 */
export function asFiniteNumber(v: unknown, fallback: number, min?: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return min === undefined ? n : Math.max(min, n)
}

/** 记录里每一项都取有限数字(非数字的键直接丢掉) */
export function asNumberRecord(v: unknown, min?: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(asRecord<number>(v))) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[k] = min === undefined ? raw : Math.max(min, raw)
  }
  return out
}

/** 对象或 null(用于"可以为空"的状态,如进行中的会话) */
export function asObjectOrNull<T extends object>(v: unknown): T | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null
}
