/**
 * 「这一趟能走多远」的判据。
 *
 * 核心要守的不是算术，是**决策窗不许再只报产出、不报能不能拿到**:
 * 第 155 轮在真浏览器里量到，新号在青云山麓选「深入探寻」，单场胜率 0%，
 * 而窗上写着「整趟约装备 107 件」。这一份把两件事都钉住:
 *
 * ① 算术对（期望场次是等比数列、打满概率是 p^n、两个边界不吐 NaN）；
 * ② 读数挑对了档（打不过 / 走得完 / 多半走不完），且打不过那一档说得最直白。
 */
import { describe, expect, it } from "vite-plus/test";
import type { CombatantSnap } from "@/types";
import { gn } from "@/utils/gnum";
import { tripViability, tripViabilityText } from "./tripViability";

/**
 * 造两个极端快照 —— 强的必胜、弱的必败。
 *
 * 用真实 `resolveCombat` 而不是替身:这个模块的唯一价值就是「与真打同源」,
 * 把战斗换成假实现，判据就变成在自己算给自己看。
 */
function snap(power: number, isPlayer: boolean): CombatantSnap {
  return {
    name: isPlayer ? "试剑人" : "试刀鬼",
    icon: "user",
    isPlayer,
    attack: gn(12 * power),
    defense: gn(6 * power),
    maxHp: gn(300 * power),
    speed: 1,
    mods: {},
    skills: [{ name: "试招", mult: 1.4, rate: 0.3 }],
  };
}

const strong = snap(60, true);
const weak = snap(0.05, true);
const foe = snap(1, false);

describe("这一趟能走多远 · 算术", () => {
  it("单场必败 → 排到 1 场、赢 0 场、打满概率 0，且不吐 NaN", () => {
    const v = tripViability({ playerSnap: weak, foes: [foe], plannedBattles: 100 });
    expect(v.battleWinRate).toBe(0);
    /*
     * 注意这两个数**不一样**，而第一版把它们当成了一件事。
     *
     * 「期望场次」是等比求和 Σ p^(k−1)：p=0 时它等于 **1**（第一场总要开打，
     * 然后当场结束）。而掉落只在胜局结算，故「期望胜场」= p × 上式 = **0**。
     * 拿前者当乘子，就会印出「打不过，但整趟约能拿 N 件」—— 正是这一轮要修的那个谎。
     */
    expect(v.expectedBattles, "p=0 时仍会被排到第一场").toBe(1);
    expect(v.expectedWins, "但一场都赢不了 —— 产出乘子必须是它").toBe(0);
    expect(v.surviveChance).toBe(0);
    expect(v.retention).toBe(0);
  });

  it("单场必胜 → 打满全程，期望等于计划场次（不是 Infinity）", () => {
    // p === 1 时等比求和是 0/0，走极限那一支必须是 planned 而不是 NaN
    const v = tripViability({ playerSnap: strong, foes: [foe], plannedBattles: 120 });
    expect(v.battleWinRate).toBe(1);
    expect(v.expectedBattles).toBe(120);
    expect(v.surviveChance).toBe(1);
    expect(v.expectedWins).toBe(120);
    expect(v.retention).toBe(1);
    expect(Number.isFinite(v.expectedBattles), "必赢时不许算出 Infinity/NaN").toBe(true);
  });

  it("期望场次 = (1 − p^n) / (1 − p)，与 p^n 同一份 p", () => {
    /*
     * 用固定 p 反解:不toContain地抄公式，而是拿返回的 p 自己算一遍再比 ——
     * 这样实现若把 p^n 与期望里的指数写岔（一个用 n、一个用 n−1），会当场红。
     */
    const v = tripViability({ playerSnap: strong, foes: [foe], plannedBattles: 40 });
    const p = v.battleWinRate;
    const expected = p >= 1 ? 40 : (1 - Math.pow(p, 40)) / (1 - p);
    expect(v.expectedBattles).toBeCloseTo(Math.min(40, expected), 6);
    expect(v.surviveChance).toBeCloseTo(Math.pow(p, 40), 6);
  });

  it("计划 0 场时不说结论（不编一个 100% 或 0%）", () => {
    const v = tripViability({ playerSnap: strong, foes: [foe], plannedBattles: 0 });
    expect(v.expectedBattles).toBe(0);
    expect(tripViabilityText(v), "没有场次就没有结论").toBeNull();
  });

  it("取不到敌人快照时按「无法估计」处理，不印错的结论", () => {
    // 空敌群 = 调用方没有可用的本世路线内容。此时宁可当「打满」也不许印「必败」
    const v = tripViability({ playerSnap: weak, foes: [], plannedBattles: 50 });
    expect(v.battleWinRate, "没有敌可打时不该报 0% 胜率").toBe(1);
    expect(v.expectedBattles).toBe(50);
  });
});

