/**
 * 限时机缘卷 —— 玩家只有几十秒,而那一屏只有字。
 *
 * ## 现状
 *
 * `OpportunityScroll` 是两件限时事的**共用外壳**:
 *
 *   顿悟(`kind="enlightenment"`)—— 修行页弹出的悟道契机
 *   洞府巡游(`kind="cave"`)     —— 洞府五处地点(灵田 / 丹炉 / 藏经阁 / 聚灵阵 / 灵兽园)
 *
 * 这一卷有一个倒计时在走、几签只能择一、选定即生效、其余随风而散 ——
 * 它做的**恰恰是一个来不及细读的决定**。而 421 行模板里一个 `<svg>` 都没有:
 * 卷首只有一枚楷体印(「悟」/「巡」),底下全是字。
 *
 * ## 为什么这一处该有画
 *
 * 一屏「限时 + 择一」的地方,玩家没有时间读长句 —— 画比字先到。
 * 而两件事的身份都很明确:顿悟是**修行**里的事,洞府巡游是**洞府某个地点**里的事。
 *
 * ## 判据守什么
 *
 *   一 两种缘起各有各的画,不许共用一张底(它们是两件不同的事);
 *   二 洞府那一路还要按**地点**分开 —— 灵田与丹炉不是一回事;
 *   三 画不占布局:这一卷的正文是选项与后果,画把它推下去就是灾难。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SCENE_TERRAINS, sceneTerrainOfOpportunity, type SceneTerrain } from "@/ui/sceneTerrain";

const SCROLL = "src/components/earlygame/OpportunityScroll.vue";

describe("限时机缘卷 · 一眼先看见是什么事", () => {
  it("两种缘起各有各的画", () => {
    const kind = (k: "enlightenment" | "cave"): SceneTerrain => sceneTerrainOfOpportunity(k, null);
    expect(SCENE_TERRAINS).toContain(kind("enlightenment"));
    expect(SCENE_TERRAINS).toContain(kind("cave"));
    expect(kind("enlightenment"), "顿悟与洞府巡游画成了同一片 —— 它们是两件不同的事").not.toBe(
      kind("cave"),
    );
  });

  it("洞府五处地点各有各的画 —— 灵田与丹炉不是一回事", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const loc of ["field", "furnace", "library", "array", "garden"]) {
      const terrain = sceneTerrainOfOpportunity("cave", loc);
      expect(SCENE_TERRAINS, `${loc} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `洞府的 ${loc} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, loc);
    }
    expect(seen.size, "五处地点该有五副长相").toBe(5);
  });

  it("认不出的缘起落到它自己那一档的兜底,不是空白", () => {
    /*
     * 这一卷**必须**有画:倒计时在走,玩家连字都来不及读全,
     * 画是唯一一眼能认的东西。故两条兜底都落在各自那一档,
     * 而不是留白(与道侣那条回 null 不同 —— 那里空表是一个答案)。
     */
    expect(SCENE_TERRAINS).toContain(sceneTerrainOfOpportunity("enlightenment", "no-such-place"));
    expect(SCENE_TERRAINS).toContain(sceneTerrainOfOpportunity("cave", "no-such-place"));
    expect(sceneTerrainOfOpportunity("cave", "no-such-place")).toBe(
      sceneTerrainOfOpportunity("cave", null),
    );
  });

  it("卷上有画,且不占布局", () => {
    const src = readSource(SCROLL);
    expect(src, "限时机缘卷仍是纯文字 —— 一卷来不及细读的决定,只有字").toContain("<InkScene");
    /*
     * 取景要**真把地点传进去** —— 只写 `sceneTerrainOfOpportunity(kind, null)`
     * 也能过「函数名出现」那种弱判据,而那样五处地点全落同一个兜底,
     * 这一卷就只剩下「是洞府还是顿悟」两档。故钉的是调用里那个实参。
     */
    const call = src.match(/sceneTerrainOfOpportunity\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一卷的缘起").toContain("kind");
    expect(call, "取景要读洞府地点").toContain("place");
    /*
     * 画不占布局:这一卷的正文是几个选项与它们的后果,且倒计时在走 ——
     * 把画排进流里就会把选项推下去,而玩家可能只剩十几秒。
     */
    const rule = src.match(/\.opportunity-scroll__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .opportunity-scroll__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离布局").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
