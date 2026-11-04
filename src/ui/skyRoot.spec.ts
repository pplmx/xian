/**
 * 同一片天 —— 首页与修行页的星空,该是同一份天时。
 *
 * ## 现状
 *
 * 两个页面各有一片星空:
 *
 *   首页   `.home-deck__hero-art`    十一颗星、一道山影
 *   修行页 `.cultivation-masthead__backdrop`  十四颗星、两道环、一道山影
 *
 * 两组的星样式**逐字相同**:
 *
 *   background: rgb(var(--color-gold-ink-rgb) / 0.62);
 *   box-shadow: 0 0 8px rgb(var(--color-gold-ink-rgb) / 0.42);
 *
 * 第 47 轮让首页那片跟着天时变,修行页没跟 —— 于是同一天里,首页抬头是「月蚀」
 * 的稀星,翻到修行页却是满天亮星。**两处说的是同一片天,却各说各的。**
 *
 * 而修行页比首页更该有天色:玩家在那儿打坐吐纳,坐着不动的那几分钟里,
 * 顶上的天是唯一会变的东西。
 *
 * ## 做什么
 *
 * 把第 47 轮那两个变量(`--sky-star-rgb` / `--sky-brightness`)提到**页面根节点**上,
 * 两处星空都从根上继承,样式表里各读变量、各有缺省值。
 *
 * 这样以后再加第三处星空(比如洞府页),只要挂在同一个根上就自动一致 ——
 * 不必再各写一份、也不会再出现"一处变了另一处没变"。
 *
 * ## 为什么不是"修行页也调一次 skyOfWeather"
 *
 * 可以,但那是两处各调一次、各自算一遍。挂在根上则只有**一处**知道今天的天时,
 * 两处只是继承。前者今天对、明天加第三个页面时又会漏。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("同一片天 · 变量挂在根上", () => {
  it("首页把色与亮挂在页面根节点,而不是只挂在那块底图上", () => {
    const home = readSource("src/views/HomeView.vue");
    // 根节点(带 folio-page 的那个 div)要带 style 绑定
    const rootAt = home.indexOf("<template>");
    const firstDivAfterRoot = home.indexOf("<div", rootAt);
    const rootTag = home.slice(firstDivAfterRoot, home.indexOf(">", firstDivAfterRoot) + 1);
    expect(rootTag, "根节点要挂 skyStyle").toContain(':style="skyStyle"');
  });

  it("修行页的星空读同一组变量 —— 不再写死金色", () => {
    const css = readSource("src/styles/pages/cultivation.css");
    const at = css.indexOf(".cultivation-masthead__star {");
    expect(at, "那组样式要还在").toBeGreaterThan(0);
    const block = css.slice(at, css.indexOf("}", at));
    expect(block, "该读天时的色").toContain("--sky-star-rgb");
    expect(block, "该读天时的亮").toContain("--sky-brightness");
    expect(block, "不该再写死金色").not.toMatch(/--color-gold-ink-rgb\s*\)\s*\/\s*0\.62/);
  });

  it("两处都有缺省值 —— 没有天时的场合仍是金色", () => {
    for (const [file, sel] of [
      ["src/styles/pages/home.css", ".home-deck__star {"],
      ["src/styles/pages/cultivation.css", ".cultivation-masthead__star {"],
    ] as const) {
      const css = readSource(file);
      const at = css.indexOf(sel);
      const block = css.slice(at, css.indexOf("}", at));
      expect(block, `${file} 缺了缺省色`).toContain("var(--color-gold-ink-rgb)");
      expect(block, `${file} 缺了缺省亮`).toContain("0.62");
    }
  });

  it("修行页根节点也挂上 —— 一处算、两处继承", () => {
    const view = readSource("src/views/CultivationView.vue");
    expect(view, "修行页根要挂 skyStyle").toContain(':style="skyStyle"');
    expect(view, "该用同一份判定").toContain("skyOfWeather(");
  });
});