describe("这一趟能走多远 · 读数", () => {
  it("打不过那一档说得最直白：一场都赢不了", () => {
    const v = tripViability({ playerSnap: weak, foes: [foe], plannedBattles: 247 });
    const text = tripViabilityText(v);
    // 档名不再进这句(它就在同一张卡的第一行),故这里不查档名、只查后果
    expect(text, "必败时要说出「会在第一场结束」").toContain("第一场结束");
    expect(text, "既然一场都赢不了，就不许再报「N/M 场」").not.toMatch(/\d+\/\d+ 场/);
  });

  it("走得完那一档报单场胜率与打满概率", () => {
    const v = tripViability({ playerSnap: strong, foes: [foe], plannedBattles: 124 });
    const text = tripViabilityText(v)!;
    expect(text).toContain("单场 100%");
    expect(text).toContain("打满全程");
  });

  it("多半走不完那一档把期望场次放在前面 —— 那一档的 surviveChance 只是噪音", () => {
    // 手工构造一档「能赢一点、但走不到一半」:p 由取样决定,故直接验分支口径
    const v = {
      battleWinRate: 0.5,
      bossWinRate: 0.5,
      plannedBattles: 247,
      expectedBattles: 4,
      expectedWins: 2,
      surviveChance: 0,
      retention: 2 / 247,
      blocker: "none" as const,
    };
    const text = tripViabilityText(v)!;
    expect(text).toContain("多半走不完");
    expect(text, "要报期望胜场，玩家才算得出这一档值不值").toContain("只赢 2/247 场");
  });
});

describe("这一趟能走多远 · 首领那一关", () => {
  /*
   * 这一组守的是本轮真正修掉的错：把首领按小怪的频率加权。
   *
   * 实测新号在青云山麓:小怪 98~100%、首领 0%。若把两者平均成一个 p，
   * 会印出「单场 96% · 预计只赢 23/124 场」—— 而真实结局是
   * 「攒到第 10 胜、撞上首领、当场结束」。
   */
  // 玩家打不过的首领：strong(60) 对它 0% —— 用比玩家强一个量级的数确保必败
  const boss = snap(2000, false);

  it("小怪全胜、首领必败 → 期望胜场停在首领之前，而不是按平均值外推", () => {
    const v = tripViability({
      playerSnap: strong,
      foes: [foe],
      boss,
      plannedBattles: 124,
    });
    expect(v.battleWinRate).toBe(1);
    expect(v.bossWinRate).toBe(0);
    // 第 10 场就是首领：前面 9 场全胜，第 10 场必败 → 期望胜场是 9
    expect(v.expectedWins, "期望胜场要停在首领之前那一场").toBeCloseTo(9, 6);
    expect(v.blocker, "要说得出卡在首领上").toBe("boss");
    expect(v.retention).toBeLessThan(0.1);
  });

  it("读数直接说「打不过此地之主」—— 不许用 96% 那种好看的数把它盖住", () => {
    const v = tripViability({ playerSnap: strong, foes: [foe], boss, plannedBattles: 124 });
    const text = tripViabilityText(v)!;
    expect(text).toContain("打不过此地之主");
    expect(text, "要说清断在第几胜").toContain("第 10 胜");
    expect(text, "这一档不许再报「约 N/124 场见彩」").not.toContain("见彩");
  });

  it("首领也打得过时才说「打满全程」", () => {
    const v = tripViability({
      playerSnap: strong,
      foes: [foe],
      boss: foe,
      plannedBattles: 124,
    });
    expect(v.bossWinRate).toBe(1);
    expect(v.surviveChance).toBe(1);
    expect(v.expectedWins).toBe(124);
    expect(tripViabilityText(v)).toContain("打满全程");
  });

  it("没给首领快照时退回只看小怪（不凭空造一个首领出来）", () => {
    const v = tripViability({ playerSnap: strong, foes: [foe], plannedBattles: 20 });
    expect(v.bossWinRate).toBeNull();
    expect(v.expectedWins).toBe(20);
  });
});
