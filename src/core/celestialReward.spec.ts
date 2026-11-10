/**
 * 天界的道源奖励要跟得上层级 —— 越往后越难,给得也该越多。
 *
 * ## 缺口(第 93 轮实测)
 *
 * 五个固定天界的层级从 22 跨到 32(+10 层),而道源奖励几乎不动:
 *
 * ```text
 *   天界      tier   奖励(修前)   奖励(修后)
 *   赤炎天     22      60           60
 *   星陨天     23      65           65
 *   万刃天     25      60           66
 *   无生天     29      60           74
 *   无相天     32      60           82
 * ```
 *
 * **越难的天界给得越少** —— 万刃天、无生天、无相天的奖励与赤炎天一模一样,
 * 而后三者的难度明显更高(第 74 轮实测:万刃天/无生天的某些流派通关率只有 5~10%)。
 * 玩家没有理由往后面走。
 *
 * ## 为什么既有判据没抓到
 *
 * `worldGen.spec` 有两条:
 *
 * ```text
 *   expect(world.rewardDaoSource).toBeGreaterThanOrEqual(55);
 *   expect(world.rewardDaoSource).toBeLessThanOrEqual(100);
 * ```
 *
 * 它们守的是**随机生成世界**的奖励有界,不管固定天界之间的**相对关系**。
 * 60 和 65 各自都在 [55, 100] 里 —— 两条判据都绿。
 *
 * ## 判据
 *
 * 按 `anchorTier` 排序后,奖励**不许回落**。允许相等(相邻两界难度接近时同价合理),
 * 只禁「更难的反倒给得少」。
 *
 * 与 `celestialCaliber.spec` 里那条试炼判据同一形状 —— 那是第 62 轮为
 * 「十道试炼里九道奖励同一个数」补的,这里是它在天界侧的对应物。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";

describe("天界奖励 · 跟得上层级", () => {
  it("按层级排序后,道源奖励不回落", () => {
    const sorted = [...CELESTIAL_WORLDS].sort((a, b) => a.anchorTier - b.anchorTier);
    expect(sorted.length, "天界太少 —— 判据量不出趋势").toBeGreaterThanOrEqual(5);

    const drops: string[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.rewardDaoSource < prev.rewardDaoSource) {
        drops.push(
          `${prev.name}(tier ${prev.anchorTier}, ${prev.rewardDaoSource}) → ` +
            `${cur.name}(tier ${cur.anchorTier}, ${cur.rewardDaoSource})`,
        );
      }
    }
    expect(drops, "更难的天界反而给得更少 —— 玩家没有理由往后面走:" + drops.join("、")).toEqual([]);
  });

  it("最高与最低天界的奖励拉开了差距", () => {
    /*
     * 反空转:上面那条允许「全部相等」—— 那也能过,但等于奖励与层级无关。
     * 这条要求两端至少差出一成,否则「随层级递增」只是名义上的。
     */
    const sorted = [...CELESTIAL_WORLDS].sort((a, b) => a.anchorTier - b.anchorTier);
    const lo = sorted[0]!;
    const hi = sorted[sorted.length - 1]!;
    const ratio = hi.rewardDaoSource / lo.rewardDaoSource;
    expect(
      ratio,
      `最难的 ${hi.name}(tier ${hi.anchorTier}) 只比最易的 ${lo.name}(tier ${lo.anchorTier}) ` +
        `多 ${((ratio - 1) * 100).toFixed(0)}% —— 层级差了 ${hi.anchorTier - lo.anchorTier} 层`,
    ).toBeGreaterThan(1.1);
  });

  it("门票与场次作为对照:它们本来就不该随层级涨", () => {
    /*
     * 这条是**记录设计意图**,不是挑刺。
     *
     * 五个天界的 `entryCost` 都是 20、`fights` 都是 6 —— 那是有意的:
     * 门票是「一次挑战的入场费」,难度已经体现在敌人的三维与规则里,
     * 再让门票也跟着涨,等于对同一件事收两遍钱。
     *
     * 写进来是因为第 93 轮第一眼看到「门票和场次完全相同」时以为是缺陷 ——
     * 把「这里为什么相同」记下来,下一个人就不用再查一遍。
     */
    const costs = new Set(CELESTIAL_WORLDS.map((w) => w.entryCost));
    const fights = new Set(CELESTIAL_WORLDS.map((w) => w.fights ?? 6));
    expect(costs.size, "门票开始随层级变了 —— 若是有意改的,更新这段注释").toBe(1);
    expect(fights.size, "场次开始随层级变了 —— 若是有意改的,更新这段注释").toBe(1);
  });
});
