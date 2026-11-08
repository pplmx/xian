/**
 * 渡劫失败的修为退返 —— 取值与**上限**。
 *
 * ## 为什么单独一个文件
 *
 * 这条线此前没有任何判据。变异测试扫 `breakthrough.ts` 时把 `Math.min(0.8, …)`
 * 改成 `Math.max`,整套用例**全绿** —— 而那个改动会让退返恒 ≥ 0.8,
 * 渡劫失败只掉 18% × 0.2 = 3.6% 修为(本该 16.2%),失败代价被抹掉八成。
 *
 * 走完整流程测它很别扭:游戏里拿不到那么高的 breakRefund(单件词条最高 0.2,
 * 天赋 0.1),硬凑一个不存在的配装去触发上限,读的人也看不出这条在守什么。
 * 故把取值收成 `breakRefundOf(mods)` 这个纯函数 —— 上限本身就能直接测。
 */
import { describe, expect, it } from "vite-plus/test";
import { breakRefundOf } from "./breakthrough";

describe("退返比例 · 取值", () => {
  it("没有退返来源时是 0 —— 失败照常掉全额", () => {
    expect(breakRefundOf({})).toBe(0);
  });

  it("照实取词条/天赋给的值", () => {
    expect(breakRefundOf({ breakRefund: 0.1 }), "天赋「圆融」档").toBeCloseTo(0.1, 6);
    expect(breakRefundOf({ breakRefund: 0.2 }), "词条「道心」满档").toBeCloseTo(0.2, 6);
  });
});

/**
 * 上限 —— 这一节正是变异漏网的那一处。
 *
 * 上限存在的理由:退返越高失败代价越小;叠到 100% 失败就成了零代价,
 * 「揣着修为赌一把 vs 稳妥攒材料」这个取舍随之消失。当前数据离 0.8 很远,
 * 故它是**防御性上限**,防的是以后有人把 breakRefund 的数据往上调。
 */
describe("退返比例 · 封顶 80%", () => {
  it("恰好 0.8 时仍是 0.8", () => {
    expect(breakRefundOf({ breakRefund: 0.8 })).toBeCloseTo(0.8, 6);
  });

  it("超过 0.8 一律压回 0.8 —— 不许把失败代价抹平", () => {
    for (const raw of [0.9, 1, 1.5, 2, 10, 100]) {
      expect(breakRefundOf({ breakRefund: raw }), `breakRefund=${raw} 没有封顶`).toBeCloseTo(
        0.8,
        6,
      );
    }
  });

  it("下限不受影响 —— 封的是上限,不是把 0 抬到 0.8", () => {
    // 这正是 Math.max 那个变异的样子:它会让任何输入都 ≥ 0.8
    expect(breakRefundOf({})).toBe(0);
    expect(breakRefundOf({ breakRefund: 0.05 })).toBeCloseTo(0.05, 6);
  });

  it("封顶后的失败代价算得出来 —— 18% × (1 − 0.8) = 3.6%", () => {
    /*
     * 把上限放回业务语境:它还意味着「无论退返怎么堆,单次失败至少掉 3.6% 修为」。
     * 判据本身只钉取值;这一条是给读的人看那个 0.8 到底买到了什么。
     */
    const loss = 0.18 * (1 - breakRefundOf({ breakRefund: 5 }));
    expect(loss).toBeCloseTo(0.036, 6);
  });
});
