/**
 * 九柜藏珍 —— 九个柜屉各收一类物事,而柜面只有九枚单字印。
 *
 * ## 现状
 *
 * 藏珍页的「九柜藏珍」把收藏收成九只柜屉:器 / 功 / 悟 / 丹 / 材 / 宝 / 兽 / 闻 / 赋。
 * 每柜报收录数、缺口与新得,抽开才见条目。364 行模板里一个 `<svg>` 都没有 ——
 * 柜面上九只屉长得一样,区别只有那一枚 6px 的单字印。
 *
 * ## 身份是现成的
 *
 * `ui/collectionDesk` 的 `COLLECTION_CATEGORY_MARKS` 就是那九类(器 / 功 / 悟 /
 * 丹 / 材 / 宝 / 兽 / 闻 / 赋)。九类九种地形,正好一一对上 ——
 * 这是一张能做**一对一**的表,不必共用。
 *
 * ## 判据守什么
 *
 *   一 九柜各有各的画,**一对一,无共用**(九类对九种地形,没有理由挤);
 *   二 取景读**这一柜**(`cell.key`),不是玩家脚下那片地;
 *   三 画不占布局:那一格是柜屉按钮,画占布局会把收录数挤走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { COLLECTION_CATEGORY_MARKS } from "@/ui/collectionDesk";
import { SCENE_TERRAINS, sceneTerrainOfCollection, type SceneTerrain } from "@/ui/sceneTerrain";

const CAB = "src/components/common/CollectionCabinet.vue";

describe("九柜藏珍 · 这一柜收的是哪类物事", () => {
  it("九柜九种地形,一对一 —— 没有理由共用", () => {
    const keys = Object.keys(COLLECTION_CATEGORY_MARKS);
    expect(keys.length, "九柜该有九类").toBe(SCENE_TERRAINS.length);
    const seen = new Map<SceneTerrain, string>();
    for (const key of keys) {
      const terrain = sceneTerrainOfCollection(key);
      expect(SCENE_TERRAINS, `${key} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(
        clash,
        `「${key}」与「${clash}」画成了同一片(${terrain})—— 九柜对九地形,不该共用`,
      ).toBeUndefined();
      seen.set(terrain, key);
    }
    expect(seen.size, "九柜该用满九种地形").toBe(9);
  });

  it("认不出的柜落到山岳兜底", () => {
    expect(sceneTerrainOfCollection(null)).toBe("peaks");
    expect(sceneTerrainOfCollection("no-such-cabinet")).toBe("peaks");
  });

  it("柜面真接上了画,且按这一柜取景", () => {
    const src = readSource(CAB);
    expect(src, "九柜柜面仍是纯文字 —— 九只屉长得一样").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfCollection\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一柜").toMatch(/cell/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在那一只柜屉里,且不占布局", () => {
    const src = readSource(CAB);
    const row = src.match(/v-for="cell in cells"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(row, "定位不到柜屉那一条 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一只柜屉里").toContain("<InkScene");
    const css = readSource("src/styles/pages/collection.css");
    const rule =
      (src.match(/\.collection-cabinet__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.collection-cabinet__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .collection-cabinet__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
