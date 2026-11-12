/**
 * 弹窗要**继承**世界色,而不是各自写死一片黑。
 *
 * ## 上一轮的修法只对了一半
 *
 * `BaseModal` 是 `<Teleport to="body">` 的,`--world-mountain` 定义在
 * `.app-shell[data-world=…]` 上 —— 弹窗不在那棵子树里,于是山骨退化成 `currentColor`。
 * 上一轮给十六处弹窗画各补了一句 `--world-mountain: rgb(var(--color-ink-rgb))`:
 * 退化的毛病没了,但**十六处全成了同一种固定墨色**。玩家站在仙界(蓝山)打开弹窗,
 * 里面仍是黑山 —— 跨过那道"弹窗边界"山色会突变。
 *
 * ## 这一轮改成单点根治
 *
 * 让 `BaseModal` 的面板自己带上 `data-world`(它已经能读 `player.world.id`),
 * 并把 `.app-shell[data-world=…]` 那四条世界色规则的选择器扩成也命中
 * `[data-world=…]` 本身。这样:
 *   · 弹窗里的画**跟着世界换色**,与页面上的画同色;
 *   · 以后新加的弹窗**自动**正确,不必每处记得写一句。
 *
 * ## 判据守什么
 *
 *   一 `BaseModal` 的面板真的带了 `data-world`;
 *   二 世界色那几条规则的选择器里有 `[data-world`,不是只挂在 `.app-shell` 上;
 *   三 弹窗画**不许**再各自写死 `--world-mountain`(那会盖过继承来的值)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { readStyleCss } from "@/test/readStyleCss";

describe("弹窗继承世界色", () => {
  it("BaseModal 的面板带上 data-world", () => {
    const src = readSource("src/components/common/BaseModal.vue");
    expect(src, "面板要带 data-world —— 否则那棵子树里没有世界色").toMatch(/data-world/);
    /*
     * 必须绑的是**当前世界**,不是常数 —— 写成 `data-world="mortal"` 也能让上一条绿,
     * 而那样四界永远是同一种色。
     */
    expect(src, "要绑 player.world.id").toMatch(/player\.world\.id/);
  });

  it("世界色规则不只挂在 .app-shell 上", () => {
    const css = readStyleCss();
    /*
     * 四条世界色规则的选择器要**同时**命中 `.app-shell[data-world=…]` 与
     * 一个不带 `.app-shell` 前缀的 `[data-world=…]` —— 后者就是弹窗面板那一支。
     * 只钉「选择器里出现过 `[data-world`」不够:`.app-shell[data-world=…]` 里也有它。
     */
    /*
     * 匹配 `,` 换行后的裸选择器 —— 正则要跨行:
     * 那几条规则写成 `.app-shell[data-world="x"],\n  [data-world="x"] {`,
     * 裸选择器前面是逗号 + 换行 + 两个空格。
     */
    const bare = [...css.matchAll(/,\s*\[data-world="(\w+)"\]\s*\{/g)].map((m) => m[1]!);
    expect(
      bare.length,
      "没有任何一条不带 .app-shell 前缀的世界色规则 —— 弹窗那棵子树取不到色",
    ).toBeGreaterThanOrEqual(3);
    expect(bare.sort(), "四界都要有裸选择器那一支").toEqual(["chaos", "god", "immortal", "mortal"]);
  });

  it("弹窗画不许再各自写死 --world-mountain", () => {
    /*
     * 上一轮给十六处各补了一句固定墨色。改成继承之后,那些写死的值会**盖过**
     * 继承来的世界色 —— 于是弹窗里永远是一种颜色。故这一条要求它们撤掉。
     */
    const offenders = [
      "src/styles/pages/cultivation.css",
      "src/styles/pages/celestial.css",
      "src/styles/pages/inventory.css",
      "src/styles/pages/adventure.css",
      "src/components/common/NavigationAtlas.vue",
      "src/components/offline/OfflineRewardDialog.vue",
      "src/components/cultivation/GongfaDialog.vue",
      "src/components/inventory/SlotCandidatesDialog.vue",
      "src/components/earlygame/OpportunityScroll.vue",
      "src/components/character/MentorDialog.vue",
    ].filter((f) => readSource(f).includes("--world-mountain: rgb(var(--color-ink-rgb))"));
    expect(offenders, "这些地方还写死着固定墨色 —— 会盖过继承来的世界色").toEqual([]);
  });
});
