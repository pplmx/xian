/**
 * 深修回报里缺一条「非知识轴」—— 而它已经有了一个现成的落点。
 *
 * ## 由来（第 525 轮）
 *
 * `contentGateAudit` 的诊断已经写死在档案里:
 *
 * ```text
 *   合格回报   灵兽（收藏轴）· 丹方 / 功法 / 区域与敌手认知（知识轴，三项）
 *              · 天界道痕（终局轴）
 *   警告       四类合格回报里有三类集中在同一条轴上 —— 方向差异不足，
 *              需要新增非知识类的深修价值
 * ```
 *
 * 而「灵兽」是收藏、「天界道痕」是终局 —— **中间缺一条战斗/构筑轴**。
 *
 * ## 现成的落点：本世命题
 *
 * `LifeThemeDef` 现在是 `insight`（宿慧，进知识轴）+ `legacy`（一句叙事）。
 * **达成命题这件事本身已经在要求「这一世活到某个深度」**（17 种命题按 0~4 阶分层），
 * 而它给的回报全部落在知识轴上。
 *
 * 于是这一轮给它加一个可选字段 `mods`:
 *
 * ```text
 *   达成命题 → 永久获得一个战斗词条（不可用其他方式获得）
 * ```
 *
 * 这条通道的性质:
 *
 * ```text
 *   不可折算   它不是宿慧、不是资源，换不成修炼速度（fruitOutlets 那条红线）
 *   不可替代   只在「这一世做到某件事」时给，刷不出来
 *   非知识轴   它进的是 finalStats，不是认知
 * ```
 *
 * ## 判据
 *
 * ① 至少有一门命题给战斗词条 —— 否则「非知识轴的深修价值」仍然为空;
 * ② 反差：词条不许进「修炼速度」那条效率链（fruitOutlets 的红线）;
 * ③ 反差：没写 `mods` 的命题仍然只有宿慧 —— 不许给每一条都塞词条。
 */
import { describe, expect, it } from "vite-plus/test";
import { LIFE_THEMES } from "@/data/lifeThemes";

/** 那条绝不能出现的键 —— 见 core/fruitOutlets.spec 的结论 */
const FORBIDDEN = ["cultivationSpeed", "expGain", "dropRate", "spiritStoneGain", "luck"] as const;

describe("本世命题 · 深修回报的非知识轴", () => {
  it("① 至少有一门命题给战斗词条", () => {
    const withMods = LIFE_THEMES.filter(
      (t) => (t as unknown as { mods?: Record<string, number> }).mods !== undefined,
    );
    expect(
      withMods.length,
      "没有任何命题给战斗词条 —— 深修回报仍然只有知识轴（contentGateAudit 的那条警告）",
    ).toBeGreaterThan(0);
  });

  it("② 反差：词条不许进效率链", () => {
    /*
     * `fruitOutlets.spec` 的结论是「没有一个属性键是安全的」——
     * 任何能换回修炼速度的键都会重建「刷得快 → 更早轮回」那个回路。
     * 故这里只许放**纯战斗**的键。
     */
    const bad: string[] = [];
    for (const t of LIFE_THEMES) {
      const mods = (t as unknown as { mods?: Record<string, number> }).mods;
      if (!mods) continue;
      for (const key of Object.keys(mods)) {
        if ((FORBIDDEN as readonly string[]).includes(key)) {
          bad.push(`${t.name}: ${key}`);
        }
      }
    }
    expect(bad, "这些命题的词条进了效率链 —— 那会重建道果那个回路：" + bad.join("、")).toEqual([]);
  });

  it("③ 反差：没写 mods 的命题仍然只有宿慧", () => {
    /*
     * 这一条守的是①的边界 —— 不许给十七条命题每一条都塞词条。
     * 深修回报该是**少数几件了不起的事**，不是签到表。
     */
    const without = LIFE_THEMES.filter(
      (t) => (t as unknown as { mods?: Record<string, number> }).mods === undefined,
    );
    expect(without.length, "每一条命题都给词条 —— 那它就不是「了不起的事」了").toBeGreaterThan(
      LIFE_THEMES.length / 2,
    );
  });
});
