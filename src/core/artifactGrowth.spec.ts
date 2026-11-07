/* oxlint-disable no-console -- 增长表是给人复核的 */
/**
 * 法宝后期增长 —— 「越深的地界越强」不只要不回落,还得**真的更强**。
 *
 * ## 缺口:判据只守了「不回落」
 *
 * `artifactLadder.spec` 钉的是 `amount >= prev.amount - EPS` —— 阶梯不断即可。
 * 于是「半步不动」也合规:实测后期各族相邻档的增长率:
 *
 * ```text
 *   damage  t19→t22 +0.1% · t22→t23 +0.8% · t23→t26 +0.0%
 *           t26→t28 +0.2% · t28→t31 +0.3%
 *   heal    t20→t23 +0.1% · t28→t30 +0.1% · t30→t31 +0.0%
 *   shield  t23→t28 +2.1% · t29→t31 +0.6%
 * ```
 *
 * 低段是另一回事:t2→t5 +18%、t14→t18 +25%,台阶清清楚楚。**卡在 t19 之后**。
 *
 * ## 为什么这是问题
 *
 * 敌人按层级指数增长(`ENEMY_GEAR_GROWTH = 1.18`)。从 t19 到 t31 是十二层,
 * 敌方强度 ×1.18¹² ≈ **×7.3**;而同期最强的那件伤害法宝只从 6.319 涨到 6.411
 * —— +1.5%。玩家把法宝从「人间界那件」换成「混沌海那件」,面板几乎不动,
 * 可对面强了七倍。
 *
 * 这不是「法宝是第二来源」能解释的:第二来源可以**弱**,但不该**不再长**。
 * 文件头写的是「越深的地界越强」,那条主轴在后期断了。
 *
 * ## 封顶不是原因
 *
 * `ARTIFACT_WEAKEN_CAP` / `ARTIFACT_SUNDER_CAP` / `ARTIFACT_PURGE_CAP` /
 * `ARTIFACT_DRAIN_HEAL_CAP` 只作用于 weaken / sunder / purge / drain 的回补,
 * **damage / heal / shield 不在封顶之列** —— 那三族停在这里是基线没跟上,不是被截。
 *
 * ## 判据守什么
 *
 * 每个效果族内,按 fromTier 排序后**相邻两档的增长率不低于阈值**。
 * 阈值取 5%:低段实测 13%~25%,留足够余量;只拦「半步不动」那一种。
 */
import { describe, expect, it } from "vite-plus/test";
import { ARTIFACTS, artifactValue } from "@/data/artifacts";
import type { ArtifactEffect } from "@/types";

/** 相邻档的最低增长率 —— 低段实测 13%~25%,5% 只拦「几乎不动」 */
const MIN_GROWTH = 0.05;

/** 各族按 fromTier 排好后相邻两档的增长率 */
function growthGaps(type: ArtifactEffect["type"]) {
  const rows = ARTIFACTS.filter((a) => a.active.effect.type === type)
    .map((a) => ({ a, amount: artifactValue(a, 0).active.amount }))
    .sort((x, y) => x.a.fromTier - y.a.fromTier);
  const gaps: string[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    if (prev.amount <= 0) continue;
    const growth = cur.amount / prev.amount - 1;
    if (growth < MIN_GROWTH) {
      gaps.push(
        `t${prev.a.fromTier}「${prev.a.name}」${prev.amount.toFixed(2)} → ` +
          `t${cur.a.fromTier}「${cur.a.name}」${cur.amount.toFixed(2)}` +
          ` 只涨 ${(growth * 100).toFixed(1)}%`,
      );
    }
  }
  return gaps;
}

describe("法宝后期增长", () => {
  /** 三族不受封顶影响,必须有实打实的台阶 */
  for (const type of ["damage", "heal", "shield"] as const) {
    it(`${type} 族相邻档增长率不低于 ${MIN_GROWTH * 100}%`, () => {
      const gaps = growthGaps(type);
      expect(gaps, `${type} 族这些相邻档几乎不长 —— 玩家换到更高阶的法宝,面板却不动`).toEqual([]);
    });
  }

  it("报告各族增长(给人复核)", () => {
    for (const type of ["damage", "heal", "shield", "weaken", "drain"] as const) {
      const rows = ARTIFACTS.filter((a) => a.active.effect.type === type)
        .map((a) => ({ a, amount: artifactValue(a, 0).active.amount }))
        .sort((x, y) => x.a.fromTier - y.a.fromTier);
      if (rows.length < 2) continue;
      const first = rows[0]!.amount;
      const last = rows[rows.length - 1]!.amount;
      console.log(
        `  ${type.padEnd(8)} ${rows.length} 件 · t${rows[0]!.a.fromTier}~t${rows[rows.length - 1]!.a.fromTier}` +
          ` · ${first.toFixed(2)} → ${last.toFixed(2)}(全段 ×${(last / first).toFixed(2)})`,
      );
    }
    expect(true).toBe(true);
  });
});
