/**
 * 宽档浮层的版面利用 —— 内容多的一扇,不该在宽屏上还单列往下摞。
 *
 * ## 这条判据为什么存在
 *
 * `layout-check` 的 `taskDesktopModalDepth` 已经守住了**卷身深度**
 * (1280 档打开器评帖,卷身不许滚过 1.5 屏)。但它只量器评帖一扇;
 * 全仓 52 个 `BaseModal`,其余 51 扇没有这条线。
 *
 * 把剩下的扫一遍(13 个页面 × 每页至多 15 个可点元素),只有**一处**超线:
 *
 * ```text
 *   道躯「行藏周天」(size=wide,宽 832px)  2.23 屏
 * ```
 *
 * 它和器评帖修复前是**同一种病**:浮层已经放宽到 832px,内容却仍是单列,
 * 每行只有「名称 …… 数值」,右侧大片空白 —— 横向空间一直空着,高度白堆。
 *
 * ## 判据守什么
 *
 * 内容多的浮层在桌面档必须**分栏**(`columns`),器首/抬头这类横条 `column-span: all`。
 * 它不规定分几栏、也不规定栏宽 —— 那是版式细节;它只管「宽屏上横向空间没被浪费」。
 *
 * 为什么用静态判据而不是再加一条 layout-check 任务:分栏是**样式层**的事,
 * 在源文件里就能判定;把它放进浏览器门会让这条约束只能在跑完整布局自检时才可见,
 * 改 CSS 的人当场看不到。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("宽档浮层在桌面上要分栏", () => {
  it("器评帖分两栏(已落地的那一扇,防止回退)", () => {
    const css = readSource("src/styles/pages/inventory.css");
    const block =
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,600}\.equip-dossier\s*\{[\s\S]{0,420}?columns:\s*2/.exec(
        css,
      );
    expect(block, "器评帖的桌面两栏没了 —— 卷身会退回 2.1 屏").toBeTruthy();
    if (!block) throw new Error("器评帖的桌面两栏没了");
    /*
     * 器评帖的基础规则是 `min-width: 0`(默认 display:block),多栏本就能生效。
     * 但若哪天有人给它加了 `display: grid`,media 块里必须同时改回来 ——
     * 故这里查「要么基础规则不是容器类型,要么 media 块里覆盖了 display」。
     */
    const baseRule = /\.equip-dossier\s*\{([\s\S]{0,200}?)\}/.exec(css)?.[1] ?? "";
    const baseIsColumnCapable = !/display:\s*(grid|flex)/.test(baseRule);
    expect(
      baseIsColumnCapable || COLUMN_CAPABLE.test(block[0]),
      "器评帖的容器被改成了 grid/flex,却没在 media 块里换回 block —— columns 会静默失效",
    ).toBe(true);
    /* 器首是一条横条,必须跨栏 */
    expect(css, "器首没有 column-span:all —— 它会被劈成两半").toMatch(
      /\.equip-dossier__hero\s*\{[\s\S]{0,300}column-span:\s*all/,
    );
  });

  /*
   * `columns` 对 grid / flex 容器**静默无效** —— 这是实现时真踩到的坑:
   * 原规则是 `display: grid`,只加 `columns: 2` 后 `columnCount` 已是 2、
   * 子元素却全挤在同一列,卷身一点没降。故判据必须**同时**查 display。
   */
  const COLUMN_CAPABLE = /display:\s*(block|flow-root);/;

  it("道躯「行藏周天」分两栏,且容器真的支持多栏", () => {
    const css = readSource("src/styles/pages/character.css");
    const block =
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1200}\.character-modifier-folio\s*\{[\s\S]{0,420}?columns:\s*2/.exec(
        css,
      );
    expect(
      block,
      "「行藏周天」在 832px 宽档上仍单列 —— 实测卷身 2.23 屏,每行右侧大片空白",
    ).toBeTruthy();
    if (!block) throw new Error("「行藏周天」的桌面两栏没了");
    expect(
      block[0],
      "写了 columns 却没换 display —— 原规则是 display:grid,多栏属性对它静默无效(实测已验证)",
    ).toMatch(COLUMN_CAPABLE);
    /* 说明行是横条,跨栏 */
    expect(css, "说明行没有 column-span:all —— 它会被劈成两半").toMatch(
      /\.character-modifier-folio__lead\s*\{[\s\S]{0,300}column-span:\s*all/,
    );
    /* 一组内容不许被栏缝劈开 */
    expect(css, "各分组没有 break-inside:avoid —— 一组的行会被拆到两栏").toMatch(
      /\.character-modifier-folio__group\s*\{[\s\S]{0,300}break-inside:\s*avoid/,
    );
  });
});
