/**
 * 天界册的道源代价，要随层级抬高。
 *
 * ## 缺口（第 423 轮）
 *
 * `entryCostOf` 原本两支写法：
 *
 * ```ts
 *   stone:     stoneByTier(tierOfMajor(major), def.cost.stone)   // 按层级指数放大
 *   daoSource: def.cost.daoSource                                // 一个常数
 * ```
 *
 * 灵石按 `STONE_TIER_GROWTH(1.9)^(tier−1)` 涨，真仙(tier 21)→道祖(tier 32) 是 **×1165**；
 * 而道源那一支纹丝不动。于是同一处天界秘境越往后越便宜 ——
 * 到道祖时，一笔 90 道源的入场费在当世收入里只占 0.1%，门槛形同虚设。
 *
 * ## 为什么不是乘 1165
 *
 * 灵石与道源不是同一种东西：灵石随产出膨胀（历练、建筑都在涨），
 * 道源只从熔炉与转世来，收入增长慢得多 —— 修到真仙转世得 66300，修到道祖得 277500，
 * 只有 **×4.19**。把道源也乘 1165，玩家根本付不起。
 *
 * 故按道源**自己的收入比例**抬：以真仙为基准，到道祖约 ×4.2。
 *
 * ## 判据
 *
 * ① 同一处秘境，越往后越贵（单调不减）；
 * ② 涨幅落在道源收入的比例内（真仙→道祖约 ×4.2，判定区间 [3, 6]）；
 * ③ 真仙那一档不退（基准就是它，不许被缩放改掉）；
 * ④ 反差：**灵石**那一支的涨幅远大于道源 —— 两者本就不是同一种货币。
 */
import { describe, expect, it } from "vite-plus/test";
import { SECRET_REALMS } from "@/data/secretRealms";
import { entryCostOf, entryCostText, daoSourceCostAt, tierOfMajor } from "./secretRealm";
import { daoFruitGain } from "./formulas";
import { DAO_SOURCE_PER_FRUIT } from "@/data/endgame";
import { WORLD_BREAK_MAJOR, MAX_MAJOR } from "@/data/realms";

/** 天界册里所有用道源计价的秘境 */
const DAO_REALMS = SECRET_REALMS.filter((d) => "daoSource" in d.cost);

/** 修到该境转世时能拿到的道源总量（收入侧的尺） */
function incomeAt(major: number): number {
  return daoFruitGain(major, 9) * DAO_SOURCE_PER_FRUIT;
}

