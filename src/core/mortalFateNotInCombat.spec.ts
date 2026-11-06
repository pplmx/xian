/**
 * 「此世命数只参与成形时的难度校准,不改写历练里的战斗」—— 这句话要有代码守着。
 *
 * ## 现状:文案有判据,实现没有
 *
 * `uiLayering.spec` 里有一条:
 *
 * ```ts
 * expect(mw?.src, "要明说它不改写战斗,免得玩家以为真被降能").toContain("不改写历练里的战斗");
 * ```
 *
 * 它守的是**这句话在不在**。而这句话对不对,没有任何判据在管。
 *
 * ## 为什么它需要被守住
 *
 * 这句话是有来历的:凡界世界里每个 `mortalWorld` 都带一份 `rules: CombatRules`,
 * 而那份规则**真的**在生成器里被用过 —— `mortalWorldGen` 用
 * `resolveCombat(..., w.rules)` 做新颖度与可玩性审计(「≥3 可行构筑、无接近必胜」)。
 *
 * 也就是说:同一个 `w.rules`,**在生成器里生效、在历练里不生效**。这个区别很容易被
 * 后来的人抹平 —— 谁要是顺手把 `explorationRules()` 改成合并 `w.rules`(看起来
 * 更"一致"),那句话当场变成假话,而 `uiLayering` 那条判据仍然全绿。
 *
 * 而玩家读到的承诺会变成谎言:他以为「破甲难防」只是世界成形时校准难度用的,
 * 实际每场战斗敌人都多 30% 破防。
 *
 * ## 判据守什么
 *
 * 一条:历练战斗取规则只走 `explorationRules()`,不许把 `mortalWorld.rules` 并进去。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const EXPLORE = "src/core/exploration.ts";

function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("凡界命数 · 不改写历练战斗这句话要成立", () => {
  it("历练的 resolveCombat 只吃 explorationRules()", () => {
    const src = strip(readSource(EXPLORE));
    // 找实际战斗那一处
    const call = src.match(/resolveCombat\([^;]{0,200}\);/)?.[0] ?? "";
    expect(call, "定位不到历练里的 resolveCombat —— 判据会空转").not.toBe("");
    expect(call, "历练战斗要走 explorationRules").toContain("explorationRules()");
    expect(
      call,
      "历练战斗把 mortalWorld.rules 并进去了 —— 那句「不改写历练里的战斗」就成了假话",
    ).not.toMatch(/mortalWorld|\.rules\b/);
  });

  it("explorationRules 自身不去读 mortalWorld", () => {
    const src = strip(readSource(EXPLORE));
    const fn = src.match(/export function explorationRules\(\)[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn, "定位不到 explorationRules —— 判据会空转").not.toBe("");
    expect(fn, "explorationRules 不许去读 mortalWorld").not.toMatch(/mortalWorld/);
  });

  it("反空转:文案那句仍在(措辞可改,意思不能丢)", () => {
    const view = readSource("src/views/MortalWorldView.vue");
    expect(view, "那句澄清要在 —— 玩家会以为命数真把自己降能了").toContain("不改写历练里的战斗");
  });
});
