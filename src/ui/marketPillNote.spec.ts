/**
 * 坊市的丹药行 —— 数据里有的话,界面上不该换成一句模板。
 *
 * ## 复现:两枚完全不同的丹药,配着一模一样的说明
 *
 * 坊市「本架货目」里,丹药那一行是这样写的:
 *
 * ```html
 * <p class="market-good__note">一枚丹方之味 · 免去集草开炉</p>
 * ```
 *
 * 一句写死的 `<p>`,对所有丹药都一样。于是:
 *
 * ```text
 * 万寿金丹 ×1   一枚丹方之味 · 免去集草开炉
 * 灵乳     ×1   一枚丹方之味 · 免去集草开炉
 * ```
 *
 * 而 `data/pills` 里它们各自是有话的:
 *
 * - 万寿金丹:「金丹光华内蕴,寿数绵长」
 * - 灵乳:「万年钟乳凝成的灵液,一口涤尽枯竭 —— 灵材难得,火候更难」
 *
 * ## 为什么这一处值得修
 *
 * 这一作在别处都做到了「数据里的那句话要露出来」:法宝、灵兽、功法、丹药详情页
 * 都有自己的 desc。唯独坊市这一格用模板把它盖住了 —— 而坊市正是玩家**掏灵石之前**
 * 看的那一屏。
 *
 * 更要紧的是:这两枚丹的**用途完全不同**(万寿金丹延寿、灵乳回气)。模板文案
 * 「免去集草开炉」说的是「怎么得到它」,而不说「它有什么用」—— 玩家花 875 灵石
 * 之前,唯一能读到的是一句关于获取方式的话。
 *
 * ## 判据守什么
 *
 * 一条:坊市丹药行的说明要读丹药自己的 desc,不许用一句覆盖所有丹药的模板。
 *
 * 不规定排版与截断方式 —— 只要求那一格的内容随丹药而变。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/MarketView.vue";

describe("坊市丹药行 · 要说丹药自己的话", () => {
  it("丹药行不再用一句覆盖所有丹药的模板", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    expect(
      src,
      "丹药行还写着「一枚丹方之味 · 免去集草开炉」—— 一句话盖住了所有丹药自己的 desc",
    ).not.toContain("一枚丹方之味");
  });

  it("丹药行要读 pillDef 的 desc", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    // 找丹药那一支
    const branch = src.match(/slot\.kind === 'pill'[\s\S]{0,600}?<\/div>/)?.[0] ?? "";
    expect(branch, "定位不到丹药行 —— 判据会空转").not.toBe("");
    expect(branch, "丹药行要读它自己的 desc").toMatch(/desc/);
  });

  it("反空转:丹药名仍要照常显示", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    expect(src, "丹药名不能丢").toMatch(/pillDef\(slot\.pillId\)\?\.name/);
  });
});
