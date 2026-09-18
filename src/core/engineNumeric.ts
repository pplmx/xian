/**
 * GNum 适配器 —— 把公共库的数值层接到本作的大数实现上。
 *
 * 库里的公式一律走 `Numeric<T>`;本作要用 GNum({m, e}),于是这一层把
 * 加减乘除、幂、比较、取值逐一对到 utils/gnum 的同名实现上。
 *
 * **逐位对齐是这一层存在的意义**:曲线里的倍率(19、4.6、1.32……)以 number 传进
 * 库的 `powN`,再由这里直接落到 `gnum.powN` —— 与既有实现同一条对数空间路径。
 * 若反过来先 `gn(19)` 归一化成 {m:1.9, e:1} 再取幂,末位会差一个 ulp,
 * "把公式搬进库"就从"数字一个不变"退化成"看起来差不多"。
 */
import type { GNum } from '@/types'
import type { Numeric } from '@engine/index'
import { add, cmp, div, gn, gnMax, gnZero, mul, mulN, powN, sub, toNum } from '@/utils/gnum'
import { formatExact } from '@/utils/format'

export const gnumNumeric: Numeric<GNum> = {
  zero: gnZero(),
  one: gn(1),
  from: gn,
  // 宿主的大数原样收下;数字则先归一化成 GNum(配置里两种写法并存时用得上)
  of: value => (typeof value === 'number' ? gn(value) : value),
  add,
  sub,
  mul,
  mulN,
  div,
  /**
   * 以 GNum 为底数的幂。
   *
   * 分解成"尾数取幂 + 指数平移":a = m × 10^e → a^k = (m^k) × 10^(e·k)。
   * 整数指数下 e·k 是整数,平移不引入误差;本作的曲线一律走 `powN`,故这条
   * 只在库内部以 T 为底数的场合用到(如用户自定义的复合曲线)。
   */
  pow: (a, k) => {
    if (a.m === 0) return gnZero()
    const negative = a.m < 0 && Number.isInteger(k) && Math.abs(k % 2) === 1
    const mantissa = powN(Math.abs(a.m), k)
    const shift = a.e * k
    const whole = Math.floor(shift)
    return gn({ m: mantissa.m * Math.pow(10, shift - whole) * (negative ? -1 : 1), e: mantissa.e + whole })
  },
  powN: (base, k) => powN(base, k),
  cmp,
  max: gnMax,
  toNumber: toNum,
  format: a => formatExact(a)
}
