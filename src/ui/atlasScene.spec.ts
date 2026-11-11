/**
 * 玄枢图 —— 五卷各自去哪,而五枚签长得一样。
 *
 * ## 现状
 *
 * 玄枢图是全站的册目(`NavigationAtlas`):五卷快引排成一排(修行 / 道场 / 行旅 /
 * 身外 / 天机),下面按卷铺册目、搜索框与结果。489 行模板里一个 `<svg>` 都没有 ——
 * 五卷签的区别只有编号与那几个字。
 *
 * ## 身份是现成的
 *
 * `ui/navigation` 的 `NAVIGATION_SECTIONS` 就是那五卷,每一卷自己还带着一句
 * `hint`(「此刻的道躯与修为」「家业、人事与周转」「山河、地界与所往」
 * 「器、药、魂与藏珍」「跨世的道途与选择」)—— 卷的去处本来就写着。
 *
 * 五卷落五种地形 —— 不对九种硬凑:五卷就是五卷,给不存在的第六卷编一种地形
 * 只是为了让数字好看。
 *
 * ## 判据守什么
 *
 *   一 五卷各一副长相(不许两卷共用);
 *   二 取景读**这一卷**(`group.id`),不是玩家脚下那片地;
 *   三 画不占布局:卷签是按钮,画占布局会把「N 册」挤走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { NAVIGATION_SECTIONS } from "@/ui/navigation";
import { SCENE_TERRAINS, sceneTerrainOfVolume, type SceneTerrain } from "@/ui/sceneTerrain";

const ATLAS = "src/components/common/NavigationAtlas.vue";

describe("玄枢图 · 这一卷去哪", () => {
  it("五卷各一副长相 —— 不许两卷共用", () => {
    expect(NAVIGATION_SECTIONS.length, "玄枢图该是五卷").toBe(5);
    const seen = new Map<SceneTerrain, string>();
    for (const group of NAVIGATION_SECTIONS) {
      const terrain = sceneTerrainOfVolume(group.id);
      expect(SCENE_TERRAINS, `${group.label} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${group.label} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, group.label);
    }
    expect(seen.size, "五卷该有五种不同的画").toBe(5);
  });

  it("认不出的卷落到山岳兜底", () => {
    expect(sceneTerrainOfVolume(null)).toBe("peaks");
    expect(sceneTerrainOfVolume("no-such-volume")).toBe("peaks");
  });

  it("玄枢图真接上了画,且按这一卷取景", () => {
    const src = readSource(ATLAS);
    expect(src, "玄枢图仍是纯文字 —— 489 行模板里一个 svg 都没有").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfVolume\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一卷").toMatch(/group/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在卷签里,且不占布局", () => {
    const src = readSource(ATLAS);
    const row =
      src.match(/v-for="\(group, groupIndex\) in NAVIGATION_SECTIONS"[\s\S]*?<\/button>/)?.[0] ??
      "";
    expect(row, "定位不到卷签那一条 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一枚卷签里").toContain("<InkScene");
    const css = readSource("src/style.css");
    const rule =
      (src.match(/\.atlas-volume__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.atlas-volume__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .atlas-volume__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
