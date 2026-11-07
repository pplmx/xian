/**
 * 功法效果审计 —— 主修席唯一,每一部主修都得真有「戴它的理由」。
 *
 * ## 玩家反馈:深入 review 各个功法效果
 *
 * 把 70 部功法的满级总值摊开比一遍,发现的问题不是「数值偏高偏低」,
 * 而是**两部主修缺了立足的东西**:
 *
 * | 功法 | 境 | 缺什么 |
 * | --- | --- | --- |
 * | 大罗天章 | 13 | **既无 `skill`,也无 `cultivationSpeed`** |
 * | 金阙玉章 / 太乙救苦经 / 天关神兵诀 / 神王御极经 / 神帝临尘章 / 神魔开天经 | 11~19 | 无 `cultivationSpeed`,但有 `skill` 与高攻击补偿 |
 *
 * 第五条之后那一串是**有意的分野**:主修席只有一个,一边是「进阶流」
 * (带修速,如神霄九变 80%、混元无极经 98%),一边是「战斗流」
 * (无修速,但攻击/防御词条明显更高,如神魔开天经攻击 54%)。两条都说得通,
 * 所以判据不要求每部主修都有修速 —— 它要求的是**两者至少有一个**。
 *
 * 大罗天章两样都没有:它既不能加速进阶,也没有功法招式。它唯一的立足点是
 * `attackPct +48.4% / maxHpPct +36% / damageReduction +8%` —— 而同样无修速、
 * 攻击 48.4% 的神王御极经(境 16)还多带一个 ×3.6 的技能与「处决伤害 +10%」。
 * 玩家在境 13 花同样的参悟代价,拿到的是一个更弱的形状。
 *
 * ## 判据守什么
 *
 * 1. **每部主修至少有一条「戴它的理由」**:`skill` 或 `cultivationSpeed` 二者必居其一;
 * 2. **主修技能强度随境界单调不减**(跨境界看,同境界内并行选项允许互相低)。
 *
 * 它不规定具体数值、不要求每部主修都强 —— 那是内容设计的事。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { qualityDef } from "@/data/qualities";

/** 满级总值 = base + perLevel × (maxLevel - 1) */
function totalMods(def: (typeof GONGFA)[number]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(def.baseMods)) out[k] = (out[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(def.perLevelMods))
    out[k] = (out[k] ?? 0) + (v as number) * (def.maxLevel - 1);
  return out;
}

const MAINS = GONGFA.filter((g) => g.type === "main");

describe("功法效果 · 主修席只有一个,每部都得有立足点", () => {
  it("每部主修至少带功法招式或修速加成之一", () => {
    const naked: string[] = [];
    for (const g of MAINS) {
      const speed = totalMods(g).cultivationSpeed ?? 0;
      const hasSkill = Boolean(g.skill && g.skill.mult > 0);
      if (!hasSkill && speed <= 0) {
        naked.push(
          `${g.name}(境${g.minRealm},${qualityDef(g.quality).name}):既无功法招式,也无修速加成`,
        );
      }
    }
    expect(
      naked,
      "这些主修戴上之后既不能加速进阶、也打不出功法招式 —— 主修席只有一格,它得值那一格",
    ).toEqual([]);
  });

  it("主修技能强度随准入境界单调不减", () => {
    /*
     * 同境界内的并行选项允许互相低(境 0 五部主修的 ×1.4~×1.7 是三路走法),
     * 但**下一个境界的最高招式**不该弱于上一个境界的最高招式 ——
     * 否则玩家越练越弱。取每境最高值再比。
     */
    const byRealm = new Map<number, number>();
    for (const g of MAINS) {
      if (!g.skill) continue;
      const prev = byRealm.get(g.minRealm) ?? 0;
      byRealm.set(g.minRealm, Math.max(prev, g.skill.mult));
    }
    const realms = [...byRealm.keys()].sort((a, b) => a - b);
    const drops: string[] = [];
    for (let i = 1; i < realms.length; i += 1) {
      const lo = byRealm.get(realms[i - 1]!)!;
      const hi = byRealm.get(realms[i]!)!;
      if (hi < lo) drops.push(`境${realms[i]} 最高招式 ×${hi} 低于境${realms[i - 1]} 的 ×${lo}`);
    }
    expect(drops, "主修招式越练越弱 —— 下一个境界的顶不该比上一个境界的顶更低").toEqual([]);
  });

  it("同境界同品阶内,每部主修在至少一个词条上不被全面压过", () => {
    /*
     * 主修席只有一格:若同境界、**同品阶**的另一部主修在每一个词条上都不差于它,
     * 它就没有存在理由。
     *
     * 为什么限定同品阶:凡品太玄引气诀(境 0)被同境四部良品全面压过,那是
     * **进度梯度**,不是缺陷 —— 凡品本来就是入门那一档,玩家两天后就会换掉。
     * 拿它判红灯会把健康的成长曲线判成问题。真正该守的是「同一档里别有一部
     * 纯属摆设」:同品阶、同境界、被全词条压过,它就没有存在理由。
     */
    const dominated: string[] = [];
    for (const a of MAINS) {
      const ta = totalMods(a);
      for (const b of MAINS) {
        if (a.id === b.id) continue;
        if (a.minRealm !== b.minRealm) continue;
        if (qualityDef(a.quality).rank !== qualityDef(b.quality).rank) continue;
        const tb = totalMods(b);
        const keys = new Set([...Object.keys(ta), ...Object.keys(tb)]);
        let allGe = true;
        let anyGt = false;
        for (const k of keys) {
          const va = ta[k] ?? 0;
          const vb = tb[k] ?? 0;
          if (va < vb) {
            allGe = false;
            break;
          }
          if (va > vb) anyGt = true;
        }
        // 判定方向:上面算的是「a 在每个词条上都不差于 b」,即 **a 支配 b**。
        // 故被压过的是 b,不是 a —— 写反了会把所有弱功法都记成「被压」。
        if (allGe && anyGt) {
          dominated.push(
            `${b.name}(境${b.minRealm},${qualityDef(b.quality).name}) 被 ${a.name} 在每个词条上都不差于`,
          );
        }
      }
    }
    expect(dominated, "同境界的主修被另一部全面压过 —— 主修席只有一格,它没有存在理由").toEqual([]);
  });
});
