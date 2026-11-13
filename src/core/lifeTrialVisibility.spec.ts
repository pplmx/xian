/**
 * 逆旅契在身,历练页得说一声 —— 它正悄悄改着每一场战斗。
 *
 * ## 由来（第 162 轮，从「可玩性」这一侧看）
 *
 * 逆旅契是道果的**第一个非效率出口**（见 `data/lifeTrials` 文件头）：花道果押一份
 * 只加难度的契，本世历练全程生效。立意很清楚 —— 它换的不是属性，是「这一世确实
 * 与众不同，且它被记住了」。
 *
 * 而它在界面上只出现在两个地方:
 *
 * - 立契的那个弹窗（`RebirthDialog` 的「逆旅契」）；
 * - 转世时那一屏（「此生已立〈契名〉」）。
 *
 * 也就是说，**它生效的每一场历练，一个字都不说它存在。** 实测：
 *
 * ```text
 * 存档：trial = tr_ni（逆锋契:敌人攻击 +30%、生命 +20%），灵石道果齐备
 * 打开历练页 → 整页 DOM 里没有「逆旅」二字
 * ```
 *
 * ## 为什么这算缺陷,而不是「没说也照打」
 *
 * 本仓的决策信息纪律：给决策前把**代价、生效时长、成功率**摊开。而一份正在生效的
 * 逆境规则，正是玩家每场战斗都要承受的代价 —— 他不在历练页看到，就只会在战报里
 * 看到「打不过」，然后把账算在别处（装备不够、境界不够）。
 *
 * 别处都做了：道途有 `ruleText`（`ExpeditionPanel` 逐条印）、试炼有 `ruleText`
 * （`TrialPanel`）、道途秘境有 `ruleText`、本世契在**立契那一刻**也有。缺的正是
 * 「生效现场」那一处。
 *
 * ## 判据
 *
 * ① 签了契时，历练页要报出契名与它加的难度（不是只报「有契在身」）；
 * ② 没签契时一个字都不出（免得变成常驻噪音）；
 * ③ 文案读 `LifeTrialDef.ruleText`，不许在视图里另写一份。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { LIFE_TRIALS, lifeTrialDef } from "@/data/lifeTrials";

const ADV = readSource("src/views/AdventureView.vue");

describe("逆旅契 · 生效现场要说一声", () => {
  it("每一份契都带得出玩家看得懂的规则文案", () => {
    for (const t of LIFE_TRIALS) {
      expect(t.ruleText.length, `${t.name} 没有规则文案`).toBeGreaterThan(0);
      expect(t.ruleText, `${t.name} 的文案模板没换`).not.toContain("{");
    }
  });

  it("契确实改的是战斗 —— 不是一句风味话", () => {
    // 逆锋契:敌人攻击与生命都真的进了 CombatRules
    const ni = lifeTrialDef("tr_ni")!;
    expect(ni.rules.enemyAtkMult).toBeGreaterThan(1);
    expect(ni.rules.enemyHpMult).toBeGreaterThan(1);
    // 残躯契:开局气血真的压到 70%
    expect(lifeTrialDef("tr_can")!.rules.playerStartHpPct).toBeLessThan(1);
  });

  it("历练页在签了契时要报出契名与规则", () => {
    /*
     * 判的是那件事：历练页读 `activeLifeTrial()`（或等价的同一份来源），
     * 并在有契时把 `ruleText` 印出来。
     */
    expect(ADV, "历练页要读本世逆旅契").toMatch(/activeLifeTrial|lifeTrialDef|lifeTrialRules/);
    expect(ADV, "要把契的规则文案印出来").toMatch(/ruleText/);
  });

  it("没签契时不许留一行空话", () => {
    /*
     * 条件渲染：无契时整行不出（否则每天开页都多一句「本世未立契」的噪音）。
     * 判那件事 —— 承载那一行的元素带 `v-if`，且条件就是「有没有契」。
     */
    const block = /<div[^>]*data-life-trial-hint[^>]*>/.exec(ADV)?.[0] ?? "";
    expect(block, "找不到承载这一行的元素").not.toBe("");
    expect(block, "没有 v-if 就会常驻").toMatch(/v-if=/);
    expect(block, "条件该是「有没有契」").toMatch(/v-if="\s*activeTrial\s*"/);
  });
});
