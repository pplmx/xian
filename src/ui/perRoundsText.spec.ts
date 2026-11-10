/**
 * 「每隔 N 回合」那条规则的两侧读数 —— 只说代价不说收益,等于把净赚说成净亏。
 *
 * ## 缺口
 *
 * `CombatRules.perRounds` 是**双向**机制:每个周期玩家回血 + 给盾,敌人攻势也涨
 * (`core/combat` 的 `round % perRounds.interval === 0` 那一段,两件事写在同一块里)。
 * 而出发前「危局」那一行只报了涨的那一半。
 *
 * 实测它是**净赚**的:5 世界 × 6 构筑 × 30 局,带 `perRounds` 的净胜场 +10~+28
 * (触发数千次)。而界面上只说「敌人杀意渐涨」,玩家会以为带它吃亏 ——
 * 那正是道途/门选择时最容易做反的一类信息。
 *
 * ## 判据守什么
 *
 * 一 两侧都出:有回血/给盾就必须报出来,不能只有代价;
 * 二 顺序:先所得后代价(「越拖越强,但敌人也在变凶」是这条规则的真实形状);
 * 三 不替某一条道途起专名(「每印」只在长生道成立,奇门没有印);
 * 四 每次 + 的数值与规则同源(改 `enemyAtkGrowth` 文案跟着变);
 * 五 纯惩罚型不许编「越拖越强」——那时确实没有收益可说;
 * 六 源码层:core 里不许再自己拼这段文案(两本账)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { perRoundsLine } from "./perRoundsText";

/** 长生道的规则(deepText 写「每五回合得一印,恢复 4% 气血、凝 4% 护盾」) */
const LONGEVITY = {
  interval: 5,
  playerHealPct: 0.04,
  playerShieldPct: 0.04,
  enemyAtkGrowth: 0.06,
};
/** 奇门休门:`playerShieldPct` 为 0 */
const XIUMEN = { interval: 3, playerHealPct: 0.06, playerShieldPct: 0, enemyAtkGrowth: 0.05 };

describe("每隔 N 回合 · 两侧都要说", () => {
  it("有收益就必须报出来 —— 不能只有「敌人杀意渐涨」", () => {
    const line = perRoundsLine(LONGEVITY);
    expect(line, "该报回血").toContain("回 4% 气血");
    expect(line, "该报护盾").toContain("凝 4% 护盾");
    expect(line, "该报周期").toContain("每 5 回合");
    // 代价也要在,但不能是唯一那一句
    expect(line, "代价也要报").toContain("敌人攻势");
    expect(line, "不许退回只有代价的旧写法").not.toBe("每 5 回合敌人杀意渐涨,战局越晚越凶");
  });

  it("先所得、后代价 —— 「越拖越强,但敌人也在变凶」是它的真实形状", () => {
    const line = perRoundsLine(LONGEVITY);
    const gainAt = line.indexOf("越拖越强");
    const costAt = line.indexOf("敌人攻势");
    expect(gainAt, "收益那一半不见了").toBeGreaterThan(-1);
    expect(costAt, "代价那一半不见了").toBeGreaterThan(-1);
    expect(gainAt, "先报代价再报收益 —— 顺序反了,读起来像在劝阻").toBeLessThan(costAt);
  });

  it("不替某一条道途起专名:不许出现「每印」", () => {
    /*
     * 「印」是长生道的周期名(「每五回合得一印」)。奇门休门没有印的概念,
     * 同一条规则在两处共用,文案层不该挑一边的专名。
     */
    for (const rule of [LONGEVITY, XIUMEN]) {
      expect(perRoundsLine(rule), "「每印」只对长生道成立,别的来源读不通").not.toContain("印");
    }
  });

  it("数值与规则同源 —— 改一个数,文案跟着变", () => {
    const line = perRoundsLine({ ...LONGEVITY, enemyAtkGrowth: 0.12, interval: 7 });
    expect(line).toContain("每 7 回合");
    expect(line, "每周期涨幅该由 enemyAtkGrowth 现算").toContain("+12%");
    const hp = perRoundsLine({ ...LONGEVITY, playerHealPct: 0.09 });
    expect(hp).toContain("回 9% 气血");
  });

  it("奇门休门那一种:只有回血、没有护盾,不许编一行「凝 0% 护盾」", () => {
    const line = perRoundsLine(XIUMEN);
    expect(line).toContain("回 6% 气血");
    expect(line, "0% 的项不该出现 —— 那等于说了一件没发生的事").not.toContain("护盾");
    expect(line).toContain("每 3 回合");
  });

  it("纯惩罚型不许编「越拖越强」", () => {
    /*
     * 规则里确实可能只有代价(别的世界/变数将来会用这种形状)。
     * 那时说「越拖越强」就是撒谎 —— 收益那半根本不存在。
     */
    const pure = { interval: 4, playerHealPct: 0, playerShieldPct: 0, enemyAtkGrowth: 0.08 };
    const line = perRoundsLine(pure);
    expect(line).not.toContain("越拖越强");
    expect(line).toContain("每 4 回合");
    expect(line, "仍是原来那句代价说明").toContain("敌人杀意渐涨");
  });

  it("源码层:core 里不许再自己拼这段文案", () => {
    /*
     * 这段文案原先内联在 `core/expedition` 的 `riskLines` 里。
     * 留在那里就没法直接测,也容易与别处的同一段规则分叉。
     * 判据:core 必须调 `perRoundsLine`,且不许再出现那几个手拼的字样。
     */
    const raw = readFileSync(resolve(__dirname, "../core/expedition.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src, "core 该读 ui 层那一份").toContain("perRoundsLine(");
    expect(src, "core 里又自己拼了「越拖越强」").not.toContain("越拖越强");
    expect(src, "core 里又自己拼了「敌人攻势亦」").not.toContain("敌人攻势亦");
  });
});
