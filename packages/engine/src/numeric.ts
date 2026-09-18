/**
 * 数值适配层。
 *
 * 本库的所有公式都写成 `Numeric<T>`,默认实现是 JS `number`。
 * 放置类游戏的后期数值会涨到 double 装不下(云隐修仙录的混沌海一段是 1e40 量级),
 * 那时把它换成 GNum / break_eternity 之类的实现即可 —— **公式与内容一行都不用改**。
 *
 * 这也是「公共库」与「某一款游戏」的分界线:引擎不认识某个大数库,
 * 只认识这套加减乘除与比较。
 */
export interface Numeric<T> {
  readonly zero: T
  readonly one: T
  from(n: number): T
  add(a: T, b: T): T
  sub(a: T, b: T): T
  mul(a: T, b: T): T
  mulN(a: T, k: number): T
  div(a: T, b: T): T
  pow(a: T, k: number): T
  cmp(a: T, b: T): number
  max(a: T, b: T): T
  toNumber(a: T): number
  format(a: T, decimals?: number): string
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

/** 12345 → 1.23万;1.2e8 → 1.2亿 —— 面板上不写一长串数字 */
export function formatAmount(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞'
  const abs = Math.abs(n)
  if (abs < 10_000) {
    const fixed = Number.isInteger(n) ? String(n) : n.toFixed(decimals)
    return fixed
  }
  const units: [number, string][] = [
    [1e4, '万'],
    [1e8, '亿'],
    [1e12, '万亿'],
    [1e16, '京']
  ]
  let picked: [number, string] = units[0]!
  for (const u of units) {
    if (abs >= u[0]) picked = u
  }
  const scaled = n / picked[0]
  return `${scaled.toFixed(decimals)}${picked[1]}`
}

export const numberNumeric: Numeric<number> = {
  zero: 0,
  one: 1,
  from: n => n,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  mulN: (a, k) => a * k,
  div: (a, b) => (b === 0 ? 0 : a / b),
  pow: (a, k) => a ** k,
  cmp: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  max: (a, b) => (a > b ? a : b),
  toNumber: a => a,
  format: formatAmount
}
