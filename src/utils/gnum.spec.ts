import { describe, expect, it } from "vite-plus/test";
import {
  add,
  cmp,
  div,
  gn,
  gte,
  gt,
  lte,
  mul,
  mulN,
  powN,
  progress,
  ratio,
  sub,
  subClamp,
  toNum,
} from "./gnum";
import { gnumNumeric } from "@/core/engineNumeric";

describe("GameNumber 大数运算", () => {
  it("构造与规范化", () => {
    expect(gn(0)).toEqual({ m: 0, e: 0 });
    expect(gn(1234)).toEqual({ m: 1.234, e: 3 });
    expect(gn(0.5).m).toBeCloseTo(5);
    expect(gn(0.5).e).toBe(-1);
  });

  it("损坏数据回退为零", () => {
    expect(gn({ m: Number.NaN, e: 2 })).toEqual({ m: 0, e: 0 });
    expect(gn(null as unknown as number)).toEqual({ m: 0, e: 0 });
  });

  it("加减法", () => {
    expect(toNum(add(gn(100), gn(23)))).toBeCloseTo(123);
    expect(toNum(sub(gn(100), gn(30)))).toBeCloseTo(70);
    expect(subClamp(gn(10), gn(100))).toEqual({ m: 0, e: 0 });
  });

  it("量级悬殊时小数被忽略", () => {
    const big = gn(1e30);
    expect(add(big, gn(1))).toEqual(big);
  });

  it("乘除法与幂", () => {
    expect(toNum(mul(gn(200), gn(300)))).toBeCloseTo(60000);
    expect(toNum(div(gn(1e10), gn(4)))).toBeCloseTo(2.5e9);
    expect(toNum(mulN(gn(50), 3))).toBeCloseTo(150);
    const p = powN(24, 9);
    expect(p.e).toBeGreaterThan(11);
    expect(toNum(p) / Math.pow(24, 9)).toBeCloseTo(1, 6);
  });

  it("超大数不溢出", () => {
    const huge = powN(10, 500);
    expect(huge.e).toBe(500);
    expect(toNum(mul(huge, huge))).toBe(Infinity);
    expect(mul(huge, huge).e).toBe(1000);
  });

  it("尾数乘积上溢时折进指数,不静默归零", () => {
    // mulN(9, 1e308):9e308 在 double 里是 Infinity,但量级仍可从标量对数恢复
    const a = mulN(gn(9), 1e308);
    expect(a.m === 0 && a.e === 0).toBe(false); // 不许抹成 0
    expect(toNum(a)).toBe(Infinity); // 正确保持巨量
    // 常规有限路径不受影响
    expect(toNum(mulN(gn(50), 3))).toBeCloseTo(150);
  });

  it("上溢折指数也保住符号 —— 负值巨量不被翻成正", () => {
    // mul 上溢:两尾数乘积 ±Infinity,量级经对数恢复,但符号要保留(旧实现丢符号,
    // powN 恒非负,把 -1e616 翻成 +1e616 —— 与分支自己的「不静默篡改」初衷相悖)
    const negHuge = mul({ m: -1e308, e: 0 }, { m: 1e308, e: 0 });
    expect(negHuge.m < 0).toBe(true);
    expect(negHuge.e).toBeGreaterThan(300);
    const negScalar = mulN({ m: 1e308, e: 0 }, -3);
    expect(negScalar.m < 0).toBe(true);
    // 正巨量与常规有限值不受影响
    expect(mul({ m: 1e308, e: 0 }, { m: 1e308, e: 0 }).m > 0).toBe(true);
    expect(toNum(mulN(gn(50), 3))).toBeCloseTo(150);
  });

  it("GNum 底数的幂:e·k 巨大时不上溢成 NaN/0", () => {
    // 旧实现拆「尾数取幂 + 指数平移」,e·k 一大(1e16×2)就上溢成 0;对数空间保留整数指数
    const big = gnumNumeric.pow({ m: 1, e: 1e16 }, 2);
    expect(big.m === 0).toBe(false);
    expect(Number.isFinite(big.e)).toBe(true);
    expect(big.e).toBe(2e16);
    // 常规小指数路径与旧实现一致(符号按奇偶、小数幂也对)
    expect(toNum(gnumNumeric.pow(gn(2), 3))).toBeCloseTo(8);
    expect(toNum(gnumNumeric.pow(gn(-2), 3))).toBeCloseTo(-8);
    expect(toNum(gnumNumeric.pow(gn(-2), 2))).toBeCloseTo(4);
    expect(toNum(gnumNumeric.pow(gn(4), 0.5))).toBeCloseTo(2);
  });

  it("NaN 尾数按 0 比较(与 gn() 的 scrubbing 一致)", () => {
    expect(cmp({ m: NaN, e: 0 }, gn(1))).toBe(cmp(gn(0), gn(1)));
    expect(cmp({ m: NaN, e: 0 }, gn(0))).toBe(0);
  });

  it("比较", () => {
    expect(cmp(gn(100), gn(99))).toBe(1);
    expect(cmp(gn(1e20), gn(2e20))).toBe(-1);
    expect(gte(gn(5), gn(5))).toBe(true);
  });

  it("未归一化输入也能正确比较(指数序只在 [1,10) 尾数下成立)", () => {
    // $patch / 手工构造的 {m:1e12,e:0} 未经 normalize,照旧实现会被误判为小于 92
    expect(cmp({ m: 1e12, e: 0 }, { m: 9.2, e: 1 })).toBe(1); // 1e12 > 92
    expect(gte({ m: 1e12, e: 0 }, { m: 9.2, e: 1 })).toBe(true);
    expect(cmp({ m: 500, e: 0 }, gn(1000))).toBe(-1); // 500 < 1000,但尾数未归一化
    // 负号方向不因对齐翻转
    expect(cmp({ m: -100, e: 3 }, { m: -1, e: 6 })).toBe(1); // -1e5 > -1e6
    // 量级悬殊仍走指数序(NEGLIGIBLE_EXP_DIFF 之外)
    expect(cmp(gn(1e30), gn(1))).toBe(1);
    expect(cmp(gn(1), gn(1e30))).toBe(-1);
    // 量级悬殊且尾数未归一化:有效指数必须各算对数,不能照搬 a.e>b.e
    // 1e20 > 5e19,但 {m:1e20,e:0} 尾数没归一化,老实现误判为 -1
    expect(cmp({ m: 1e20, e: 0 }, { m: 5, e: 19 })).toBe(1);
    expect(cmp({ m: 5, e: 19 }, { m: 1e20, e: 0 })).toBe(-1);
  });

  it("同为负数时按数值序比较", () => {
    // 指数不同:负指数越大负得越狠,数值越小(-100000 < -100)
    expect(cmp({ m: -1, e: 5 }, { m: -1, e: 3 })).toBe(-1);
    expect(cmp({ m: -1, e: 3 }, { m: -1, e: 5 })).toBe(1);
    // 指数相同:尾数越大越靠近零,数值越大(-1×10^3 > -2×10^3)
    expect(cmp({ m: -1, e: 3 }, { m: -2, e: 3 })).toBe(1);
    expect(cmp({ m: -2, e: 3 }, { m: -1, e: 3 })).toBe(-1);
    expect(cmp(gn(-1234), gn(-1200))).toBe(-1);
    expect(cmp(gn(-1200), gn(-1234))).toBe(1);
  });

  it("正负混合与零的比较", () => {
    expect(cmp({ m: -1, e: 5 }, gn(1))).toBe(-1);
    expect(cmp(gn(1), { m: -1, e: 5 })).toBe(1);
    expect(cmp(gn(0), { m: -1, e: 5 })).toBe(1);
    expect(cmp({ m: -1, e: 5 }, gn(0))).toBe(-1);
    expect(lte(gn(-8), gn(0))).toBe(true);
    expect(gt(gn(0), gn(-8))).toBe(true);
  });

  it("比值与进度", () => {
    expect(ratio(gn(50), gn(200))).toBeCloseTo(0.25);
    expect(progress(gn(150), gn(100))).toBe(1);
    expect(progress(gn(0), gn(100))).toBe(0);
  });
});
