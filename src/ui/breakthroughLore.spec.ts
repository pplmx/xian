/**
 * 大境突破那一刻 —— 该读到跨进去的那一重天的来历。
 *
 * ## 缺口:最该被击中的一刻,只有四个字
 *
 * 修行页、界域志都显示着每个境界的 `lore`:
 *
 * ```text
 * 真仙  承渡劫。《钟吕传道集》分仙为五等,天仙之上为真仙;飞升入天,与道同存。
 * ```
 *
 * 而**跨进这一境的那一刻** —— `BreakthroughResultDialog` 的大境分支 —— 只写着:
 *
 * ```text
 * 跨入真仙
 *   大 境
 * 真仙 → 玄仙      ← (这里其实是境界名与层数的迁移)
 * ```
 *
 * 玩家隔着天劫挣到过一道门,弹窗却只报了门的名字。
 *
 * ## 为什么这一处值得补
 *
 * 大境突破是这一作**最重的一次里程碑**:一境一次,要渡天劫,前面九层小推进都只是
 * 节拍器(见 `docs/design.md` 的「大境突破:印里该是跨过的那道门」)。那一屏已经把
 * 「印」和「大境」章都做好了 —— 唯独没有把那一境**是什么**说出来。
 *
 * 而 `lore` 这句话本来就是为这一刻写的:它讲这重天的来历与出处(承渡劫、分仙五等)。
 * 玩家在界域志里读到它,和在刚跨进去的一瞬间读到它,是两种完全不同的分量。
 *
 * ## 判据守什么
 *
 * 一条:`BreakthroughView` 要带 `toRealmLore`,且**由 core 从境界表取**,弹窗直接渲染。
 *
 * 「由 core 给」是既有纪律(`toRealmName` 的注释写着「弹窗不切 `toLabel` 的字符串、
 * 也不另 import 境界表 —— 那会与读数分成两本账」)。这条判据把同一个待遇也给到 lore。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const TYPES = "src/types/index.ts";
const CORE = "src/core/breakthrough.ts";
const DIALOG = "src/components/cultivation/BreakthroughResultDialog.vue";

describe("大境突破 · 要读到那一重天的来历", () => {
  it("BreakthroughView 带着 toRealmLore", () => {
    const src = readSource(TYPES);
    const iface = src.match(/export interface BreakthroughView \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface, "定位不到 BreakthroughView —— 判据会空转").not.toBe("");
    expect(iface, "BreakthroughView 还没有 toRealmLore —— 大境那一刻读不到那一境的来历").toContain(
      "toRealmLore",
    );
  });

  it("core 从境界表取,弹窗不自己 import 境界表", () => {
    const core = readSource(CORE);
    expect(core, "core 要把 lore 从境界表带进 view").toMatch(/toRealmLore:\s*.*\.lore/);
    // 弹窗不许自己查表 —— 与 toRealmName 同一条纪律
    const dialog = readSource(DIALOG).replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "弹窗不该自己 import 境界表(会与读数分成两本账)").not.toMatch(
      /from ["']@\/data\/realms["']/,
    );
  });

  it("弹窗在大境分支里真的把它念出来", () => {
    const dialog = readSource(DIALOG).replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "弹窗要把 toRealmLore 渲染出来").toContain("toRealmLore");
  });

  it("反空转:toRealmName 仍照常给(印面还要用)", () => {
    const core = readSource(CORE);
    expect(core, "toRealmName 不能因为加 lore 就丢了").toContain("toRealmName:");
  });
});
