/**
 * 丹药详情 —— 一味丹「做什么用」,而那一屏只有字与一枚图标。
 *
 * ## 现状
 *
 * 丹匣里点开一味丹,弹窗给出:品阶、品评、风味一句、`pillFuncText` 的效果、
 * 炼丹熟练度与服前提示。信息齐,但整屏的"画面"是**一枚 24px 的图标**,
 * 而图标只有八种(`flask` / `leaf` / `droplets` / `sparkles` / …)——
 * 75 味丹挤在八种图形上,一眼分不出这是修为丹还是寿元丹。
 *
 * ## 身份是现成的
 *
 * `PillDef.instant` 把每味丹**做什么**写成了结构化的数,不是散文:
 *
 *   expSecs / expFixed → 修为
 *   qiPct             → 灵气
 *   lifespanYears     → 寿元
 *   wudao             → 悟道
 *   buffId            → 增益(持续一段时间的状态)
 *
 * 这五类正是玩家在丹匣里扫读时的分类轴 —— 「我要一枚回气的」还是「我要一枚续命的」。
 * 界面上它只以一句散文化作效果行,图上一个字都没露。
 *
 * ## 判据守什么
 *
 *   一 五类药性各有各的画,不许共用一张底;
 *   二 取景读**这一味丹做什么**,不是玩家脚下那片地;
 *   三 画不占布局:这一窗正文是效果与服前提示,推下去就看不见了。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { PILLS } from "@/data/pills";
import { SCENE_TERRAINS, sceneTerrainOfPill, type SceneTerrain } from "@/ui/sceneTerrain";
import { pillEffectOf, type PillEffect } from "@/ui/itemText";

const VIEW = "src/views/InventoryView.vue";

describe("丹药详情 · 这一味丹做什么用", () => {
  it("五类药性各有各的画", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const fx of ["exp", "qi", "lifespan", "wudao", "buff"] as const) {
      const terrain = sceneTerrainOfPill(fx);
      expect(SCENE_TERRAINS, `${fx} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${fx} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, fx);
    }
    expect(seen.size, "五类药性该有五副长相").toBe(5);
  });

  it("每一味丹都分得到一类 —— 不许有一味落空", () => {
    /*
     * 75 味丹全部要在五类里各就各位。留一味分不到,那一味点开就是同一片兜底底 ——
     * 而这正是这一轮要修的事(八种图标已经够挤,再共用一片天等于没画)。
     *
     * 钉的是**分类结果**,不是「落到的地形种类够多」:兜底地形恰好等于其中一类
     * (修为=山岳),只数种类的话,把整类修为丹判成 null 也照样能过 ——
     * 而那时它们全部落在兜底上,玩家看到的是同一片山。
     */
    const counts = new Map<PillEffect, number>();
    for (const def of PILLS) {
      const fx = pillEffectOf(def);
      expect(fx, `「${def.name}」分不到任何一类 —— 点开只能看到兜底那片山`).not.toBeNull();
      expect(SCENE_TERRAINS, `${def.name} 落到一个不存在的地形`).toContain(sceneTerrainOfPill(fx));
      counts.set(fx!, (counts.get(fx!) ?? 0) + 1);
    }
    /*
     * 五类都得有人:某一类一味丹都没有,说明分类轴本身缺了一条
     * (而那一条的地形就永远画不出来)。
     */
    for (const fx of ["exp", "qi", "lifespan", "wudao", "buff"] as const) {
      expect(counts.get(fx), `五类里「${fx}」一味丹都没有 —— 那一副画永远画不出来`).toBeGreaterThan(
        0,
      );
    }
  });

  it("认不出的药性落到兜底,不是空白", () => {
    expect(SCENE_TERRAINS).toContain(sceneTerrainOfPill(null));
    expect(sceneTerrainOfPill("no-such-effect")).toBe(sceneTerrainOfPill(null));
  });

  it("丹匣那一屏真接上了画,且按这一味丹的药性取景", () => {
    const src = readSource(VIEW);
    expect(src, "丹药详情仍是纯文字 —— 整屏的画面是一枚 24px 图标").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfPill\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一味丹").toContain("currentPill");
    /*
     * 画不占布局:这一窗正文是效果、熟练度与服前提示,画推下去就看不见了。
     *
     * 样式在 `styles/pages/inventory.css` 而不是组件内 —— `InventoryView` 本身没有
     * style 块,全页的版面都收在那一个文件里。故判据从那一处读,不钉"必须写在组件里"。
     */
    const css = readSource("src/styles/pages/inventory.css");
    const rule = css.match(/\.pill-detail__scene\s*\{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(rule, "定位不到 .pill-detail__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离布局").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
