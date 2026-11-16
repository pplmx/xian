/**
 * 界面那句「起手两道最重 / 逐道加重」，与波形数据对得上吗？
 *
 * ## 由来（第 441 轮）
 *
 * `TribulationPanel` 在给出 `min–max` 区间的同时，还附一句定性的形状描述：
 *
 * ```text
 *   共 8 道，单波 32%–56% 最大气血（合计约 …），逐道加重
 *   共 8 道，单波 49%–40% 最大气血（合计约 …），起手两道最重
 * ```
 *
 * 那句话来自 `plan.def.waveShape === "frontLoaded" ? A : B` —— 一个二元分支。
 * 而 `TribulationWaveShape` 当前只有两个成员，故它**恰好**对得上。
 *
 * ## 这条判据守的是什么
 *
 * 不是「三元表达式写错了吗」（此刻它是对的），而是**那句话算不算数**：
 * 用真实的 `tribulationWaveSpan` 算出每一劫的波形，再核那句话：
 *
 * ```text
 *   说「逐道加重」的  → last 必须 > first
 *   说「起手两道最重」→ 最重那一道必须在第 1 或第 2 道
 * ```
 *
 * ## 为什么值得写
 *
 * 三元表达式是**形状**判断，而这个 spec 量的是**数值**。两者一旦分叉
 * （比如有人给 `even` 加了递减、或给 `frontLoaded` 改了段长），
 * 界面上那句话会静默变成假话，而编译、类型、既有单测全绿。
 *
 * 这也正是 `TribulationWaveShape` 加第三个成员时唯一会红的地方 —— 那时
 * 三元表达式会把新成员归进「逐道加重」，而这条会指出它并不逐道加重。
 */
import { describe, expect, it } from "vite-plus/test";
import { TRIBULATIONS } from "@/data/tribulations";
import { tribulationWaveSpan } from "@/core/tribulationDecision";

/** 界面那句定性的形状描述 —— 与 TribulationPanel 的三元表达式同一条判据 */
function shapeText(waveShape: string): string {
  return waveShape === "frontLoaded" ? "起手两道最重" : "逐道加重";
}

describe("劫型波形 · 那句话算不算数", () => {
  it("每一劫都能被这句话说中", () => {
    const wrong: string[] = [];
    for (const def of TRIBULATIONS) {
      // 取一个有代表性的境界：道数够多，形状才看得出来
      const span = tribulationWaveSpan(def, 5);
      const text = shapeText(def.waveShape);
      if (text === "逐道加重" && !(span.last > span.first)) {
        wrong.push(`${def.name}: 说「逐道加重」，而末道 ${span.last} 不重于首道 ${span.first}`);
      }
      if (text === "起手两道最重" && span.heaviestWave > 2) {
        wrong.push(`${def.name}: 说「起手两道最重」，而最重的是第 ${span.heaviestWave} 道`);
      }
    }
    expect(wrong, "界面那句话与波形数据对不上:" + wrong.join("；")).toEqual([]);
  });

  it("反差：两种形状确实不同 —— 否则那句话无论怎么写都对", () => {
    /*
     * 若所有劫型的波形都一样，「逐道加重 / 起手两道最重」就成了装饰。
     * 这条钉住：至少有一劫末道更重、至少有一劫前二更重。
     */
    const spans = TRIBULATIONS.map((d) => ({ def: d, span: tribulationWaveSpan(d, 5) }));
    expect(
      spans.some((s) => s.span.last > s.span.first),
      "没有任何一劫是逐道加重的 —— 那句话没有所指",
    ).toBe(true);
    expect(
      spans.some((s) => s.span.heaviestWave <= 2),
      "没有任何一劫是起手最重的 —— 那句话没有所指",
    ).toBe(true);
  });

  it("边界：加第三种波形时，这条会红并指出它不在那两句之内", () => {
    /*
     * `TribulationWaveShape` 是联合类型 —— 加成员时 vue-tsc 不会报错
     * （三元表达式对任何 string 都有分支）。故这里显式列举当前成员，
     * 让「加了第三种」变成一次**必须做的决定**。
     */
    const KNOWN = new Set(["even", "frontLoaded"]);
    const unknown = TRIBULATIONS.map((d) => d.waveShape).filter((s) => !KNOWN.has(s));
    expect(
      unknown,
      "出现未登记的波形形状 —— 界面那句三元表达式会把它归进「逐道加重」，请先决定它该怎么说:" +
        [...new Set(unknown)].join(" / "),
    ).toEqual([]);
  });
});
