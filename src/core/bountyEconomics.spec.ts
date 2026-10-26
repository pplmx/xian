/**
 * 悬赏板的经济口径 —— 每一条悬赏都必须落在「售出价 < 悬赏 < 购入价」这条带子里。
 *
 * `bountyService` 的注释写着这三句承诺(募材高于摆摊售出、低于坊市购入,丹药与贡器同理),
 * 而它**没有任何用例**:常数(4.5 / 3 / 6、1.8 / 1.2 / 2.5、35+14r / 60+30r)一旦被调,
 * 两条套利链就悄悄通了一条 ——
 *   ① 悬赏 ≥ 购入价:「坊市买入 → 交悬赏」无本套利;
 *   ② 悬赏 ≤ 售出价:没人会去交悬赏,悬赏板整块变成装饰。
 * 两种都不会报错,只会让经济慢慢塌。
 *
 * 判据直接拿坊市那边的**真值函数**(materialSellPrice / pillSellPrice / stoneByTier)来比,
 * 不另抄一份价目表。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateBounty, equipBountyReward, bountyRemainingSec } from "./bountyService";
import { materialSellPrice, pillSellPrice } from "./marketService";
import { stoneByTier } from "./formulas";
import { toNum } from "@/utils/gnum";
import { pillDef } from "@/data/pills";
import { BOUNTY_REFRESH_SECONDS } from "@/data/bounty";
import {
  MARKET_MAT_COUNT,
  MARKET_MAT_STONE_UNITS,
  MARKET_PILL_MARKUP,
  MARKET_EQUIP_STONE_BASE,
  MARKET_EQUIP_STONE_PER_RANK,
} from "@/data/market";

const TIERS = [0, 1, 3, 6, 10, 14, 20];
const NOW = 1_700_000_000_000;

describe("悬赏板 · 售出价 < 悬赏价 < 购入价", () => {
  it("灵石与玄铁:悬赏单价高于摆摊售出,低于货架购入", () => {
    for (const major of TIERS) {
      const slots = generateBounty(major, NOW);
      const unitSell = toNum(materialSellPrice(major)) / MARKET_MAT_COUNT;
      const unitBuy = toNum(stoneByTier(major, MARKET_MAT_STONE_UNITS));
      for (const kind of ["herb", "ore"] as const) {
        const slot = slots.find((s) => s.kind === kind);
        expect(slot, `major=${major} 缺了 ${kind} 悬赏`).toBeTruthy();
        const unit = toNum(slot!.reward) / slot!.target;
        expect(unit, `major=${major} ${kind}:交悬赏还不如摆摊`).toBeGreaterThan(unitSell);
        expect(unit, `major=${major} ${kind}:买来交悬赏能白挣差价`).toBeLessThan(unitBuy);
      }
    }
  });

  it("丹药:悬赏单价高于售出,低于货架加价", () => {
    for (const major of TIERS) {
      const slot = generateBounty(major, NOW).find((s) => s.kind === "pill")!;
      const base = pillDef(slot.kindId)?.recipe?.stoneBase;
      expect(base, `major=${major} 的悬赏丹没有丹方价:${slot.kindId}`).toBeGreaterThan(0);
      const unit = toNum(slot.reward) / slot.target;
      const sell = toNum(pillSellPrice(slot.kindId));
      const buy = (base as number) * MARKET_PILL_MARKUP;
      expect(unit, `major=${major} 交丹不如直接卖`).toBeGreaterThan(sell);
      expect(unit, `major=${major} 买丹交悬赏能白挣差价`).toBeLessThan(buy);
    }
  });

  it("贡器:九个品质档,哪一档都不该换回本钱", () => {
    for (const major of TIERS) {
      for (let rank = 0; rank < 9; rank += 1) {
        const bounty = toNum(equipBountyReward(major, rank).stone);
        const buy = toNum(
          stoneByTier(major, MARKET_EQUIP_STONE_BASE + rank * MARKET_EQUIP_STONE_PER_RANK),
        );
        expect(bounty, `major=${major} rank=${rank}:贡器赏不低于购入价`).toBeLessThan(buy);
        expect(bounty, `major=${major} rank=${rank}:贡器赏为零`).toBeGreaterThan(0);
      }
    }
  });

  it("悬赏换新的倒计时:到点归零,不出现负数", () => {
    const at = NOW;
    const full = BOUNTY_REFRESH_SECONDS * 1000;
    expect(bountyRemainingSec(at, at)).toBeCloseTo(BOUNTY_REFRESH_SECONDS, 5);
    expect(bountyRemainingSec(at, at + full)).toBe(0);
    expect(bountyRemainingSec(at, at + full + 60_000), "过期之后不该是负数").toBe(0);
  });
});
