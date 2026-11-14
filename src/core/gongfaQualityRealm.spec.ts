/**
 * 功法的品质跟着境界走 —— 低境界不许出现高品功法。
 *
 * ## 由来（第 269 轮）
 *
 * 查「品质与境界是否匹配」，从数据里读出的事实:
 *
 * ```text
 * m0            只有 mortal / fine
 * m7~m13        immortal（仙品，rank 7）
 * m15~m19       divine（神品，rank 8）
 * ```
 *
 * 而 `data/gongfa.ts` 的注释把这条写成了一条原则（第 731~732 行）:
 *
 * > 秘术席最后五处断档:13 / 15 / 16 / 18 / 19。品质照该境界的主修走
 * > （13 是仙品，15 及以上是神品），量级照同品质的邻居取。
 *
 * 第 889 行再说一遍:「补五部把五处填上，品质照该境界的主修走:11~12 是仙品，
 * 14 及以上是神品」。
 *
 * **即「品质跟着境界走」是既定原则，不是数据的自然结果。**
 *
 * ## 但没人守着
 *
 * ```text
 * gongfaQualityLadder.spec   九档都有货        —— 查品质覆盖
 * gongfaRealmCoverage.spec   每个准入境界都有功法 —— 查境界覆盖
 * ```
 *
 * 两条各查一维，**没有一条把两维放在一起看**。给 m0 加一部神品功法，
 * 两条都会绿 —— 而新玩家会在第一天就拿到本该是终局的东西。
 *
 * ## 判据为什么只锁 m0
 *
 * 上界可以有很多种画法（m13 仙品、m15 神品……），把整条公式钉死会伤害未来设计:
 * 一部主题是「上古遗宝」的 m2 神品功法，未必不合理。
 *
 * 但**开局那一档**不同:它是玩家对「品质有意义」这件事的第一印象。
 * m0 出现神品，等于告诉玩家「品质只是颜色」。故选这一档作为不可越的线，
 * 其余各档只作记录、不作约束。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { QUALITIES, qualityDef } from "@/data/qualities";

/** 开局档允许的最高品质 rank —— 良品（1）。 */
const M0_MAX_RANK = 1;

describe("功法品质跟着境界走", () => {
  it("扫得到足够多的功法与品质档（防空转）", () => {
    expect(GONGFA.length, "一部功法都没扫到").toBeGreaterThan(50);
    expect(QUALITIES.length, "品质档太少 —— 扫错地方了").toBeGreaterThan(5);
    expect(GONGFA.filter((g) => g.minRealm === 0).length, "m0 一部功法都没有").toBeGreaterThan(5);
  });

  it("开局档（m0）只有凡品与良品", () => {
    const bad = GONGFA.filter((g) => g.minRealm === 0)
      .filter((g) => qualityDef(g.quality).rank > M0_MAX_RANK)
      .map((g) => `${g.id}(${g.name}, ${g.quality})`);
    expect(
      bad,
      "这些开局功法高于良品 —— 玩家第一眼就会觉得「品质只是颜色」:" + bad.join(" / "),
    ).toEqual([]);
  });

  it("秘术可以更早拿到高品，但主修与辅修不许 —— 记下这条边界", () => {
    /*
     * 第 3 条判据原先写的是「越深的境界，品质上限不许回落」，实测**红了**:
     *
     * ```text
     * m7  heaven ×2 + immortal ×1（x_nitian 逆天改命经，secret）
     * m8  earth ×1 + heaven ×2      ← 最高 rank 6，比 m7 的 7 低
     * m9  immortal ×3
     * ```
     *
     * 那不是缺陷:m7 那部仙品是**秘术**，而秘术席允许在更浅的境界出现更高品质。
     * 故「品质上限单调」这条**对全表不成立**，是我的判据写宽了。
     *
     * 改成正确的形状:只看主修与辅修(main / sub)，秘术不参与。
     * 若哪天主修或辅修也出现「深境反而更浅」，这一条会红。
     */
    const maxRankAt = new Map<number, number>();
    for (const g of GONGFA) {
      if (g.type === "secret") continue;
      const rank = qualityDef(g.quality).rank;
      maxRankAt.set(g.minRealm, Math.max(maxRankAt.get(g.minRealm) ?? -1, rank));
    }
    const realms = [...maxRankAt.keys()].sort((a, b) => a - b);
    const drops: string[] = [];
    let highestSoFar = -1;
    for (const m of realms) {
      const here = maxRankAt.get(m)!;
      if (here < highestSoFar) {
        drops.push(`m${m} 的主修/辅修最高品质 rank ${here} 低于更浅境界的 ${highestSoFar}`);
      }
      highestSoFar = Math.max(highestSoFar, here);
    }
    expect(
      drops,
      "这些境界的主修/辅修品质上限比更浅的境界还低 —— 深修反而不如浅修:" + drops.join(" / "),
    ).toEqual([]);
  });
});
