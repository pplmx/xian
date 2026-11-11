/**
 * 道痕 · 今昔之比 —— 「与过去的自己对话」,而对话里没有那个地方。
 *
 * ## 现状
 *
 * 天界「道痕」那一屏里有一块「今昔之比」:同一个天界世界,第 3 世打出什么、
 * 第 7 世又打出什么,一行 `→` 连着两个读数。这一段是全作少见的**回头看一眼**,
 * 而它整块只有字。
 *
 * ## 身份是现成的,只是没有交出来
 *
 * `legacyComparisons`(core/compare)内部按 `mark.targetId` 分组 —— 同一界对比同一界,
 * 而那个 id 正是 `sceneTerrainOfCelestial` 认的身份(赤炎天火域 / 星陨天星野 /
 * 万刃天遗迹 / 无生天雪原 / 无相天虚空)。
 *
 * 但 `LegacyComparison` 只交出了 `targetName`,**没交出 id** —— 于是界面拿不到
 * 取景所需的那一个值。故这一轮要把 id 补进那一条返回结构里:界面不自己按名字
 * 反查(id 才是身份,名字只是显示),与 `BreakthroughView.kind` 同一条纪律。
 *
 * ## 判据守什么
 *
 *   一 `LegacyComparison` 要带上 `targetId`;
 *   二 道痕那一屏真接上了画,且按**那一界**取景(不许十几条共用一张底);
 *   三 画不占布局:这一段夹在纪元读数与六十则履历之间。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const CORE = "src/core/compare.ts";
const PANEL = "src/components/celestial/MarksPanel.vue";

describe("道痕 · 今昔之比要有那个地方", () => {
  it("LegacyComparison 交出 targetId —— 名字只是显示,id 才是身份", () => {
    const src = readSource(CORE);
    const iface = src.match(/export interface LegacyComparison \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface, "定位不到 LegacyComparison —— 判据会空转").not.toBe("");
    expect(iface, "要交出 targetId").toContain("targetId");
    /*
     * 不许改成「界面拿 targetName 去反查」:名字是给人看的,改一次文案就断。
     * id 才是身份 —— 这一条与 `BreakthroughView.kind` 同一条纪律。
     *
     * 光声明不够:`targetId: string;` 那行声明也在源码里,只查它的话,
     * 把**赋值**删掉判据照样绿(实测第一次就是这样漏的)。故钉的是
     * 「构造那条返回结构时真的把它填进去了」。
     */
    /*
     * 构造那一批比对结果的那一段 —— core 是把每一条 `push` 进 `out` 的,
     * 故定位到那一处 push 的字面量,不是 `return`。
     */
    const push = src.match(/out\.push\(\{[\s\S]*?\}\)/)?.[0] ?? "";
    expect(push, "定位不到构造那一处 —— 判据会空转").not.toBe("");
    const filled = /targetName[\s\S]{0,80}targetId|targetId[\s\S]{0,80}targetName/.test(push);
    expect(filled, "只声明没填 —— 界面拿到的 targetId 会是 undefined,取景全落同一个兜底").toBe(
      true,
    );
  });

  it("道痕那一屏真接上了画,且按那一界取景", () => {
    const panel = readSource(PANEL);
    expect(panel, "今昔之比仍是纯文字 —— 整块只有一行 → 连着两个读数").toContain("<InkScene");
    const call = panel.match(/sceneTerrainOfCelestial\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读那一界").toMatch(/targetId/);
    /*
     * 画必须落在**那一条比对的循环里** —— 十几条今昔之比若共用一张底,
     * 这一块就还是同一片坡加几行字。
     */
    const loop = panel.match(/v-for="lc in legacy"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
    expect(loop, "定位不到今昔之比那一条的循环 —— 判据会空转").not.toBe("");
    expect(loop, "画要落在每一条比对里").toContain("<InkScene");
  });

  it("画不占布局", () => {
    const panel = readSource(PANEL);
    const css = readSource("src/styles/pages/celestial.css");
    const rule =
      (panel.match(/\.marks-compare__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "") ||
      (css.match(/\.marks-compare__scene\s*\{[\s\S]*?\n  \}/)?.[0] ?? "");
    expect(rule, "定位不到 .marks-compare__scene —— 判据会空转").not.toBe("");
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
    /*
     * 这一段夹在纪元读数与六十则履历之间,而那一屏本来就长 ——
     * 画只做底,不许把任何一行推下去。
     */
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
  });
});
