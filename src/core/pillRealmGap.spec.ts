/**
 * 大乘期只有一味丹药 —— 而相邻两境各有五味、三味。
 *
 * ## 由来（第 487 轮）
 *
 * 前六轮补的是**事件**（按标签密度逐个补）。这一轮换到丹药，查的是另一个维度:
 * 每个境界有几味可炼丹药。
 *
 * ```text
 *   境界 6  合体   5 味（万寿金丹、御风丹、仙尘散、万灵丹、泉露）
 *   境界 7  大乘   1 味（九转还魂丹）        ← 只有一味
 *   境界 8  渡劫   3 味（渡劫丹、鸿运丹、混沌丹）
 * ```
 *
 * 大乘是人间界倒数第二境、真仙前的最后一站。玩家在这一境待的时间不短
 * （见 progressionSim 的逐境耗时），而**整个境界只有一张丹方**。
 *
 * ## 判据
 *
 * ① 每一境至少有 2 味可炼丹药 —— 一味不成「选」；
 * ② 反差：新增的那几味确实在境界 7，且不是掉落品（掉落品不进丹方池）。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { REALMS } from "@/data/realms";

/** 可炼丹（有 recipe）按境界计数 */
function craftableByRealm(): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of PILLS) {
    if (!p.recipe) continue;
    m.set(p.minRealm, (m.get(p.minRealm) ?? 0) + 1);
  }
  return m;
}

describe("丹药 · 每一境都得有得选", () => {
  it("① 每一境至少有 2 味可炼丹药", () => {
    const by = craftableByRealm();
    const thin: string[] = [];
    for (let m = 0; m < REALMS.length; m++) {
      const n = by.get(m) ?? 0;
      /*
       * 末几境（神界、混沌海）本来就靠奇遇与天界产出，不强求每境两味；
       * 人间界与仙界（0~13）是玩家真会停下来炼药的地方。
       */
      if (m <= 13 && n < 2) thin.push(`境界 ${m}(${REALMS[m]!.name}): ${n} 味`);
    }
    expect(thin, "这些境界的可炼丹不足两味 —— 玩家没得选：" + thin.join("、")).toEqual([]);
  });

  it("② 反差：新补的三味各在一境，且都是增益丹", () => {
    /*
     * 为什么补增益丹而不是再补一味修为丹:
     * 那三个境界（7 大乘 / 9 真仙 / 11 金仙）的现状是**只有修为丹** ——
     * 玩家到了那里，可选的动作只剩「再补一点修为」。
     * 而增益丹给的是「接下来这段时间怎么打」，是另一种决策。
     */
    const cases: Array<[string, number]> = [
      ["p_dachengshen", 7],
      ["p_zhenxianling", 9],
      ["p_jinxianjue", 11],
    ];
    for (const [id, realm] of cases) {
      const p = PILLS.find((x) => x.id === id);
      expect(p, `${id} 不在丹药表里`).toBeDefined();
      expect(p!.minRealm, `${id} 不在境界 ${realm}`).toBe(realm);
      expect(p!.recipe, `${id} 没有丹方 —— 它是掉落品，不进丹方池`).toBeDefined();
      expect(p!.kind, `${id} 不是增益丹 —— 那三个境界缺的正是它`).toBe("buff");
    }
  });
});
