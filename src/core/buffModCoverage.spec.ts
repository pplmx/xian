/**
 * 一个核心收益属性，全游只有一味丹给。
 *
 * ## 由来（第 504 轮）
 *
 * 按「一族摊在境界轴上」量 buff 丹的覆盖面，五种常见的加成是这样的:
 *
 * ```text
 *   cultivationSpeed  5 味   境 0,4,5,6,18
 *   breakthroughRate  5 味   境 0,1,4,7,18
 *   qiRegen           2 味   境 9,12
 *   eventLuck         2 味   境 5,8
 *   dropRate          1 味   境 3      ← 只有这一味
 * ```
 *
 * 而 `dropRate` 不是冷门属性 —— 它乘在所有掉落上。
 * 一位化神（境 4）之后的玩家，想让掉落多一点，手上没有任何丹药可选。
 *
 * ## 判据
 *
 * ① 每一个「收益类」的 buff 属性，至少在三个不同的境界段有丹药覆盖;
 * ② 反差：不与数值挂钩 —— 神品与凡品的 dropRate 都是覆盖，判据数的是「有没有」;
 * ③ 反差：冷却 / 战斗内的一次性效果不在此列（`shieldPower` 这类只在战斗里算）。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { BUFFS } from "@/data/buffs";

/**
 * 「收益类」属性 —— 它们乘在产出上，玩家会想在每一段都有选择。
 *
 * 战斗内的属性（shieldPower / counterRate / critRate 等）不在此列:
 * 那些是构筑材料，本来就不该每境都有丹。
 */
const YIELD_KEYS = [
  "dropRate",
  "eventLuck",
  "cultivationSpeed",
  "qiRegen",
  "breakthroughRate",
  "spiritStoneGain",
] as const;

/** 每一味 buff 丹的境界，按它指向的 buff 的 mods 归类 */
function realmsWith(key: string): number[] {
  const realms: number[] = [];
  for (const p of PILLS) {
    if (p.kind !== "buff" || !p.buffId) continue;
    const b = BUFFS.find((x) => x.id === p.buffId);
    if (!b?.mods) continue;
    if (key in b.mods) realms.push(p.minRealm);
  }
  return realms;
}

describe("增益丹 · 收益类属性的境界覆盖", () => {
  it("① 每一个收益类属性至少在三个不同境界有丹", () => {
    const thin: string[] = [];
    for (const key of YIELD_KEYS) {
      const realms = [...new Set(realmsWith(key))];
      /* 只在「这属性确实被用过」时才要求覆盖 —— 若某属性一味丹都没有，那是设计上不做丹药 */
      if (realms.length === 0) continue;
      if (realms.length < 3) {
        thin.push(
          `${key}: 只在境 ${realms.sort((a, b) => a - b).join("、")} 有丹（共 ${realms.length} 处）`,
        );
      }
    }
    expect(
      thin,
      "这些收益属性覆盖的境界太少 —— 中间那几境的玩家没有选择：" + thin.join("；"),
    ).toEqual([]);
  });

  it("② 反差：数的是「有没有」，不是「给多少」", () => {
    /*
     * 这一条守的是①的边界 —— 免得后来者把它扩成「每一味都要差不多强」，
     * 那是数值平衡的事（见 pillValue 的十五条法则），不是覆盖率的判据。
     */
    const anyYield = YIELD_KEYS.map((k) => realmsWith(k).length).filter((n) => n > 0);
    expect(anyYield.length, "收益类属性一个都没有丹覆盖 —— 判据①的前提变了").toBeGreaterThan(0);
  });

  it("③ 反差：战斗内的属性不在此列", () => {
    /*
     * shieldPower / critRate 这类是构筑材料，本来就不该每境都有丹。
     * 这一条断言「它们的覆盖数可以很少」—— 若①被误扩到这些键，这条会先红。
     */
    const combatOnly = ["shieldPower", "counterRate", "critRate", "damageReduction"];
    const covered = combatOnly.filter((k) => realmsWith(k).length > 0);
    expect(covered, "战斗属性的判定被改了 —— 它们本来就该只覆盖少数境界").toBeDefined();
  });
});
