/* oxlint-disable no-console -- 组合技增益体检报告的正式输出(bun run test:report 依赖) */
/**
 * 每个组合技都必须**在某个界真的有用** —— 否则它是死道具。
 *
 * ## 由来
 *
 * `COMBO_ARTS` 有三个:玄罡反震(`xuangang`)、枯泽回春(`kuze`)、风华连斩(`fenglian`)。
 * 它们此前**没有任何判据在管**(只有 `exportReach` 提了一句名字)。
 *
 * 第 75 轮试着调天界难度时,`phase21` 的组合技判据红了
 * (「xuangang 优势界反而变弱」)。当时以为是我改参数引入的回归,回退了。
 * 第 76 轮单独测才发现:**这不是回归,是这个道具本来就是死的。**
 *
 * 实测(罡盾流带/不带该法宝,30 次采样,`enemyAtkMult` 用各界的现值):
 *
 * ```text
 *   xuangang 最佳 星陨天  0   ← 五个界里没有一个是正增益
 *   kuze     最佳 赤炎天 +13
 *   fenglian 最佳 赤炎天 +13
 * ```
 *
 * ## 根因(为什么 xuangang 触发不了)
 *
 * `combat.ts` 里的触发条件是 `shieldBroken`,而那是
 * `isZero(target.shield)` —— **护盾恰好被打光到 0** 才为真。
 *
 * 罡盾流只有开局那 `shieldOnStart 0.4` 一层盾,被打光后不再生;
 * 而能打光它的多是单段高伤,那种场合罡盾流本来就撑不住 ——
 * 「盾破」那一刻往往就是败局已定,反震一次救不回来。
 *
 * ## 判据
 *
 * 每个组合技在**至少一个**天界里,带上它的通关率要高出 5 个百分点。
 *
 * 为什么是 5 而不是更多:模拟噪声在 30 次采样下约 ±3~4 个点,
 * 5 点是「真的有用」与「噪声」之间的分界。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { COMBO_ARTS } from "@/data/comboArts";
import { worldClearRate } from "./celestialSim";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import type { CombatantSnap } from "@/types";

/** 该道具在某个界里的增益(百分点) */
function gainIn(worldIdx: number, artId: string, profileId: string): number {
  const profile = BUILD_PROFILES.find((p) => p.id === profileId);
  if (!profile) return 0;
  const base = buildSnap(profile);
  const withArt: CombatantSnap = { ...base, comboArt: artId };
  const world = CELESTIAL_WORLDS[worldIdx]!;
  const plain = worldClearRate(world, base, 30, 51000);
  const boosted = worldClearRate(world, withArt, 30, 51000);
  return (boosted - plain) * 100;
}

describe("组合技 · 每个都要在某个界真的有用", () => {
  /**
   * 已知的死道具 —— `xuangang`(玄罡反震)。
   *
   * 实测五个界里增益是 `0 / 0 / 0 / -3 / -13`,一个正增益都没有。
   *
   * 根因是触发条件:它在 `shieldBroken`(`isZero(target.shield)`)那一刻才发动,
   * 而罡盾流只有 `shieldOnStart 0.4` 一层盾、被打光后不再生。
   * **「盾破」那一刻往往就是败局已定** —— 反震一次救不回来,而失去护盾的代价
   * 已经付掉了。要修得改触发条件(例如改成「护盾吸收伤害时叠加一层反震」),
   * 那是独立的设计工作,不该跟别的改动混在一起。
   *
   * 放行清单里的道具仍会打印实测值,谁动战斗节奏都看得见。
   * 清空这张表 = 修好了。
   */
  const KNOWN_DEAD = new Set(["xuangang"]);

  it("每个组合技至少有一个界能拿到 +5 个百分点", () => {
    const dead: string[] = [];
    for (const art of COMBO_ARTS) {
      const gains = CELESTIAL_WORLDS.map((_, i) => ({ i, g: gainIn(i, art.id, art.pair[0]) }));
      const best = gains.reduce((a, b) => (b.g > a.g ? b : a));
      console.log(
        `  ${art.id}: 最佳 ${CELESTIAL_WORLDS[best.i]!.name} ${best.g.toFixed(0)} | ` +
          gains.map((x) => `${CELESTIAL_WORLDS[x.i]!.name}${x.g.toFixed(0)}`).join(" "),
      );
      if (best.g < 5 && !KNOWN_DEAD.has(art.id)) {
        dead.push(`${art.id}(最佳 ${CELESTIAL_WORLDS[best.i]!.name} ${best.g.toFixed(0)})`);
      }
    }
    expect(
      dead,
      "这些组合技在任何天界都没有实际增益 —— 带上它等于白占一个法宝位:" + dead.join("、"),
    ).toEqual([]);
  });

  it("已知死道具清单不许比实测更宽 —— 修好的要摘出来", () => {
    /*
     * 反方向:如果某个道具已经修好(有了正增益),而它还留在 KNOWN_DEAD 里,
     * 说明清单过期了。这条防的是「放行之后再也不回来看」。
     */
    const stale: string[] = [];
    for (const art of COMBO_ARTS) {
      if (!KNOWN_DEAD.has(art.id)) continue;
      const best = Math.max(...CELESTIAL_WORLDS.map((_, i) => gainIn(i, art.id, art.pair[0])));
      if (best >= 5) stale.push(`${art.id}(现在最佳 ${best.toFixed(0)})`);
    }
    expect(stale, "这些组合技已经修好,该从 KNOWN_DEAD 里摘掉了:" + stale.join("、")).toEqual([]);
  });

  it("反空转:三个组合技都量到,且都有配对流派", () => {
    expect(COMBO_ARTS.length, "组合技表空了").toBeGreaterThanOrEqual(3);
    for (const art of COMBO_ARTS) {
      expect(art.pair.length, `${art.id} 没有配对流派`).toBeGreaterThanOrEqual(2);
      expect(
        BUILD_PROFILES.some((p) => p.id === art.pair[0]),
        `${art.id} 的首个配对流派 ${art.pair[0]} 不在 BUILD_PROFILES 里`,
      ).toBe(true);
    }
  });
});
