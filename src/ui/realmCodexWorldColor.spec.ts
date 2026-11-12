/**
 * 界域志四卷的山色要各随其界 —— 不是四卷同一个色。
 *
 * ## 这一条钉的是「画到没画到点上」
 *
 * 上一轮给四卷各补了一幅画,地形确实不同(peaks / sky / palace / void)。
 * 但地形只决定**山骨的形状**;颜色读的是 `--world-mountain`,而它来自
 * 各卷自己的 `data-world`。两者都对,四卷才是四片天。
 *
 * 真浏览器量过:四卷的 `far.fill` 分别是
 *   mortal   rgb(41, 39, 34)    墨
 *   immortal rgb(60, 108, 152)  蓝
 *   god      rgb(112, 84, 160)  紫
 *   chaos    rgb(80, 100, 138)  幽蓝
 * 而 `.app-shell` 上那一份是当前所在界的色 —— 若四卷读的是它,四卷会同一个色。
 *
 * ## 判据守什么
 *
 * 卷首的画要绑 `row.world.id`(不是 `player.world.id`)。
 * 这一条在源码层就够:绑错了,四卷必然同色,而那正是本仓反复踩的形状。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SCENE_TERRAINS, sceneTerrainOfPlace } from "@/ui/sceneTerrain";

const VIEW = "src/views/RealmCodexView.vue";

describe("界域志四卷的山色", () => {
  it("四界的世界色互不相同(判据的前提)", () => {
    /*
     * `--world-mountain` 那张表在 style.css 里,这里只看地形层:
     * 若四个世界的取景本来就一样,「随界换色」也无从谈起。
     */
    const worlds = ["mortal", "immortal", "god", "chaos"];
    const terrains = worlds.map((w) => sceneTerrainOfPlace({ worldId: w }));
    for (const t of terrains) expect(SCENE_TERRAINS).toContain(t);
    expect(new Set(terrains).size, "四个世界的取景没分开 —— 随界换色名不副实").toBe(4);
  });

  it("卷首的画绑的是这一卷自己的世界", () => {
    const src = readSource(VIEW);
    const volume = src.match(/v-for="row in realmAtlasRows"[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(volume, "定位不到四卷的卷首 —— 判据会空转").not.toBe("");
    const clean = volume.replace(/<!--[\s\S]*?-->/g, "");
    /*
     * 必须绑 `row.world.id`。绑 `player.world.id` 时四卷会读同一个色 ——
     * 那与「四界成卷」这句话相反,而且界面上看不出来(四卷地形仍不同,只是同色)。
     */
    expect(clean, "要绑这一卷自己的世界").toMatch(/:world-id="row\.world\.id"/);
    expect(clean, "不许绑玩家当前所在界 —— 四卷会变成同一个色").not.toMatch(
      /:world-id="player\.world\.id"/,
    );
  });
});
