/**
 * 行军一指(gateRuleSummary)—— 八门 CombatRules 摊成一行,与结算同源
 *
 * 每个门都带一份真实生效的 CombatRules,但选门/图鉴界面一度只给定性 desc。此处
 * 锁:① 具体门的数值串正确;② 任何生效字段都要有一行(漏一个字段就是又在藏数值)。
 */
import { describe, it, expect } from "vite-plus/test";
import { GATES } from "@/data/qimen";
import { gateRuleSummary } from "./gateRuleText";

describe("行军一指 · 八门数值摊开", () => {
  it("按门对齐结算派生串(休/生/伤/杜)", () => {
    expect(gateRuleSummary(GATES.find((g) => g.id === "xiu")!.rules)).toBe(
      "每 3 回合 · 回 6% 气血 · 敌方攻势 +5%",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "sheng")!.rules)).toBe(
      "攻势 -5% · 治疗 +40%",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "shang")!.rules)).toBe(
      "攻势 +15% · 以 85% 气血开战",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "du")!.rules)).toBe(
      "攻势 -10% · 敌方攻势 -10%",
    );
  });

  it("按门对齐结算派生串(景/死/惊/开)", () => {
    expect(gateRuleSummary(GATES.find((g) => g.id === "jing9")!.rules)).toBe(
      "敌方气血 +8% · 额外 暴击率 +8%",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "si")!.rules)).toBe(
      "攻势 +25% · 敌方攻势 +20% · 敌方气血 +15% · 回合上限 20",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "jing7")!.rules)).toBe(
      "攻势 +20% · 回合上限 15",
    );
    expect(gateRuleSummary(GATES.find((g) => g.id === "kai")!.rules)).toBe(
      "敌方攻势 -5% · 治疗 +25%",
    );
  });

  it("每个生效字段都要落到文案,不许漏藏数值", () => {
    for (const g of GATES) {
      const summary = gateRuleSummary(g.rules);
      expect(summary.length).toBeGreaterThan(0);
      // 逐个生效字段都在摘要里出现对应数值片段
      if (g.rules.playerAtkMult != null && g.rules.playerAtkMult !== 1)
        expect(summary).toContain("攻势");
      if (g.rules.enemyAtkMult != null && g.rules.enemyAtkMult !== 1)
        expect(summary).toContain("敌方攻势");
      if (g.rules.enemyHpMult != null && g.rules.enemyHpMult !== 1)
        expect(summary).toContain("敌方气血");
      if (g.rules.healMult != null && g.rules.healMult !== 1) expect(summary).toContain("治疗");
      if (g.rules.playerStartHpPct != null) expect(summary).toContain("气血开战");
      if (g.rules.maxRounds != null) expect(summary).toContain("回合上限");
    }
  });

  it("无生效字段返回空串(防御:不给空白凑行)", () => {
    expect(gateRuleSummary({})).toBe("");
    expect(gateRuleSummary({ playerAtkMult: 1, healMult: 1 }) as string).toBe("");
  });
});
