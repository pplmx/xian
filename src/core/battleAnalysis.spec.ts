import { describe, expect, it } from "vite-plus/test";
import type { CombatResult, CombatSideStats } from "@/types";
import { gn, gnZero } from "@/utils/gnum";
import { analyzeBattle, battleDataRows } from "./battleAnalysis";

function stats(partial: Partial<CombatSideStats>): CombatSideStats {
  return {
    dealt: gn(1000),
    taken: gn(2000),
    pierceTaken: gnZero(),
    biggestHitTaken: gn(100),
    healed: gnZero(),
    shieldAbsorbed: gnZero(),
    dodges: 0,
    missedHits: 0,
    hitsLanded: 20,
    counters: 0,
    combos: 0,
    crits: 2,
    skillCasts: 3,
    artifactProcs: 1,
    stunnedTurns: 0,
    ...partial,
  };
}

function result(win: boolean, player: CombatSideStats, rounds = 20): CombatResult {
  return { win, rounds, playerHpPct: win ? 0.6 : 0, log: [], stats: { player, enemy: stats({}) } };
}

describe("战斗分析", () => {
  it("无遥测的旧战报返回 null(向后兼容)", () => {
    expect(analyzeBattle({ win: false, rounds: 10, playerHpPct: 0, log: [] }, null)).toBeNull();
  });

  it("胜利不找茬 —— 不指责、也不劝你换打法", () => {
    /*
     * 这条原本断言 `findings.length === 0`,写的是当时「胜利不做归因」的实现。
     * 那个实现留下了缺口:界面早就铺好了 findings / directions 两段渲染,
     * 胜利时却永远是空的 —— 玩家赢了只看到一句「此战 N 回合而胜」,
     * 而赢了正是最该学到东西的一刻(战败时玩家自己会去翻原因,胜利时没这个动机)。
     *
     * 故胜利现在**会**给归因,但约束没变、而且更清楚了:
     *   · 不指责:不出现「落空」「乏力」「不是办法」这类败局措辞;
     *   · 不劝换:方向建议只属于败局 —— 硬推一条等于劝玩家换掉刚赢下来的打法;
     *   · 数据行照旧要够(那是归因的依据)。
     * 这条夹具的读数很平(气血 0.6 / 20 回合 / 无闪避无暴击),归因不会凭空多出来。
     */
    const a = analyzeBattle(result(true, stats({})), "gangdun")!;
    expect(a.directions.length, "胜局不给方向建议").toBe(0);
    expect(a.dataRows.length).toBeGreaterThan(5);
    const joined = a.findings.map((f) => f.text).join(" | ");
    for (const blame of ["落空", "乏力", "不是办法", "无以为继", "难以衔接"]) {
      expect(joined, `胜局归因里出现了败局措辞(«${blame}»)—— 赢了不找茬`).not.toContain(blame);
    }
  });

  it("真伤致败被点名,并指向不依赖护盾的方向", () => {
    const a = analyzeBattle(result(false, stats({ pierceTaken: gn(1200) })), "gangdun")!;
    expect(a.findings.some((f) => f.text.includes("真伤"))).toBe(true);
    // 方向不包含当前流派
    expect(a.directions.every((d) => d.styleName !== "罡盾流")).toBe(true);
    expect(a.directions.length).toBeGreaterThan(0);
  });

  it("高落空率触发命中告警", () => {
    const a = analyzeBattle(result(false, stats({ missedHits: 12, hitsLanded: 18 })), "lianji")!;
    expect(a.findings.some((f) => f.text.includes("落空"))).toBe(true);
  });

  it("重锤一击与久战乏力都能识别", () => {
    const big = analyzeBattle(result(false, stats({ biggestHitTaken: gn(900) })), null)!;
    expect(big.findings.some((f) => f.text.includes("重击"))).toBe(true);
    const long = analyzeBattle(result(false, stats({}), 40), null)!;
    expect(long.findings.some((f) => f.text.includes("回合"))).toBe(true);
  });

  it("无明显短板时给出兜底解释", () => {
    const a = analyzeBattle(result(false, stats({ healed: gn(600) }), 10), null)!;
    expect(a.findings.length).toBe(1);
    expect(a.findings[0]!.text.includes("道行")).toBe(true);
  });

  it("数据面板行完整", () => {
    const rows = battleDataRows(result(true, stats({})));
    expect(rows.map((r) => r.label)).toContain("真伤承伤占比");
    expect(rows.map((r) => r.label)).toContain("护盾吸收");
  });

  /**
   * 先手判定是一条阈值,不是连续收益。
   *
   * 从前词条写「出手速度提升 6%」,玩家自然会以为多打一点就多赚一点;真相是
   * 差一点就完全没有。故战后分析要把**两个数与差额**摆出来:既解释「你为什么后手」,
   * 也给出「再凑几个百分点能跨线」——解释原因、给方向,不替玩家做决定。
   */
  describe("先手判定", () => {
    const withFirst = (
      win: boolean,
      playerFirst: boolean,
      ps: number,
      es: number,
    ): CombatResult => ({
      ...result(win, stats({})),
      firstMove: { playerFirst, playerSpeed: ps, enemySpeed: es },
    });

    it("数据行用两个数说话(不再让人对着百分比猜)", () => {
      const rows = battleDataRows(withFirst(true, true, 1.06, 1.05));
      const row = rows.find((r) => r.label === "先手");
      expect(row, "战报里应当有一行先手读数").toBeDefined();
      expect(row!.value).toContain("1.06");
      expect(row!.value).toContain("1.05");
      expect(row!.value).toContain("抢先");
    });

    it("被抢先时给出「还差多少」,而不是笼统说速度不够", () => {
      const a = analyzeBattle(withFirst(false, false, 1.02, 1.1), null)!;
      const hit = a.findings.find((f) => f.text.includes("先手判定"));
      expect(hit, "被抢先应当被点名").toBeDefined();
      expect(hit!.text).toContain("8%");
      expect(hit!.text, "要说清这是一条阈值").toContain("阈值");
    });

    it("抢到了就不唠叨:胜利时不给先手告警", () => {
      const a = analyzeBattle(withFirst(true, true, 1.2, 1.05), null)!;
      expect(a.findings.some((f) => f.text.includes("先手判定"))).toBe(false);
    });

    it("旧战报(没有 firstMove)照常工作", () => {
      const rows = battleDataRows(result(true, stats({})));
      expect(rows.some((r) => r.label === "先手")).toBe(false);
      expect(analyzeBattle(result(false, stats({})), null)).not.toBeNull();
    });
  });
});
