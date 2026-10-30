import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("宽屏册页 · 从手机单叶展开成桌面双页", () => {
  it("只有信息能成对阅读的主册展开,其余页仍是一张较窄的单叶", async () => {
    const { folioLayoutOf } = await import("./folioSpread");

    expect(folioLayoutOf("home")).toBe("spread");
    expect(folioLayoutOf("cultivation")).toBe("spread");
    expect(folioLayoutOf("character")).toBe("spread");
    expect(folioLayoutOf("settings")).toBe("single");
    expect(folioLayoutOf(undefined)).toBe("single");
  });

  it("外壳同时认识游戏态与当前页版式,不把欢迎页撑成桌面书桌", () => {
    const app = source("src/App.vue");

    expect(app).toContain("folioLayoutOf");
    expect(app).toContain(":data-game-shell=\"game.started ? 'desk' : 'leaf'\"");
    expect(app).toContain(':data-folio-layout="folioLayout"');
  });

  it("桌面游戏外壳放宽,正文单叶收在 48rem,双页收在 66rem", () => {
    const css = source("src/style.css");

    expect(css).toMatch(/@media \(min-width: 960px\)/);
    expect(css).toContain('.app-shell[data-game-shell="desk"]');
    expect(css).toContain("max-width: 70rem");
    expect(css).toContain("max-width: 48rem");
    expect(css).toContain("max-width: 66rem");
  });

  it("双页是真正的两栏网格,中缝只画一道装饰线,窄屏仍退回单列", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\] \.folio-page--stack \{[\s\S]{0,500}?display: grid;/,
    );
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1\.08fr\) minmax\(0, 0\.92fr\)/);
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\] \.folio-page--stack::before \{[\s\S]{0,400}?left: 50%;/,
    );
    expect(css).toContain(".folio-span-all");
  });

  it("首页修行志与人物页战力构成跨两栏,不再留半页空白", () => {
    expect(source("src/views/HomeView.vue")).toMatch(
      /<section class="folio-span-all">\s*<SectionTitle title="修行志"/,
    );
    expect(source("src/views/CharacterView.vue")).toMatch(
      /<div class="card-ink folio-span-all px-4 py-3">/,
    );
  });

  it("真浏览器门在 1280 档核外壳宽度、双栏与单叶宽度,避免只靠源码自证", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("desktopFolioSeen");
    expect(layout).toContain("双页册没有真的展开");
    expect(layout).toContain("单叶册在桌面上拉得过宽");
  });
});
