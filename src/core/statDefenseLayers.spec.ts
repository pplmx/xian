/**
 * 数值防线的**分层图景** —— 哪些词条有收敛、哪些没有,以及为什么。
 *
 * ## 这条判据回答的问题
 *
 * 本仓有两道防线,但没有任何一处把它们**放在一起**说过:
 *
 * ```text
 *   第一道 DIMINISH_KEYS(20 个):同一词条来自多个来源时按 100/75/50/25% 递减
 *   第二道 SOFT_CAPS(5 个):合计值越过 cap 后,超出部分按 diminish 折算
 * ```
 *
 * 剩下的词条(attackPct / maxHpPct / defensePct / explorationSpeed / qiRegen …)
 * **两道都不管**,线性叠加。
 *
 * 这条图景不清楚会导致两类判断错误,两种都真实发生过:
 *
 * 1. **以为线性叠加失控** —— 实测 attackPct 极端堆到 211%(攻击 ×3.11)时,
 *    回合数从 14.0 线性降到 4.0,没有失控。它乘在「基础攻击」上,而基础攻击
 *    由境界与装备决定 —— 乘法项线性叠加本来就不是问题。
 * 2. **以为堆叠会过引擎硬底** —— `stackCap.spec` 的初版把来源数值直接相加,
 *    得出「减伤 129% 超过 90% 硬底」,而实际经 SOFT_CAPS 收敛后是 84.6%。
 *    漏的正是「玩家身上真正生效的那条计算链」。
 *
 * ## 判据守什么
 *
 * 1. 两道防线覆盖的词条集合**不许悄悄变大变小**:加了词条却没说为什么,
 *    或者删了词条让某个数值失去收敛,都当场红。
 * 2. `attackPct` / `maxHpPct` 这一类**必须仍在线性区** —— 它们乘在基础值上,
 *    收敛会破坏「面板读数 = 实际加成」的直觉,那不是可以随手加的防线。
 *
 * 它不规定 cap 取多少 —— 那是平衡调参的事。它只管**分层结构**没被误改。
 */
import { describe, expect, it } from "vite-plus/test";
import { DIMINISH_KEYS, SOFT_CAPS } from "@/data/constants";
import { mergeMods } from "./statsCalc";
import type { StatMods } from "@/types";

/** 线性区(两道防线都不管)必须包含的乘法基础词条 */
const MUST_STAY_LINEAR = ["attackPct", "defensePct", "maxHpPct"] as const;

describe("数值防线的分层图景", () => {
  it("第一道 DIMINISH 覆盖的词条数没变", () => {
    /*
     * 20 是写这条判据时的实测值。变大意味着有词条新加进递减 —— 那是一次平衡改动,
     * 该回来把这条数改掉并说明;变小意味着某个词条失去了第一道防线。
     */
    expect(DIMINISH_KEYS.length, "DIMINISH_KEYS 的条数变了 —— 那是一次显式的平衡改动").toBe(20);
  });

  it("第二道 SOFT_CAPS 覆盖的词条数没变", () => {
    expect(Object.keys(SOFT_CAPS).length, "SOFT_CAPS 的条数变了 —— 那是一次显式的平衡改动").toBe(5);
  });

  it("乘法基础词条必须留在线性区", () => {
    for (const key of MUST_STAY_LINEAR) {
      expect(
        (SOFT_CAPS as Record<string, unknown>)[key],
        `${key} 被加进了 SOFT_CAPS —— 它乘在基础值上,收敛会让「面板加成」与「实际加成」对不上`,
      ).toBeUndefined();
      expect(
        (DIMINISH_KEYS as readonly string[]).includes(key),
        `${key} 被加进了 DIMINISH_KEYS —— 同上`,
      ).toBe(false);
      /* 实证:过一遍 mergeMods 后仍是原值 */
      const merged = mergeMods([{ [key]: 1 }] as StatMods[]) as Record<string, number>;
      expect(merged[key], `${key} 的线性叠加被收敛了`).toBeCloseTo(1, 9);
    }
  });

  it("有防线的词条确实被收敛(防线不是写着好看的)", () => {
    /* 减伤:SOFT_CAPS cap 0.55 —— 129% 应收到 84.6%,不是原样 129% */
    const dr = mergeMods([{ damageReduction: 1.29 }] as StatMods[]).damageReduction ?? 0;
    expect(dr, "减伤没被 SOFT_CAPS 收敛 —— 第二道防线失效了").toBeLessThan(1.29);
    expect(dr, "减伤收敛后的值不对").toBeCloseTo(0.55 + (1.29 - 0.55) * 0.4, 3);
    /* 闪避:DIMINISH cap 0.55 —— 87% 应收到 67.8% */
    const dg = mergeMods([{ dodgeRate: 0.87 }] as StatMods[]).dodgeRate ?? 0;
    expect(dg, "闪避没被收敛 —— 第一道防线失效了").toBeLessThan(0.87);
  });
});
