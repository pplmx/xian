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
import type { GNum } from "@/types";
import type { Numeric } from "wanxiang-engine";
import { add, cmp, div, gn, gnMax, gnZero, mul, mulN, neg, powN, sub, toNum } from "@/utils/gnum";
import { formatExact } from "@/utils/format";

export const gnumNumeric: Numeric<GNum> = {
  zero: gnZero(),
  one: gn(1),
  from: gn,
  // 宿主的大数原样收下;数字则先归一化成 GNum(配置里两种写法并存时用得上)
  of: (value) => (typeof value === "number" ? gn(value) : value),
  add,
  sub,
  mul,
  mulN,
  div,
  /**
   * 以 GNum 为底数的幂。
   *
   * 直接在对数空间算:a = |m| × 10^e → a^k = 10^(k·(lg|m| + e)),再按奇偶带符号。
   * 旧实现拆成「尾数取幂 + 指数平移」(m^k × 10^(e·k)),e·k 一大(如 e ~1e16、k=2)
   * 就上溢成 NaN/0,静默把曲线碾平。对数空间下指数作为整数 exponent 原样保留,不会
   * 掉进 Number 的上溢;正常的小指数学路经与旧实现逐位一致。
   */
  pow: (a, k) => {
    if (a.m === 0) return gnZero();
    const negative = a.m < 0 && Number.isInteger(k) && Math.abs(k % 2) === 1;
    const r = powN(10, k * (Math.log10(Math.abs(a.m)) + a.e));
    return negative ? neg(r) : r;
  },
  powN: (base, k) => powN(base, k),
  cmp,
  max: gnMax,
  toNumber: toNum,
  format: (a) => formatExact(a),
};
