/**
 * 增益详情 —— 一种状态一片天,而弹窗只有一枚 17px 图标。
 *
 * ## 现状
 *
 * 点开身上任何一个状态(丹效 / 天赐 / 伤势),`BuffDialog` 报名、类、说明、
 * 逐条效果与「现效合计」。180 行模板里一个 `<svg>` 都没有 ——
 * 三种状态的区别只有那枚 17px 图标与几个数。
 *
 * ## 身份是现成的,而且比「类别」细
 *
 * 每个 `BuffDef` 都带 `icon`(`src/data/buffs.ts` 里 35 种状态用了 17 种图标)。
 * 按图标取景比按 `kind` 取景细得多 —— 而 `ICON_TERRAIN` 这张表本来就存在
 * (地界与事件一直在用它),只是缺了六个图标:`wind` / `moon` / `footprints` /
 * `ghost` / `sun` / `paw`。
 *
 * 故这一轮先把那六个补进 `ICON_TERRAIN`(补完之后,凡按图标取景的地方都受益,
 * 不只有这个弹窗),再让弹窗按 `def.icon` 走 `sceneTerrainOfPlace`。
 *
 * ## 判据守什么
 *
 *   一 三十五态全都能取到景,且**至少用上八种**地形(一态一景不是要求,八种是);
 *   二 取景读**这一态**(`def.icon`),不是玩家脚下那片地;
 *   三 画不占布局:这一窗是名、说明、逐条效果与合计。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { BUFFS } from "@/data/buffs";
import { SCENE_TERRAINS, sceneTerrainOfPlace, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/cultivation/BuffDialog.vue";

describe("增益详情 · 这一态长什么样", () => {
  it("三十五态全都能取到景,且至少铺开八种地形", () => {
    const seen = new Set<SceneTerrain>();
    for (const b of BUFFS) {
      const terrain = sceneTerrainOfPlace({ icon: b.icon });
      expect(SCENE_TERRAINS, `${b.name} 落到一个不存在的地形`).toContain(terrain);
      seen.add(terrain);
    }
    expect(
      seen.size,
      `三十五态只落在 ${seen.size} 种地形上 —— 至少该有八种`,
    ).toBeGreaterThanOrEqual(8);
  });

  it("六个新图标都认得出 —— 不许默默落到兜底山岳", () => {
    /*
     * 补这六个之前,它们全落 `peaks`(兜底)。判据逐个点名,而不是靠
     * 「地形数够」间接验 —— 间接验的话,少补一个也看不出来。
     */
    const NEW_ICONS: Array<[string, SceneTerrain]> = [
      ["wind", "sky"],
      ["moon", "frost"],
      ["footprints", "forest"],
      ["ghost", "void"],
      ["sun", "palace"],
      ["paw", "water"],
    ];
    for (const [icon, want] of NEW_ICONS) {
      expect(sceneTerrainOfPlace({ icon }), `${icon} 还没接上`).toBe(want);
    }
  });

  it("弹窗真接上了画,且按这一态取景", () => {
    const src = readSource(DLG);
    expect(src, "增益详情仍是纯文字 —— 180 行模板里一个 svg 都没有").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfPlace\(\{([^}]*)\}\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    /*
     * 必须读到 `def.icon` 本身 —— 只查「有没有 icon 这个词」不够:
     * 写成一个常数(如 `{ icon: null }`)也能过(实测漏掉的就是这一种)。
     */
    expect(call, "取景要读这一态的图标").toMatch(/def\.icon/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局", () => {
    const src = readSource(DLG);
    const css = readSource("src/styles/pages/cultivation.css");
    const rule =
      (src.match(/\.buff-detail__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.buff-detail__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .buff-detail__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
