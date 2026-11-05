/**
 * 天界路线的节点,不该只有一个流派走得通。
 *
 * ## 现状判据只看「最多那个流派」
 *
 * `phase21.spec` 的「路线节点裁判」写的是:
 *
 *     best = max(各流派胜率);  expect(best).toBeGreaterThanOrEqual(0.35)
 *
 * 它证明「这个节点有解」,但没证明「你那条路有解」。一个节点若只有锋芒流能过,
 * 其余五个流派走上去就是撞墙 —— 判据照样是绿的。
 *
 * ## 这里的判据
 *
 * 同一个测量,换一个问法:**至少三个流派在该节点上有 ≥35% 的胜率**。
 *
 * 取三而不是六:天界路线的本意是「不同节点适合不同流派」,要求六个全通反而是
 * 另一种平均主义;但只留一两个,「选方向」就变成了「只有一条路」。
 *
 * 采样与种子完全照抄 phase21 那一遍(41000 + pi*97 + node.id.length),
 * 不另立一套 —— 两处若用不同种子,它们量的就不是同一件事了。
 */
import { describe, expect, it } from "vite-plus/test";
import { mulberry32, RandomService } from "@/utils/random";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import { SIM_REFERENCE } from "./celestialSim";
import { mergeRules, worldFoeSnap } from "./gauntlet";
import { resolveCombat } from "./combat";

/** 各流派在该节点上 20 场里赢了几场(0~1) */
function profileRates(
  world: (typeof CELESTIAL_WORLDS)[number],
  node: (typeof CELESTIAL_WORLDS)[number]["routes"][number][number],
): number[] {
  const foe = worldFoeSnap(node.foe, SIM_REFERENCE);
  const rules = mergeRules(world.rules, node.rules);
  return BUILD_PROFILES.map((profile, pi) => {
    const rng = new RandomService(mulberry32(41000 + pi * 97 + node.id.length));
    let wins = 0;
    for (let r = 0; r < 20; r += 1) {
      if (resolveCombat(buildSnap(profile), foe, rng, rules).win) wins += 1;
    }
    return wins / 20;
  });
}

describe("天界路线 · 节点不该只有一个流派走得通", () => {
  it("每个节点至少有三个流派 ≥35% 胜率", () => {
    const thin: string[] = [];
    for (const world of CELESTIAL_WORLDS) {
      for (const layer of world.routes) {
        for (const node of layer) {
          const rates = profileRates(world, node);
          const pass = rates.filter((r) => r >= 0.35).length;
          if (pass < 3) {
            const named = BUILD_PROFILES.map((p, i) => `${p.name} ${Math.round(rates[i]! * 100)}%`)
              .filter((_, i) => rates[i]! >= 0.35)
              .join(" / ");
            thin.push(`${world.name}·${node.name}:只有 ${pass} 个流派过线(${named || "无"})`);
          }
        }
      }
    }
    expect(
      thin,
      `这些节点对多数流派是死路 ——「选方向」在那里只剩一条:\n  ${thin.join("\n  ")}`,
    ).toEqual([]);
  });

  it("反空转:确实量到了节点,且确有流派能过", () => {
    let nodes = 0;
    let anyPass = 0;
    for (const world of CELESTIAL_WORLDS) {
      for (const layer of world.routes) {
        for (const node of layer) {
          nodes += 1;
          if (profileRates(world, node).some((r) => r >= 0.35)) anyPass += 1;
        }
      }
    }
    expect(nodes, "一个路线节点都没量到").toBeGreaterThan(0);
    expect(anyPass, "没有任何节点有解 —— 那是另一条判据的事").toBeGreaterThan(0);
  });
});
