/**
 * 坊市无套利闭环 —— 三条腿的价格必须互不咬合。
 *
 * ## 为什么需要这一条
 *
 * 坊市有三条腿,每条都有自己的倍率常量(`data/market.ts`):
 *
 * ```text
 *   货架购入  材料 6 单位档 · 丹药 2.5×丹方石基 · 装备 60+30×rank
 *   即时售出  材料 3 单位档 · 丹药 1.2×丹方石基
 *   寄卖装备  25+12×rank
 * ```
 *
 * 若哪天有人调了其中一条(比如把售出系数从 3 提到 7),玩家就能
 * **从货架买来、立刻卖回去**,空手套灵石 —— 而每个常量单独看都很合理。
 *
 * `data/market.ts` 的注释写着「双向不成环」「无搬砖套利」,但**此前没有任何判据守它**
 * (第 82 轮扫描发现:`MARKET_SELL_*` / `MARKET_CONSIGN_*` 在全仓 spec 里一次都没出现)。
 *
 * ## 判据
 *
 * 每条腿的**卖出价严格低于买入价**。不是「约等于」,是严格小于 ——
 * 只要有一档持平,那一档就能无限搬砖。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  MARKET_CONSIGN_STONE_BASE,
  MARKET_CONSIGN_STONE_PER_RANK,
  MARKET_EQUIP_STONE_BASE,
  MARKET_EQUIP_STONE_PER_RANK,
  MARKET_MAT_COUNT,
  MARKET_MAT_STONE_UNITS,
  MARKET_PILL_MARKUP,
  MARKET_SELL_MAT_STONE_UNITS,
  MARKET_SELL_PILL_FACTOR,
} from "@/data/market";

/** 品质 rank 的取值范围(凡品 0 → 神品 8) */
const RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

describe("坊市 · 三条腿都不成环", () => {
  it("材料:售出单位档严格低于购入单位档", () => {
    expect(
      MARKET_SELL_MAT_STONE_UNITS,
      `材料售出 ${MARKET_SELL_MAT_STONE_UNITS} 不高于购入 ${MARKET_MAT_STONE_UNITS} —— 买来卖回去就赚了`,
    ).toBeLessThan(MARKET_MAT_STONE_UNITS);
    // 两侧都用同一个 MARKET_MAT_COUNT,所以只要单位档低就够了 —— 这条防的是「哪天改了份数」
    expect(MARKET_MAT_COUNT, "材料份数为 0 —— 判据在空转").toBeGreaterThan(0);
  });

  it("丹药:售出倍率严格低于购入倍率", () => {
    expect(
      MARKET_SELL_PILL_FACTOR,
      `丹药售出 ${MARKET_SELL_PILL_FACTOR}× 不低于购入 ${MARKET_PILL_MARKUP}× —— 成环了`,
    ).toBeLessThan(MARKET_PILL_MARKUP);
    expect(MARKET_PILL_MARKUP, "丹药购入倍率为 0 —— 判据在空转").toBeGreaterThan(1);
  });

  it("装备:九个品质档的寄卖价都低于购入价", () => {
    const bad: string[] = [];
    for (const rank of RANKS) {
      const buy = MARKET_EQUIP_STONE_BASE + rank * MARKET_EQUIP_STONE_PER_RANK;
      const sell = MARKET_CONSIGN_STONE_BASE + rank * MARKET_CONSIGN_STONE_PER_RANK;
      if (sell >= buy) bad.push(`rank${rank}: 寄卖 ${sell} ≥ 购入 ${buy}`);
    }
    // 防空转:九个档都量到,且购入价随档位递增
    expect(RANKS.length).toBe(9);
    expect(
      MARKET_EQUIP_STONE_BASE + 8 * MARKET_EQUIP_STONE_PER_RANK,
      "装备购入价不随品质递增 —— 判据在对常数做无用功",
    ).toBeGreaterThan(MARKET_EQUIP_STONE_BASE);

    expect(bad, "这些品质档的装备能从货架买来立刻寄卖赚钱:" + bad.join("、")).toEqual([]);
  });

  it("装备:寄卖价也不是白送 —— 至少要高于最低购入价的三成", () => {
    /*
     * 反方向:把寄卖系数压到 0 也能过上面那条(0 < 60),但那会让「寄卖」失去意义。
     * 这里守的是「寄卖仍然值得用」:最低档的回报不能低到接近零。
     */
    const minBuy = MARKET_EQUIP_STONE_BASE;
    expect(
      MARKET_CONSIGN_STONE_BASE,
      `最低档寄卖只给 ${MARKET_CONSIGN_STONE_BASE},不到购入 ${minBuy} 的三成 —— 寄卖等于扔掉`,
    ).toBeGreaterThan(minBuy * 0.3);
  });

  it("反空转:三条腿的常量都在合理量级", () => {
    for (const [name, value, lo, hi] of [
      ["MARKET_MAT_STONE_UNITS", MARKET_MAT_STONE_UNITS, 1, 50],
      ["MARKET_SELL_MAT_STONE_UNITS", MARKET_SELL_MAT_STONE_UNITS, 0.1, 50],
      ["MARKET_PILL_MARKUP", MARKET_PILL_MARKUP, 1.01, 10],
      ["MARKET_SELL_PILL_FACTOR", MARKET_SELL_PILL_FACTOR, 0.1, 10],
      ["MARKET_EQUIP_STONE_BASE", MARKET_EQUIP_STONE_BASE, 1, 1000],
      ["MARKET_CONSIGN_STONE_BASE", MARKET_CONSIGN_STONE_BASE, 1, 1000],
    ] as const) {
      expect(value, `${name}=${value} 不在合理区间 [${lo}, ${hi}]`).toBeGreaterThanOrEqual(lo);
      expect(value, `${name}=${value} 不在合理区间 [${lo}, ${hi}]`).toBeLessThanOrEqual(hi);
    }
  });
});
