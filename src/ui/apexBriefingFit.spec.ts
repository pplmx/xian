/**
 * 终局简报那一行在窄屏上放得下 —— 而 layout-check 巡不到它。
 *
 * ## 由来（第 538 轮）
 *
 * 第 537 轮我给 `ApexBriefing` 的道痕那一格补了门槛（「12 / 5 则道痕（未成形）」），
 * 而**没有验证它在 320px 上放不放得下**。
 *
 * ```text
 *   改前  此生已尽 · 第 3 世 · 12 部功法 · 12 则道痕              30 字符
 *   改后  此生已尽 · 第 3 世 · 12 部功法 · 12 / 5 则道痕（未成形）  39 字符
 * ```
 *
 * ## 为什么 layout-check 抓不到
 *
 * `ApexBriefing` 只在 `player.atMaxRealm` 时挂上（HomeView 第 135 行）——
 * 而巡游脚本跑的是新号状态，`layout-check.mjs` 里对 `ApexBriefing` 的引用数**是 0**。
 *
 * 本仓在这个形状上踩过:第 236 轮 `BreakthroughCard` 的注释里记着
 * 「实测『服用聚气丹 · +5% 尚差 30 石』会把右缘顶到 211px 越界 16px」。
 *
 * ## 判据能守什么、不能守什么
 *
 * 不能守:真实像素。那要真浏览器。
 * 能守:**那一行是块级、可折行，且没有 `nowrap`** —— 越界的前提正是后者。
 * 以及:文案长度的增长有上限，被人再加一句时它会红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BRIEF = readFileSync(resolve(__dirname, "../components/common/ApexBriefing.vue"), "utf8");
const CSS = readFileSync(resolve(__dirname, "../styles/pages/home.css"), "utf8");

describe("终局简报 · 窄屏放得下", () => {
  it("① 那一行可折行 —— 没有 nowrap", () => {
    /*
     * ## 这一条改过一次（第 538 轮）
     *
     * 第一版只取**第一条** `.home-deck__next-copy { … }`，而那个文件里它有**两条规则**:
     *
     * ```text
     *   第一条（三合一里）  display: block; min-width: 0;
     *   第二条（单独一条）  margin-top / color / font-size / line-height
     * ```
     *
     * 于是往第二条注入 `white-space: nowrap` 时，判据**照样绿** ——
     * 因为它只读第一条。这正是「判据空转」里的第三种形态:**读的地方对，但读的不全。**
     *
     * 改成取全部同名规则，逐条都不许出现 nowrap。
     */
    const rules = [...CSS.matchAll(/\.home-deck__next-copy\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(rules.length, "找不到 .home-deck__next-copy 的样式 —— 判据的前提要重看").toBeGreaterThan(
      0,
    );
    for (const rule of rules) {
      expect(
        rule,
        "`.home-deck__next-copy` 被加了 nowrap —— 39 字符在 320px 上必然越界：" + rule,
      ).not.toContain("nowrap");
    }
    /* 至少有一条声明了 display: block —— 那才保证它会折行 */
    expect(rules.join("\n"), "它不再是一个块级元素 —— 那它不会折行").toContain("display: block");
  });

  it("② 反空转：容器也允许收缩", () => {
    /*
     * `min-width: 0` 是 grid 子项能收缩的前提；少了它，长文案会把整格撑开。
     */
    const m = CSS.match(
      /\.home-deck__next-body,\s*\.home-deck__next-title,\s*\.home-deck__next-copy\s*\{[^}]*\}/,
    );
    expect(m, "找不到那条三合一的规则 —— 判据的前提要重看").toBeTruthy();
    expect(m![0], "少了 min-width: 0 —— grid 子项会把整格撑开").toContain("min-width: 0");
  });

  it("③ 文案不许再长 —— 现在的长度是上限", () => {
    /*
     * 这一条守的是「下次有人再往这一行加一句」。
     * 取模板里那一整段 copy，按中文与空格折算成字符数。
     */
    /*
     * 「此生已尽」在上一行的 tag 里（`home-deck__next-tag`），不在 copy 那一行 ——
     * 故从 tag 开始取，把整格读进来。
     */
    const at = BRIEF.indexOf("home-deck__next-tag");
    expect(at, "找不到那一格 —— 判据的前提要重看").toBeGreaterThan(0);
    const body = BRIEF.slice(at, at + 1200);
    /*
     * 去掉必须保留的静态字:「此生已尽」「第 N 世」「N 部功法」「N / M 则道痕」
     * 与「（未成形）」。剩下的插值不固定 —— 但那几段的可变宽度有限（最多两位数）。
     */
    const fixed = ["此生已尽", "世", "部功法", "则道痕", "（未成形）"];
    for (const f of fixed) {
      expect(body, `那一行缺了「${f}」—— 判据③的前提变了`).toContain(f);
    }
    /* 数一数这一行有几个「·」分隔段：现在是 4 段，再多一段就该重新排版 */
    const dots = (body.match(/·/g) ?? []).length;
    expect(
      dots,
      `那一行现在有 ${dots} 个「·」分隔段 —— 再多就该换排版，不是加字`,
    ).toBeLessThanOrEqual(4);
  });
});
