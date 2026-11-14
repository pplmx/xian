/**
 * 日课的去处链接要够大 —— 200% 缩放下它是 37×15px。
 *
 * ## 由来（第 202 轮，200% 缩放下的触控目标）
 *
 * 在 195×422（390px 屏、200% 缩放）下量首页每一颗可点元素:
 *
 * ```text
 * 去历练 ›  37x15
 * 去服药 ›  37x15
 * 去开炉 ›  37x15
 * ```
 *
 * 其余元素都 ≥ 24px，**只有日课的去处链接是 15px 高**。
 *
 * ## 这不是第一次修它
 *
 * `home.css` 那段注释已经记着一次修复:
 *
 * ```text
 * 不加这条规则时它被塞进第三列，实测宽度只剩 24px（文字全被压掉）。
 * 故让它自己占满一整行、靠右 —— 与进度条那一行同样 `1 / -1`。
 * ```
 *
 * 也就是说:宽度的问题修过了，**高度的问题没修** —— 而 `font-size: var(--type-note)`
 * 配 `line-height: 1` 正好是 15px，一个「看起来没问题、点起来要瞄准」的尺寸。
 *
 * ## 为什么这算缺陷
 *
 * 日课是首页最常点的一栏（每天八条）。在 200% 缩放下，玩家要在一行文字里
 * 精确命中 15px 高的区域；而它的父元素 `.home-daily__route` 就是它自己，
 * 没有更大的可点容器兜底（实测父元素同样是 37×15）。
 *
 * ## 这条判据守什么
 *
 * ① 那个链接有**竖向内边距**或 `min-height`，使可点高度到 24px 以上;
 * ② 有 `inline-flex` 之类的居中，让加高之后文字仍在中间。
 *
 * 不钉具体数值 —— 24 是下限，写 32 也行。
 *
 * ## 故障注入
 *
 * 删掉 `min-height` 与竖向内边距 → 「可点高度至少 24px」红。
 * 删掉 `display: inline-flex` → 「加高之后文字仍然居中」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const CSS = "src/styles/pages/home.css";

/** 取出 `.home-daily__route { … }` 那个规则的正文 */
function routeRule(css: string): string | null {
  const m = /\.home-daily__route\s*\{([^}]*)\}/.exec(css);
  return m ? m[1]! : null;
}

describe("日课去处 · 可点区域的高度", () => {
  it("判据的前提还在 —— 那条规则与那个链接", () => {
    const css = stripComments(readSource(CSS));
    expect(routeRule(css), "找不到 .home-daily__route 规则").not.toBeNull();

    const home = stripComments(readSource("src/views/HomeView.vue"));
    expect(home, "日课去处链接没了").toContain("home-daily__route");
  });

  it("可点高度至少 24px —— 靠内边距或 min-height", () => {
    const css = stripComments(readSource(CSS));
    const rule = routeRule(css)!;

    /*
     * 判那件事:规则里有一条能让高度上去的声明。
     * 认三种写法:`min-height:` / `padding:`（竖向）/ `padding-block:`。
     */
    const hasMinHeight = /min-height\s*:\s*([\d.]+)(rem|px)/.test(rule);
    const hasPadding = /(?:^|;|\s)padding(?:-block(?:-start|-end)?)?\s*:\s*[^;]+/.test(rule);

    expect(
      hasMinHeight || hasPadding,
      "日课去处链接没有竖向内边距，也没有 min-height —— 它在 200% 缩放下只有 15px 高，" +
        "而日课是首页最常点的一栏。宽度的问题早修过了（见那段注释），高度没修",
    ).toBe(true);
  });

  it("加高之后文字仍然居中 —— 不是只把盒子撑大", () => {
    /*
     * 防空转的第二层:只加 `padding` 而链接是默认的 `inline`，
     * 竖向 padding 会溢出到行外、点到的还是那 15px。
     * 故核:规则里得有 `inline-flex` / `flex` / `block` 之类让它成为一个真正的盒子。
     */
    const css = stripComments(readSource(CSS));
    const rule = routeRule(css)!;
    expect(
      rule,
      "链接仍是默认的 inline —— 竖向 padding 不会扩大可点区域，只会让文字压到上一行",
    ).toMatch(/display\s*:\s*(inline-flex|flex|inline-block|block)/);
  });
});
