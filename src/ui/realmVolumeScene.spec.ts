/**
 * 界域志的四卷 —— 每一卷是一个世界,而四卷脊背一模一样。
 *
 * ## 现状
 *
 * 「界域志」把境界按世界分成四卷(`realm-volume`,带 `data-world`),
 * 每卷有卷首:世名印章、卷次、描述 —— 然后是一串可折叠的境界条目。
 * 647 行模板里,除了卷首那枚 `RealmAtlas` 自绘图谱,每一卷的**脊背**没有任何画。
 * 玩家翻四卷,看到的是同一张纸上的四段文字。
 *
 * ## 身份是现成的
 *
 * 每一卷本身就带 `data-world`,而全站已有 `WORLD_TERRAIN`
 * (首页、修行卷首读的就是它:人间=山岳、仙界=星野、神界=宫阙、混沌=虚空)。
 * 界域志讲「四界成卷」—— 那四卷就该各是它那一界的天。
 *
 * ## 判据守什么
 *
 *   一 四界各一片天(判据的前提);
 *   二 每一卷的卷首真接上了画,且读这一卷自己的世界;
 *   三 画不占布局:卷首是世名、卷次与描述,下面是境界账。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SCENE_TERRAINS, sceneTerrainOfCelestial } from "@/ui/sceneTerrain";

const VIEW = "src/views/RealmCodexView.vue";

describe("界域志的四卷 · 各是它那一界的天", () => {
  it("四界各一片天(判据的前提)", () => {
    /*
     * 判据走 `sceneTerrainOfCelestial`,与页面里那一处调用同一条路。
     * 若四个 worldly id 里有两个落到同一片地,「按卷取景」就没有意义。
     */
    const ids = ["chiyan", "xingyun", "wanren", "wusheng", "wuxiang"];
    const terrains = ids.map((id) => sceneTerrainOfCelestial(id));
    for (const t of terrains) expect(SCENE_TERRAINS).toContain(t);
    expect(new Set(terrains).size, "五界的取景没铺开 —— 按卷取景名不副实").toBe(5);
  });

  it("每一卷的卷首都接上了画,且读这一卷自己的世界", () => {
    const src = readSource(VIEW);
    expect(src, "界域志的四卷脊背仍是同一张纸").toContain("<InkScene");
    /* 画要落在 `v-for="row in realmAtlasRows"` 那一卷里,不是页面别处 */
    const volume = src.match(/v-for="row in realmAtlasRows"[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(volume, "定位不到四卷的卷首 —— 判据会空转").not.toBe("");
    const clean = volume.replace(/<!--[\s\S]*?-->/g, "");
    expect(clean, "卷首里没有画").toContain("<InkScene");
    expect(clean, "取景要读这一卷的世界").toMatch(/:world-id="row\.world\.id"/);
  });

  it("画不占布局", () => {
    const src = readSource(VIEW);
    const volume = src.match(/v-for="row in realmAtlasRows"[\s\S]*?<\/header>/)?.[0] ?? "";
    const clean = volume.replace(/<!--[\s\S]*?-->/g, "");
    const cls = clean.match(/class="([a-z][a-z0-9-]*__scene)"/)?.[1] ?? "";
    expect(cls, "定位不到那一层画的类名 —— 判据会空转").not.toBe("");
    const css = readSource("src/styles/pages/realm-codex.css");
    const rule =
      (src.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "") ||
      (css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "");
    expect(rule, `定位不到 .${cls} 的规则`).not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