describe("秘境入场费 · 道源那一支也要随境界抬", () => {
  it("同一处秘境，越往后越贵（单调不减）", () => {
    const drops: string[] = [];
    for (const d of DAO_REALMS) {
      let prev = -1;
      for (let m = WORLD_BREAK_MAJOR; m <= MAX_MAJOR; m += 1) {
        const cur = daoSourceCostAt(d, m);
        if (cur < prev) drops.push(`${d.name} 在 ${m} 境从 ${prev} 降到 ${cur}`);
        prev = cur;
      }
    }
    expect(drops, "越往后反而越便宜 —— 高境界的入场门槛会形同虚设:" + drops.join("、")).toEqual([]);
  });

  it("涨幅落在道源收入的比例内，不是石灵那个量级", () => {
    /*
     * 真仙 → 道祖：灵石那支是 ×1165，而道源收入只涨 ×4.19。
     * 判定区间 [3, 6] —— 低于 3 等于没抬，高于 6 会超出收入增长。
     */
    for (const d of DAO_REALMS) {
      const atBase = daoSourceCostAt(d, WORLD_BREAK_MAJOR);
      const atTop = daoSourceCostAt(d, MAX_MAJOR);
      const ratio = atTop / atBase;
      expect(
        ratio,
        `「${d.name}」真仙 ${atBase} → 道祖 ${atTop}（×${ratio.toFixed(2)}）—— ` +
          "道源收入那段只涨 ×4.19，抬得更多玩家付不起、抬得更少等于没抬",
      ).toBeGreaterThanOrEqual(3);
      expect(ratio).toBeLessThanOrEqual(6);
    }
  });

  it("真仙那一档不退：基准就是它", () => {
    for (const d of DAO_REALMS) {
      const base = (d.cost as { daoSource: number }).daoSource;
      expect(
        daoSourceCostAt(d, WORLD_BREAK_MAJOR),
        `「${d.name}」在真仙那一档被缩放改掉了 —— 基准该原样`,
      ).toBe(base);
      // 真仙以下（进不去，但函数该稳）也不许把它抬上去
      expect(daoSourceCostAt(d, WORLD_BREAK_MAJOR - 5)).toBe(base);
    }
  });

  it("反差：灵石那支的涨幅远大于道源 —— 两者不是同一种货币", () => {
    /*
     * 这条是这一轮的**判据自证**:若有人把两支改成同一种缩放，
     * 那要么灵石那支被砍（既有的 ×1165 是对的，灵石随产出膨胀），
     * 要么道源那支被乘上 1165（玩家付不起）。两头都不该发生。
     */
    const stoneDef = SECRET_REALMS.find((d) => "stone" in d.cost)!;
    const stoneBase = entryCostOf(stoneDef, WORLD_BREAK_MAJOR);
    const stoneTop = entryCostOf(stoneDef, MAX_MAJOR);
    const num = (x: ReturnType<typeof entryCostOf>): number => {
      if (x.kind !== "stone") return 0;
      const g = x.stone;
      return g.m * Math.pow(10, g.e);
    };
    const stoneRatio = num(stoneTop) / num(stoneBase);
    expect(
      stoneRatio,
      `灵石那支只涨了 ×${stoneRatio.toFixed(0)} —— 它本该随产出膨胀（约 ×1165）`,
    ).toBeGreaterThan(100);
  });

  it("收入那一侧的尺是真的：道源收入真仙→道祖约 ×4.19", () => {
    /*
     * 上面几条用 [3,6] 这个区间，依据是这一条。
     * 若哪天道果曲线改了，这条会先红，提醒回来重算那个区间。
     */
    const ratio = incomeAt(MAX_MAJOR) / incomeAt(WORLD_BREAK_MAJOR);
    expect(
      ratio,
      `道源收入真仙→道祖 ×${ratio.toFixed(2)} —— 判据里那条 [3,6] 是按这个数定的，改了要重算`,
    ).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(5);
  });

  it("tier 真的在涨（防的是判据自己空转）", () => {
    expect(tierOfMajor(MAX_MAJOR)).toBeGreaterThan(tierOfMajor(WORLD_BREAK_MAJOR));
  });
});

/**
 * 接线 —— `entryCostOf` 真的走了那个缩放吗。
 *
 * ## 为什么单开这一条
 *
 * 上面六条全在测 `daoSourceCostAt` 这个**导出函数**。而它是纯的:
 * 就算 `entryCostOf` 完全不用它、仍旧返回 `def.cost.daoSource`，
 * 那六条也照样全绿 —— 实测:把接线退回常数,**六条一条都没红**。
 *
 * 这正是第 388 轮那类「逻辑对、没人调」。故这里从**真正的入口**取数:
 * `entryCostOf(def, major)` —— 秘境卡、进入流程读的都是它。
 */
describe("秘境入口费 · 接线", () => {
  it("entryCostOf 取的就是缩放后的数，不是 def.cost 原值", () => {
    const d = DAO_REALMS.find((x) => (x.cost as { daoSource: number }).daoSource > 0)!;
    const base = (d.cost as { daoSource: number }).daoSource;
    const top = entryCostOf(d, MAX_MAJOR);
    expect(top.kind, "天界秘境该用道源计价").toBe("daoSource");
    const topCost = (top as { daoSource: number }).daoSource;
    expect(
      topCost,
      `entryCostOf 在道祖档返回 ${topCost}，与真仙的 ${base} ${
        topCost === base
          ? "一模一样 —— 它没有走 daoSourceCostAt，还在读 def.cost 原值"
          : "不同，接线正常"
      }`,
    ).not.toBe(base);
    // 且等于那个导出的缩放函数 —— 两处不许各算一份
    expect(topCost, "entryCostOf 与 daoSourceCostAt 给了两个不同的数").toBe(
      daoSourceCostAt(d, MAX_MAJOR),
    );
  });

  it("entryCostText 也随之变 —— 卡面上印的就是新价", () => {
    const d = DAO_REALMS[0]!;
    const small = entryCostText(d, WORLD_BREAK_MAJOR);
    const big = entryCostText(d, MAX_MAJOR);
    expect(small, "卡面文案没跟着境界变 —— 玩家看到的是旧价").not.toBe(big);
    expect(big, "卡面印的不是道源").toContain("道源");
  });
});
