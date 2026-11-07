/**
 * 词条堆叠上限 —— 「堆到顶之后再多也是浪费」这件事得有人量。
 *
 * ## 缺口
 *
 * `combat.ts` 算受伤时是 `factor *= Math.max(0.1, 1 - mods.damageReduction)` ——
 * 减伤有 90% 的硬底(最多只能把伤害压到一成)。但没有判据守着「玩家堆不堆得到 90%」。
 *
 * 实测(本轮审计)按引擎口径算出来的极端上限:
 *
 * ```text
 *   主修席 1:太乙救苦经满级         15.6%
 *   辅修席 7(藏经阁满级):神炼不灭身 27.6 + 藐姑射神章 14.0
 *                        + 金刚不坏身 12.0 + 混沌体术 8.0
 *                        + 铁骨铮铮功 7.0 + 九霄劫印 6.0 + 仙光护体诀 5.0
 *                        = 79.6%
 *   丹药 2:神威 18.0 + 神将 16.0    = 34.0%
 *                  合计           129.2%
 * ```
 *
 * 也就是说**可以堆到 129%**,而引擎只认到 90%。超出的 39 个百分点完全浪费 ——
 * 玩家把辅修席、丹药位、功法层数都投进减伤,拿到的却和 90% 时一模一样。
 *
 * (修完之后同一口径量到 ≤100%,留的那一点余量是给玩家的构筑自由:
 * 能堆到顶是设计,堆过头才是浪费。)
 *
 * ## 判据守什么
 *
 * 各种「可同时生效」的来源加起来,不许越过引擎的硬底太多。留一点余量是必要的:
 * 玩家应当能堆到顶(那是构筑自由),但不该堆到 90% 以上还毫不知情地继续堆。
 *
 * 阈值取 100%:不禁止堆到顶,**只禁止「堆过顶」** —— 超过 100% 意味着必然有
 * 至少 10 个百分点的投入是纯浪费。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { PILLS } from "@/data/pills";
import { buffDef } from "@/data/buffs";

/** 主修席 1 个 */
const MAIN_SLOTS = 1;
/** 辅修席上限:藏经阁满级给 1 + floor(lv / 3) 个,满级 7 个(见 data/buildings) */
const SUB_SLOTS = 7;

/** 满级总值(与 core/pillValue 的 totalMods 同口径) */
function fullMods(def: (typeof GONGFA)[number], stat: string): number {
  const base = (def.baseMods as Record<string, number | undefined>)[stat] ?? 0;
  const per = (def.perLevelMods as Record<string, number | undefined>)[stat] ?? 0;
  return base + per * (def.maxLevel - 1);
}

describe("词条堆叠上限", () => {
  it("减伤堆不到 100%", () => {
    const mains = GONGFA.filter((g) => g.type === "main")
      .map((g) => fullMods(g, "damageReduction"))
      .sort((a, b) => b - a);
    const subs = GONGFA.filter((g) => g.type !== "main")
      .map((g) => fullMods(g, "damageReduction"))
      .sort((a, b) => b - a);

    const bestMain = mains.slice(0, MAIN_SLOTS).reduce((a, v) => a + v, 0);
    const bestSubs = subs.slice(0, SUB_SLOTS).reduce((a, v) => a + v, 0);
    /*
     * 丹药只取一件:同一时刻能生效的不同 buffId 可以并存,但减伤这一条只有
     * 神威丹 / 神将丹两味(护心丹是更低阶的同族),按「最高那一件」算是保守下限 ——
     * 玩家确实可以两味一起吃,故这里把前二都算上。
     */
    const pillReductions = PILLS.filter((p) => p.buffId)
      .map(
        (p) =>
          (buffDef(p.buffId!)?.mods as Record<string, number | undefined>)?.damageReduction ?? 0,
      )
      .sort((a, b) => b - a);
    const bestPills = pillReductions.slice(0, 2).reduce((a, v) => a + v, 0);

    const ceiling = bestMain + bestSubs + bestPills;
    expect(
      ceiling,
      `减伤堆叠上限 ${(ceiling * 100).toFixed(1)}% —— 引擎在 90% 处封底` +
        `(combat 的 Math.max(0.1, 1 - damageReduction)),超出的部分玩家白投入`,
    ).toBeLessThanOrEqual(1);
  });
});
