/**
 * 藏珍详情 —— 九只柜屉各有一副长相,点开单件藏品却只剩一枚图标。
 *
 * ## 现状
 *
 * 藏珍页(九柜)的柜屉早就按 `sceneTerrainOfCollection(cabinetKey)` 取景,
 * 九柜铺开九种地形。而玩家点开**单件藏品**看详情时,弹窗里只有:一枚 24px 图标、
 * 类名、品评、描述、提示与页脚 —— 一笔画都没有。
 *
 * 与器魂(席上看得见、点进详情看不见)、道途确认(列表里看得见、确认那一屏看不见)
 * 是同一条通病:**同一个身份,前一步画了,后一步没画。**
 *
 * ## 身份是现成的,只是没传下去
 *
 * 打开详情的函数 `openDetail(cat, entry)` 手里就有 `cat`(`CodexCat`),
 * 它带 `key` —— 正是 `sceneTerrainOfCollection` 需要的柜子键。
 * 故这一条不新立映射,只要求把那个 key 存进 `detail` 并复用同一张表。
 *
 * ## 判据守什么
 *
 *   一 九柜各一片地(判据的前提:这张表分得开);
 *   二 详情弹窗里真接上了画,且读的是**这一件所在的那一柜**;
 *   三 画不占布局:这一窗是图标、类名、品评、描述与页脚。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { COLLECTION_TERRAIN, sceneTerrainOfCollection, SCENE_TERRAINS } from "@/ui/sceneTerrain";

const VIEW = "src/views/CollectionView.vue";

describe("藏珍详情 · 这一件属于哪一柜", () => {
  it("九柜各一片地(判据的前提)", () => {
    const keys = Object.keys(COLLECTION_TERRAIN);
    expect(keys.length, "九柜该有九个柜子键").toBe(9);
    const terrains = keys.map((k) => sceneTerrainOfCollection(k));
    for (const t of terrains) expect(SCENE_TERRAINS).toContain(t);
    expect(new Set(terrains).size, "九柜的取景没有铺开九种 —— 按柜取景名不副实").toBe(9);
  });

  it("详情弹窗里真接上了画,且读这一件所在的那一柜", () => {
    const src = readSource(VIEW);
    const raw = src.match(/:open="detail !== null"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    expect(raw, "定位不到藏珍详情弹窗 —— 判据会空转").not.toBe("");
    /* 先剥注释再验:说明里会引用那段写法(前两轮都栽在这上面) */
    const dialog = raw.replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "藏珍详情仍是纯文字 —— 柜屉上看得见,点进去看不见").toContain("<InkScene");
    expect(dialog, "取景要读这一件所在的那一柜").toMatch(
      /sceneTerrainOfCollection\s*\(\s*detail[^)]*catKey/,
    );
  });

  it("打开详情时把柜子键一起存下去 —— 不是事后再猜", () => {
    /*
     * 这一条守的是**数据来路**:`detail` 存的是 `{ catName, entry }`,
     * 而取景要的是 `catKey`。若只把 `catName`(中文名)拿去映射,
     * 那就是把展示文案当数据用 —— 改一次名就全落兜底。
     */
    const src = readSource(VIEW);
    const setter = src.match(/function openDetail[^{]*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(setter, "定位不到 openDetail —— 判据会空转").not.toBe("");
    expect(setter, "打开详情时要存下 cat.key").toMatch(/catKey\s*:\s*cat\.key/);
  });

  it("画不占布局", () => {
    const src = readSource(VIEW);
    const raw = src.match(/:open="detail !== null"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    const dialog = raw.replace(/<!--[\s\S]*?-->/g, "");
    const cls = dialog.match(/class="([a-z][a-z0-9-]*__scene)"/)?.[1] ?? "";
    expect(cls, "定位不到那一层画的类名 —— 判据会空转").not.toBe("");
    const css = readSource("src/styles/pages/collection.css");
    const rule =
      (src.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "") ||
      (css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "");
    expect(rule, `定位不到 .${cls} 的规则`).not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
