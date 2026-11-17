/**
 * 一张手写的覆盖表，说的是三年前的产品。
 *
 * ## 由来（第 505 轮）
 *
 * `trialMotivation.spec` 有一条用例叫「但历练、顺序、遭遇、目标四格一个都没碰到」，
 * 它断言 `untouchedAxes()` 包含 region / order / encounter / goal —— 并且一直是绿的。
 *
 * 而 `data/lifeTrials` 里早就有:
 *
 * ```text
 *   routeStages: 3          第 470 轮   本世只走三段          → region
 *   bannedItemKind: "artifact"  第 473 轮   本世禁用法宝      → build（另有规则面）
 *   reverseRoute: true      第 474 轮   本世路线倒着走        → order
 *   vowGoal: "…"            第 475 轮   本世目标换成那句话    → goal
 * ```
 *
 * 四个维度**全部**被触及了，而那份「四格一个都没碰到」的判据还在报绿。
 *
 * ## 为什么它会绿
 *
 * `AXIS_COVERAGE` 是一张**手写表**:
 *
 * ```ts
 * export const AXIS_COVERAGE = LIFE_TRIALS.map((t) => ({
 *   trialId: t.id,
 *   axes: ["build", "record", "node"],       // ← 写死,从不读 t 的那些字段
 *   …
 * }));
 * ```
 *
 * 它把每份契都记成「只动构筑」，于是无论数据层加了什么字段，覆盖表都不会变。
 *
 * > 这正是第 456 轮那条「清单型判据 vs 反向扫描」的第二次复发:
 * > **清单型判据守的是清单,反向扫描守的是产品。**
 *
 * ## 判据
 *
 * ① 覆盖表必须从 `LIFE_TRIALS` 的实际字段推出来，而不是手写;
 * ② 反差:规则的契仍只算 build（它们确实只改战斗怎么算）;
 * ③ 反差:`record` 与 `node` 是每份契都带的（履历一笔 + 立契这个决策点），不算错。
 */
import { describe, expect, it } from "vite-plus/test";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { AXIS_COVERAGE, touchedAxesOf } from "@/core/trialMotivation";
import type { DecisionAxis } from "@/core/trialMotivation";

describe("逆旅契 · 覆盖表必须说产品现在的话", () => {
  it("① 每一份契的覆盖维度，与它的实际字段对得上", () => {
    const wrong: string[] = [];
    for (const t of LIFE_TRIALS) {
      const actual = touchedAxesOf(t);
      const claimed = AXIS_COVERAGE.find((c) => c.trialId === t.id)?.axes ?? [];
      const missing = actual.filter((a) => !claimed.includes(a));
      if (missing.length) {
        wrong.push(`${t.name}: 实际动了 ${missing.join("/")}，而覆盖表没记`);
      }
    }
    expect(wrong, "覆盖表漏记了这些契真正动到的维度：" + wrong.join("；")).toEqual([]);
  });

  it("② 反差：只带 rules 的契仍只算 build", () => {
    /*
     * 这一条守的是①的边界 —— `rules` 改的是战斗怎么算，
     * 它确实只作用于 resolveCombat，不该被算成动了历练或目标。
     */
    const rulesOnly = LIFE_TRIALS.filter(
      (t) => t.rules && !t.routeStages && !t.reverseRoute && !t.vowGoal && !t.bannedItemKind,
    );
    expect(rulesOnly.length, "没有只带 rules 的契 —— 判据②的前提变了").toBeGreaterThan(0);
    for (const t of rulesOnly) {
      const extra = touchedAxesOf(t).filter((a) => a !== "record" && a !== "node");
      expect(extra, `${t.name} 只带 rules，却算动了别的维度`).toEqual(["build"]);
    }
  });

  it("③ 反差：record 与 node 是每份契都带的", () => {
    for (const t of LIFE_TRIALS) {
      const axes: DecisionAxis[] = touchedAxesOf(t);
      expect(axes, `${t.name} 少了 record`).toContain("record");
      expect(axes, `${t.name} 少了 node`).toContain("node");
    }
  });
});
