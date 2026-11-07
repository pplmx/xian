/**
 * 闪避封顶 —— 宿主与库必须同一个数。
 *
 * ## 复现
 *
 * 同一个「闪避」概念在两处各算一遍:
 *
 * ```text
 *   src/core/combat.ts              Math.max(0, dodgeRate - accuracy)           ← 无上限
 *   packages/engine/src/combat.ts   Math.min(0.95, dodgeRate - accuracy)        ← 封顶 95%
 * ```
 *
 * 玩家的实际战斗走宿主那一条(`resolveCombat`),库那一条是并行实现。
 * 于是「堆闪避」在两条路上结论不同:宿主给 96% 落空,库只给 95%。
 *
 * 这是两本账,不是「各管各的」—— 两边算的都是同一件事(这一下打没打中)。
 *
 * ## 为什么该有顶
 *
 * 满闪避会让「谁先手」之外的整场战斗失去意义:敌方一次都打不中,
 * 战报读起来像坏了。留 5% 窗口,堆闪避仍是强路,但不是无敌路。
 *
 * 实测玩家侧可达闪避 87%(辅修 + 装备 + 丹药之和),扣掉可达命中(约 20%)
 * 之后净闪避约 67% —— 平时摸不到这道顶,它守的是极端堆叠。
 *
 * ## 判据守什么
 *
 * 宿主侧必须有这个上限,且与库侧同一个数。两处任何一处改了而另一处没跟上,
 * 这条会红 —— 那时应该是一次**显式的**口径改动,而不是顺手改掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 库侧封顶写在 packages/engine/src/combat.ts */
const ENGINE_CAP = 0.95;

describe("闪避封顶", () => {
  it("宿主侧也有上限,且与库侧同一个数", () => {
    const host = readFileSync(resolve(__dirname, "./combat.ts"), "utf8");
    const line = host.split("\n").find((l) => l.includes("dodgeRate") && l.includes("accuracy"));
    expect(line, "宿主侧找不到闪避算式(判据空转)").toBeTruthy();
    expect(line, `宿主侧的闪避算式没有封顶 —— 库侧封在 ${ENGINE_CAP},两边不一致就是两本账`).toMatch(
      /Math\.min\(\s*0\.95/,
    );
  });

  it("库侧封顶数与本文记录的一致(哪边改了都要回来确认)", () => {
    const engine = readFileSync(resolve(__dirname, "../../packages/engine/src/combat.ts"), "utf8");
    const line = engine.split("\n").find((l) => l.includes("dodgeRate"));
    expect(line, "库侧找不到闪避算式").toBeTruthy();
    expect(line, `库侧封顶不是 ${ENGINE_CAP}`).toContain(`Math.min(${ENGINE_CAP}`);
  });
});
