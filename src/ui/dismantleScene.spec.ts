/**
 * 一键分解 —— 九档品质并排,而每行只有一枚色字。
 *
 * ## 现状
 *
 * 行囊「一键分解」弹窗把九个品质档列成九行:勾选框、品质名(带色)、
 * 「现存 N 件 · 返还多少」。336 行模板里一个 `<svg>` 都没有 ——
 * 九行长得一样,区别只有那枚色字与数字。
 *
 * ## 身份是现成的
 *
 * `data/qualities` 的 `QUALITIES` 就是那九档(凡品 0 → 神品 8),而地形也正好九种 ——
 * 故这是一张能做**一对一**的表,不必共用。九档各按「这一档的料有多足」取景:
 *
 *   凡品 mult 1.0   → 山岳(随手拾来的)
 *   良品 mult 1.25  → 林麓
 *   精品 mult 1.6   → 江海
 *   灵品 mult 2.1   → 星野(有灵)
 *   玄品 mult 2.8   → 火域(玄而烈)
 *   地品 mult 3.7   → 雪原(地脉之寒)
 *   天品 mult 5.0   → 宫阙(天家之物)
 *   仙品 mult 6.8   → 虚空(仙者不在此界)
 *   神品 mult 9.5   → 遗迹(神物残响)
 *
 * ## 判据守什么
 *
 *   一 九档九种地形,一对一(没有理由共用);
 *   二 取景读**这一行**(`rank`),不是玩家脚下那片地;
 *   三 画不占布局:那行是勾选项,画占布局会把「现存 N 件」挤走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES } from "@/data/qualities";
import { SCENE_TERRAINS, sceneTerrainOfQuality, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/inventory/DismantleDialog.vue";

describe("一键分解 · 这一档是什么料", () => {
  it("九档九种地形,一对一 —— 没有理由共用", () => {
    expect(QUALITIES.length, "品质该有九档").toBe(SCENE_TERRAINS.length);
    const seen = new Map<SceneTerrain, string>();
    for (const q of QUALITIES) {
      const terrain = sceneTerrainOfQuality(q.rank);
      expect(SCENE_TERRAINS, `${q.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${q.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, q.name);
    }
    expect(seen.size, "九档该用满九种地形").toBe(9);
  });

  it("认不出的档落到山岳兜底 —— 最低那一档", () => {
    expect(sceneTerrainOfQuality(null)).toBe("peaks");
    expect(sceneTerrainOfQuality(99)).toBe("peaks");
  });

  it("分解弹窗真接上了画,且按这一档取景", () => {
    const src = readSource(DLG);
    expect(src, "一键分解仍是纯文字 —— 九行长得一样").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfQuality\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一档").toMatch(/rank/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在分解那九行里,且不占布局", () => {
    const src = readSource(DLG);
    /*
     * 画必须落在 `v-for="row in decomposeRows"` 那一行里 —— 九档若共用一张底,
     * 这一屏就还是九行字。**不许**落到下面「智能收纳」那一段(另一只弹窗)。
     */
    /*
     * 切到「智能收纳」那一只弹窗为止 —— 但 `indexOf("智能收纳")` 会落在**注释**里
     * (那一行就在模板顶上),于是切出来是空的,判据空转(实测第一版就是这样)。
     * 故直接取 `v-for="row in decomposeRows"` 那一段的 label。
     */
    const row = src.match(/v-for="row in decomposeRows"[\s\S]*?<\/label>/)?.[0] ?? "";
    expect(row, "定位不到分解那九行 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一行里").toContain("<InkScene");
    const css = readSource("src/styles/pages/inventory.css");
    const rule =
      (src.match(/\.decompose-row__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.decompose-row__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .decompose-row__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
