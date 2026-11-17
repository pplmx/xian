/**
 * 从新号到第一次突破：这条路上每一步都算得出数吗。
 *
 * ## 为什么单独写这一份
 *
 * 本仓的验证是按主题分片的:一击的伤害有 `combat`、掉落有 `loot`、
 * 境界曲线有 `progressionSim`、开局引导有 `firstStep`。
 * 而**玩家实际走的是那条从头到尾的路** —— 没有任何一份 spec 沿着它走一遍。
 *
 * `highTierSmoke` 补的是另一端(界外的敌人快照与掉落真的跑得出数),
 * 这一份补的是起点:一个刚建号的人，面前那几步各自有没有数、说不说得清。
 *
 * ## 它不做什么
 *
 * 不驱动 store、不模拟点击、不判定手感。它只回答一件可机械验证的事:
 * **这条路上每个节点所需的数，都能从现成的纯函数里取到，且是有限的正数。**
 * 取不到、取到 NaN、取到 0 —— 那一步玩家就会看到空的东西。
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS } from "@/data/regions";
import { ENEMIES } from "@/data/enemies";
import { PILLS } from "@/data/pills";
import { GONGFA } from "@/data/gongfa";
import { breakthroughBaseRate, expRequirement } from "@/core/formulas";
import { powerScale } from "@/core/tierScale";
import { toNum } from "@/utils/gnum";

describe("开局链路 · 从新号到第一次突破", () => {
  it("① 第一步：有地方可去，且那儿有敌人", () => {
    const starts = REGIONS.filter((r) => r.minRealm === 0);
    expect(starts.length, "开局一处地界都没有").toBeGreaterThan(0);
    for (const r of starts) {
      expect(r.enemies.length, `${r.name} 没有敌人 —— 玩家进去打什么`).toBeGreaterThan(0);
      for (const id of r.enemies) {
        expect(
          ENEMIES.some((e) => e.id === id),
          `${r.name} 引用了不存在的敌人 ${id}`,
        ).toBe(true);
      }
    }
  });

  it("② 第二步：有丹可炼，且门槛在丹炉够得着的范围里", () => {
    const craftable = PILLS.filter((p) => p.recipe && p.minRealm === 0);
    expect(craftable.length, "开局一味可炼的丹都没有").toBeGreaterThan(0);
    /*
     * 丹炉从 0 级起 —— 而 0 级的炉子炼不了任何 alchemyLevel ≥ 1 的方子。
     * 所以「开局第一味丹」需要玩家先把炉子升起来:这本身是设计（引导他去建洞府），
     * 但门槛不该高到要升好几级。
     */
    const easiest = Math.min(...craftable.map((p) => p.alchemyLevel ?? 0));
    expect(easiest, "开局最易的丹方也要 2 级以上的炉子 —— 第一步太远").toBeLessThanOrEqual(1);
  });

  it("③ 第三步：有功法可修，且主修席填得满", () => {
    const mains = GONGFA.filter((g) => g.minRealm === 0 && g.type === "main");
    expect(mains.length, "开局一部主修功法都没有 —— 主修席空着").toBeGreaterThan(0);
  });

  it("④ 第四步：修为目标是个有限的数，且随境界抬升", () => {
    /*
     * `expToNext` 是「这一境还要多少修为」的唯一来源。
     * 若它给 0 或 NaN，界面上那条进度条就永远涨不动或直接坏掉。
     */
    const rows: { major: number; exp: number }[] = [];
    for (let m = 0; m <= 3; m += 1) {
      const exp = toNum(expRequirement(m, 0));
      expect(Number.isFinite(exp), `第 ${m} 境的修为需求不是有限数：${exp}`).toBe(true);
      expect(exp, `第 ${m} 境的修为需求是 0 —— 一步就过`).toBeGreaterThan(0);
      rows.push({ major: m, exp });
    }
    for (let i = 1; i < rows.length; i += 1) {
      expect(
        rows[i]!.exp,
        `第 ${rows[i]!.major} 境的需求不高于第 ${rows[i - 1]!.major} 境 —— 越练越容易`,
      ).toBeGreaterThan(rows[i - 1]!.exp);
    }
  });

  it("⑤ 第五步：第一次突破有成功率，且是个能看的数", () => {
    const rate = breakthroughBaseRate(0, 0);
    expect(Number.isFinite(rate), `第一次突破的成功率不是有限数：${rate}`).toBe(true);
    expect(rate, `第一次突破的成功率是 0 —— 必败`).toBeGreaterThan(0);
    expect(rate, `第一次突破的成功率 ≥ 100% —— 无悬念`).toBeLessThan(1);
  });

  it("⑥ 反差：这条路的强度曲线是连续的，不是一跳到底", () => {
    /*
     * 开局那几处地界的敌人强度（powerScale）该是平缓上升的。
     * 若第 1 境与第 3 境差出几十倍，玩家会在第二步撞墙。
     */
    const tiers = [1, 2, 3];
    const scales = tiers.map((t) => toNum(powerScale(t)));
    for (let i = 1; i < scales.length; i += 1) {
      const ratio = scales[i]! / scales[i - 1]!;
      expect(
        ratio,
        `t${tiers[i]} 相对 t${tiers[i - 1]} 强了 ${ratio.toFixed(1)} 倍 —— 断层`,
      ).toBeLessThan(5);
    }
  });
});
