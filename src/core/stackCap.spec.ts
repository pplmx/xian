/**
 * 词条堆叠上限 —— 按**真实生效值**判,不是把原始数值直接相加。
 *
 * ## 这条判据的第一版是错的(记在这里,免得下次再犯)
 *
 * 初版把各来源的 `damageReduction` 原始值直接相加(主修 15.6 + 辅修 79.6 + 丹药 34
 * = 129.2%),再拿它去比引擎的 `Math.max(0.1, 1 - damageReduction)` 硬底,
 * 结论是「堆过 90%、39 个百分点白投入」。
 *
 * **那个前提漏了一整层**:玩家的属性快照不是原始值直接相加,而是经
 * `core/statsCalc.mergeMods` → 库的 `mergeModsDetailed`,那里有一道**软阈值**:
 *
 * ```text
 *   scaled = cap + (raw - cap) × diminish
 *   SOFT_CAPS: damageReduction { cap: 0.55, diminish: 0.4 }
 * ```
 *
 * 实测(直接调 mergeMods):输入 129% → 输出 **84.6%**;要摸到 90% 硬底,
 * 原始值需要 **142%**。所以 129% 离白投入还差得远,初版那条「必须压到 100% 以内」
 * 的结论是被错误前提推出来的。
 *
 * ## 判据守什么(改后的口径)
 *
 * 拿**真实快照会拿到的那个数**去比引擎硬底 —— 也就是过一遍 `mergeMods`。
 * 这才是玩家身上真生效的减伤;原始值之和只是中间量,拿它判会误伤正常堆叠。
 *
 * 阈值仍是 90%:越过它就等于有投入是纯浪费。软阈值本身已经把它压得很低
 * (142% 原始值才够),所以这条判据平时不会红 —— 它守的是有人改动 SOFT_CAPS
 * 或往 `damageReduction` 上加来源时的极端情形。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { PILLS } from "@/data/pills";
import { buffDef } from "@/data/buffs";
import { mergeMods } from "./statsCalc";
import type { StatMods } from "@/types";

/** 主修席 1 个 */
const MAIN_SLOTS = 1;
/** 辅修席上限:藏经阁满级给 1 + floor(lv / 3) 个,满级 7 个(见 data/buildings) */
const SUB_SLOTS = 7;
/** 引擎在 `Math.max(0.1, 1 - damageReduction)` 处的硬底 —— 最多把伤害压到一成 */
const ENGINE_FLOOR = 0.9;

function fullMods(def: (typeof GONGFA)[number], stat: string): number {
  const base = (def.baseMods as Record<string, number | undefined>)[stat] ?? 0;
  const per = (def.perLevelMods as Record<string, number | undefined>)[stat] ?? 0;
  return base + per * (def.maxLevel - 1);
}

/** 把「各来源各一格」摆成真实合并会看到的形态:每个来源一条 mods */
function stackSources(stat: string): StatMods[] {
  const mains = GONGFA.filter((g) => g.type === "main")
    .map((g) => fullMods(g, stat))
    .sort((a, b) => b - a);
  const subs = GONGFA.filter((g) => g.type !== "main")
    .map((g) => fullMods(g, stat))
    .sort((a, b) => b - a);
  const pills = PILLS.filter((p) => p.buffId)
    .map((p) => (buffDef(p.buffId!)?.mods as Record<string, number | undefined>)?.[stat] ?? 0)
    .sort((a, b) => b - a);

  const sources: StatMods[] = [];
  for (const v of mains.slice(0, MAIN_SLOTS)) if (v > 0) sources.push({ [stat]: v } as StatMods);
  for (const v of subs.slice(0, SUB_SLOTS)) if (v > 0) sources.push({ [stat]: v } as StatMods);
  for (const v of pills.slice(0, 2)) if (v > 0) sources.push({ [stat]: v } as StatMods);
  return sources;
}

describe("词条堆叠上限(按真实生效值)", () => {
  it("减伤过完软阈值之后,离引擎硬底还有余量", () => {
    const sources = stackSources("damageReduction");
    const raw = sources.reduce(
      (a, s) => a + ((s as Record<string, number>).damageReduction ?? 0),
      0,
    );
    const merged = mergeMods(sources).damageReduction ?? 0;
    expect(
      merged,
      `减伤堆叠原始 ${(raw * 100).toFixed(1)}%,过完软阈值 ${(merged * 100).toFixed(1)}% —— ` +
        `已触及引擎硬底 ${ENGINE_FLOOR * 100}%,超出的投入完全是浪费`,
    ).toBeLessThan(ENGINE_FLOOR);
  });

  it("硬底确实需要极端原始值才摸得到(说明软阈值在起作用)", () => {
    /*
     * 这条不是「不该发生」,而是把「软阈值真的在收敛」钉住:
     * 若哪天有人把 SOFT_CAPS 的 diminish 调高或 cap 撤掉,
     * 上一条会红,而这条会立刻指出「现在多低的原始值就能摸到硬底」。
     */
    const merged = mergeMods([{ damageReduction: 1.29 }] as StatMods[]);
    expect(
      merged.damageReduction ?? 0,
      "129% 原始减伤没过软阈值 —— SOFT_CAPS 可能被改动或撤掉了",
    ).toBeLessThan(0.9);
  });
});
