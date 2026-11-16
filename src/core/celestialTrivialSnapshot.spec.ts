/**
 * 终局三天「对某流派无挑战」——把现状钉住，而不是装作没有。
 *
 * ## 由来（第 426 / 427 轮）
 *
 * `celestialSim` 一直在打印这个，但**从来没有一条判据去断言它**：
 *
 * ```text
 *   赤炎天: 最佳  52%   可行 5
 *   星陨天: 100/100/100/24/0/4     ← 三个流派并列 100%，trivial
 *   万刃天: 100/100/100/8/64/0     ← 三个流派并列 100%，trivial
 *   无生天: 64/100/100/92/0/72     ← **只两族** ≥97%（连击流 92%），不算 trivial
 *   无相天: 最佳  92%
 * ```
 *
 * 于是「今日天道」的候选实际上少了两个界（它们会被 `verifyChallenge` 判为
 * 「此局形同虚设」而顺延）。这不是一条无害的读数 —— 它意味着**终局五分之二的高难内容
 * 对减伤续航流不构成挑战**。
 *
 * 口径上区分两件容易混的事:
 *
 * ```text
 *   best 100%        星陨天 / 万刃天 / 无生天 都有——「最强的那个流派能稳赢」
 *   ≥97% 三族        只有星陨天 / 万刃天     ——「有三族都能稳赢」，这才是 trivial
 * ```
 *
 * 无生天的连击流只有 92%，故 `best` 是 100 却不算 trivial —— 这一条曾被我自己
 * 的初版判据搞混（把三个 `best 100` 都当 trivial，红在「无生天只有 2 族」）。
 *
 * ## 为什么不修，而是钉住
 *
 * 第 426 轮试了八组参数，全部失败：
 *
 * ```text
 *   enemyAtkMult 1.3          → 52/100/96/0/64/0    罡盾仍 100
 *   enemyAtkMult 1.5          → 0/12/12/0/64/0      全面崩塌，可行 1
 *   maxRounds 24 + heal 0.6   → 96/0/92/8/0/0       可行 2
 *   healBetweenPct 0.2        → 100/100/32/0/64/0   反震降了，背水/罡盾仍 100
 *   加 pierce 技能（0.32~0.8） → 100/100/100/...     没有变化
 *   加 pierce + atkR 1.15     → 100/100/100/...     没有变化
 * ```
 *
 * **可行区间极窄:一端压不住,另一端全崩。** 而第 425 轮已经因为改终局数值被
 * `daoPathCoverage` 拦过一次（剑道 76 vs 基线 77）——往任何一个世界加一条玩家增益
 * 或减一条减伤，都会牵动七条道途的通过数。
 *
 * 故这一轮**不调参**。做的是把这个缺口从「打印里的一个警告」变成「判据里的一个事实」：
 * 一旦有人真的把它修好，下面的期望值会红，提醒改这里。
 *
 * ## 判据怎么才不吵
 *
 * 不要求「三天必须降到某个胜率」——那是一条会天天红的判据，而没人会去调它。
 * 只要求**现状与这张表一致**：
 *
 * ① 每个世界的「最佳流派通关率」落在表里记的那一档（容差 ±5pp）；
 * ② 表里标了 `trivial: true` 的那几天，确实是「三个及以上流派 ≥97%」；
 * ③ 反空转：五天都量到了，且至少有一天是 trivial（否则这张表该销账）。
 *
 * 这样它既能提醒「有人修好了」，又不会因为平衡微小漂移而天天吵。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { auditWorld } from "./celestialSim";

/**
 * 现状快照 —— **不是期望值，是实测值**。
 *
 * `trivial` 标的是「有三个及以上流派通关率 ≥97%」，那正是
 * `verifyChallenge` 判「形同虚设」的条件（`best > 0.97`）。
 */
const SNAPSHOT: Record<string, { best: number; viable: number; trivial: boolean }> = {
  chiyan: { best: 52, viable: 5, trivial: false },
  xingyun: { best: 100, viable: 3, trivial: true },
  wanren: { best: 100, viable: 4, trivial: true },
  /* 无生天只两族 ≥97%（连击流 92%），故不计入 trivial —— 精确口径见文件头 */
  wusheng: { best: 100, viable: 5, trivial: false },
  wuxiang: { best: 92, viable: 5, trivial: false },
};

/** 三个流派并列 100% 的那几天 —— 这里列出来，好让「修好了」有据可查 */
const TRIVIAL_WORLDS = ["xingyun", "wanren"];

describe("终局五天 · 对某流派无挑战的现状", () => {
  it("实测的最佳通关率与快照一致（±5pp）", () => {
    const rows = CELESTIAL_WORLDS.map((w) => {
      const audit = auditWorld(w, 60);
      const best = Math.round(Math.max(...audit.byStyle.map((s) => s.clearRate)) * 100);
      return { id: w.id, name: w.name, best };
    });
    const drift: string[] = [];
    for (const r of rows) {
      const want = SNAPSHOT[r.id];
      if (!want) {
        throw new Error(`${r.name} 不在快照里 —— 加了新世界要在这里登记`);
      }
      if (Math.abs(r.best - want.best) > 5) {
        drift.push(`${r.name}: 快照 ${want.best}% → 实测 ${r.best}%`);
      }
    }
    expect(
      drift,
      "这些世界的平衡变了 —— 若是有意调整，改这张表并写明理由；" +
        "若是无意，说明有人动了终局数值（那会牵动七条道途的通过数）:" +
        drift.join(" / "),
    ).toEqual([]);
  });

  it("标了 trivial 的那几天，确实是三个及以上流派 ≥97%", () => {
    for (const id of TRIVIAL_WORLDS) {
      const w = CELESTIAL_WORLDS.find((x) => x.id === id)!;
      const audit = auditWorld(w, 60);
      const nearPerfect = audit.byStyle.filter((s) => s.clearRate >= 0.97).length;
      expect(
        nearPerfect,
        `${w.name} 不再有三族 ≥97%（现在 ${nearPerfect} 族）—— 它可能已经修好了，` +
          "把这条快照与 `TRIVIAL_WORLDS` 一起更新",
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("反差：非 trivial 的那两天，不许有三个流派同时 ≥97%", () => {
    /*
     * 这条防的是「快照标错了」——若赤炎天其实也有三族稳赢，
     * 那 `trivial: false` 就是一句假话，而它是这张表的全部意义。
     */
    for (const [id, want] of Object.entries(SNAPSHOT)) {
      if (want.trivial) continue;
      const w = CELESTIAL_WORLDS.find((x) => x.id === id)!;
      const audit = auditWorld(w, 60);
      const nearPerfect = audit.byStyle.filter((s) => s.clearRate >= 0.97).length;
      expect(
        nearPerfect,
        `${w.name} 标着「不是形同虚设」，却有 ${nearPerfect} 族 ≥97% —— ` +
          "快照标错了，或者它悄悄变成了 trivial",
      ).toBeLessThan(3);
    }
  });

  it("反空转：五天都量到了，且确实至少有一天 trivial", () => {
    expect(CELESTIAL_WORLDS.length, "终局世界太少").toBeGreaterThanOrEqual(5);
    expect(
      TRIVIAL_WORLDS.length,
      "一天都不 trivial —— 这个缺口已经不存在了，把本文件删掉（它不常驻）",
    ).toBeGreaterThan(0);
    for (const id of TRIVIAL_WORLDS) {
      expect(
        CELESTIAL_WORLDS.some((w) => w.id === id),
        `快照里的 ${id} 已经不在 CELESTIAL_WORLDS 里了 —— 该销账`,
      ).toBe(true);
    }
  });
});
