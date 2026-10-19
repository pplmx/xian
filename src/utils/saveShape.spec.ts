/**
 * 存档形状修复 · src 侧自有函数 —— asPrice / asNonNegInt 的契约。
 *
 * 7 个转出函数(asArray 等)的真身在公共库,由 packages/engine/src/saveShape.spec.ts
 * 钉;这里钉的是**没有进库的两个本地实现**,消费方是坊市(market)与悬赏(bounty)
 * 两家店 —— 存档里某个价坏了归零、某个序坏了兜底,坏数据不许把店铺撑爆。
 */
import { describe, expect, it } from "vite-plus/test";
import { asNonNegInt, asPrice } from "./saveShape";

describe("asPrice · 好数据原样入账", () => {
  it("规整的 {m,e} 原样归一化交出", () => {
    expect(asPrice({ m: 1.23, e: 2 })).toEqual({ m: 1.23, e: 2 });
  });

  it("未归一化的 {m,e} 走 gn 归一化(123 × 10^0 → 1.23 × 10^2)", () => {
    expect(asPrice({ m: 123, e: 0 })).toEqual({ m: 1.23, e: 2 });
  });

  it("负价也算合法形状(扣款语义在上层)", () => {
    expect(asPrice({ m: -5, e: 3 })).toEqual({ m: -5, e: 3 });
  });
});

describe("asPrice · 坏形状归零", () => {
  it("null / undefined / 原始类型:全部 {m:0,e:0}", () => {
    const bad = [null, undefined, 42, "1e5", true] as unknown[];
    for (const v of bad) {
      expect(asPrice(v), `坏值 ${String(v)} 应归零`).toEqual({ m: 0, e: 0 });
    }
  });

  it("缺 m 或缺 e 的对象:归零 —— 半个 GNum 不是 GNum", () => {
    expect(asPrice({ m: 1 })).toEqual({ m: 0, e: 0 });
    expect(asPrice({ e: 3 })).toEqual({ m: 0, e: 0 });
    expect(asPrice({})).toEqual({ m: 0, e: 0 });
  });

  it("m/e 非有限数(NaN / Infinity / 字符串):归零", () => {
    const bad: unknown[] = [
      { m: Number.NaN, e: 2 },
      { m: 1.5, e: Number.POSITIVE_INFINITY },
      { m: "2", e: 2 },
      { m: 1.5, e: null },
    ];
    for (const v of bad) {
      expect(asPrice(v), `坏值 ${JSON.stringify(v)} 应归零`).toEqual({ m: 0, e: 0 });
    }
  });
});

describe("asNonNegInt · 序号与件数", () => {
  it("有限数向下取整、负数夹回 0(不是兜底值!)", () => {
    expect(asNonNegInt(3.9, 99)).toBe(3);
    expect(asNonNegInt(0, 99)).toBe(0);
    expect(asNonNegInt(-1, 99)).toBe(0);
  });

  it("坏值(NaN / Infinity / 字符串 / null / undefined):用兜底", () => {
    const bad = [Number.NaN, Number.POSITIVE_INFINITY, "5", null, undefined];
    for (const v of bad) {
      expect(asNonNegInt(v as number, 7), `坏值 ${String(v)} 应用兜底 7`).toBe(7);
    }
  });
});
