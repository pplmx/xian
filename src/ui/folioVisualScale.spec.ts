/**
 * 观象 —— 点开它，是为了看清；不是为了在原地重看一遍同样大的一张图。
 *
 * ## 复现:卷首那几张图是「一眼扫过」的尺寸
 *
 * 卷首主视觉都是固定小尺寸,因为它们要在题头那一行里与册名并排:
 *
 * ```text
 * DongfuAtlas        168×146   (洞府山门图)
 * CultivationDial    140×140   (修行周天盘)
 * CharacterSigil     140×140   (道躯印心)
 * CelestialGateMap   150×124   (天界天门图)
 * ```
 *
 * 这些尺寸各自被判据钉着(见 `ui/cultivationDesk.spec` 的「周天盘按 140px 实尺寸留位」)——
 * 它们**不能改**,改了卷首那一行就会被挤。
 *
 * 而「观象」是玩家**主动点开**的动作:他要看清那张图里七座建筑的方位、
 * 二十一道刻度走到哪、灵根两根各占几分。此时给他一张和刚才一模一样大的图,
 * 这个动作就没有兑现它自己的承诺。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 观象弹框里那张图**被放大过**(不依赖具体组件名,量的是容器样式);
 *   二 放大用 `transform: scale()`,**不改组件自己的宽高** —— 那几个尺寸被
 *      别的判据钉着,动它们会把卷首挤坏。
 *
 * 为什么要求 scale 而不是把弹框里的图换一套尺寸:CSS `scale` 只影响绘制,
 * 不动布局盒;而改 width/height 会让同一个组件在两种场合有两套尺寸语义,
 * 下一个读它的人得先判断「我现在在哪儿」才知道 140 是什么意思。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const FOLIO = "src/components/common/FolioVisualFolio.vue";
const CSS = "src/style.css";

describe("观象 · 点开要看得更清楚", () => {
  it("弹框里的图被放大过", () => {
    const css = readSource(CSS);
    // 取所有以 .folio-visual-folio 开头的规则,拼起来看
    const rules = (css.match(/\.folio-visual-folio[\s\S]*?\n  \}/g) ?? []).join("\n");
    expect(rules, "该有 .folio-visual-folio 的样式规则").not.toBe("");
    expect(rules, "观象弹框里的主视觉必须放大 —— 与卷首同尺寸的话,点开就等于没点").toMatch(
      /scale\(\s*1\.[1-9]/,
    );
  });

  it("放大用 transform,不改组件自己的宽高", () => {
    const css = readSource(CSS);
    const rules = (css.match(/\.folio-visual-folio[\s\S]*?\n  \}/g) ?? []).join("\n");
    expect(rules, "放大必须走 transform: scale").toContain("transform");
    // 库里那条「不改组件自己的宽高」:弹框容器里不许出现 width/height 覆写主视觉
    expect(rules, "弹框容器不许给主视觉另写一套 width").not.toMatch(/\bwidth:\s*\d/);
  });

  it("卷首那几件自己的尺寸没被动过 —— 它们被别的判据钉着", () => {
    // 周天盘 140×140 是 cultivationDesk.spec 钉的,谁改都会红
    const dial = readSource("src/components/cultivation/CultivationDial.vue");
    expect(dial, "周天盘的实尺寸不许改").toMatch(/width:\s*140px;[\s\S]{0,40}?height:\s*140px;/);
    const sigil = readSource("src/components/character/CharacterSigil.vue");
    expect(sigil, "印心的实尺寸不许改").toMatch(/width:\s*140px;[\s\S]{0,40}?height:\s*140px;/);
  });

  it("弹框标题说的是这一页的名字,不是「观象」这个动作", () => {
    const src = readSource(FOLIO);
    // 标题传的是 title(册名),不是动作词 —— 与其余详情弹窗同一口径
    expect(src, "弹框标题要报册名").toContain(':title="title"');
  });

  /**
   * 放大之后,原先在 168px 上不明显的一处会现形:山门图的地形用 `V144 H2 Z`
   * 收在画布底边,底边是一条直线切口 —— 小图上看像「山脚」，放大就成了硬边。
   *
   * 修法是把山脚做成渐隐(渐变填充),而不是改路径形状 —— 路径同时被
   * 「节点按 level/cap 现算」那些判据连着,改形状等于动了整张图。
   */
  it("山脚不许是硬边 —— 放大之后那条直线切口会现形", () => {
    const atlas = readSource("src/components/dongfu/DongfuAtlas.vue");
    expect(atlas, "地形要有渐隐的 defs").toContain("<defs>");
    expect(atlas, "山脚用线性渐变收边").toMatch(/linearGradient/);
  });
});
