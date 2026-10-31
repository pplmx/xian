import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("册页卷首 · 一页只讲清一件事", () => {
  it("卷首从玄枢图读分卷与说明，返回走父页兜底，标题是真正的 h1", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");

    expect(masthead, "卷首要读全站册目事实源").toContain("navigationPositionOf");
    expect(masthead, "卷首说明要有册目兜底").toContain("navigation.value?.description");
    expect(masthead, "冷启动返回要走 goBack 的父页兜底").toContain("goBack(router");
    expect(masthead, "页面主标题必须是 h1").toContain("<h1");
    expect(masthead, "运行时判据要能定位卷首").toContain("data-folio-masthead");
    expect(masthead, "右侧动作要独立成槽").toContain('<slot name="action"');
    expect(masthead, "卷首读数要独立成槽").toContain('<slot name="meta"');
    expect(masthead, "卷首要从同一册目位置生成册次水印").toContain("folioOrdinal");
  });

  it("极窄档动作落整行，不把册名与说明挤成竖排", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const css = source("src/style.css");

    expect(masthead).toContain("tinylens:w-full");
    expect(css).toContain(".folio-masthead");
    expect(css).toContain(".folio-masthead::after");
  });

  it("桌面卷首改成开页题签，只留卷边与切口，不再叠一张厚卡", () => {
    const css = source("src/style.css");

    expect(css, "桌面卷首要有独立册次水印").toContain(".folio-masthead__ordinal");
    expect(css, "宽屏题签要撤掉右侧框线").toMatch(
      /\.app-shell\[data-game-shell="desk"\] \.folio-masthead \{[\s\S]{0,260}?border-right:\s*0;/,
    );
    expect(css, "宽屏题签要保留世界卷边").toMatch(
      /\.app-shell\[data-game-shell="desk"\] \.folio-masthead \{[\s\S]{0,260}?border-left:\s*2px solid var\(--world-bar\);/,
    );
    expect(css, "宽屏题签不再投出卡片阴影").toMatch(
      /\.app-shell\[data-game-shell="desk"\] \.folio-masthead \{[\s\S]{0,300}?box-shadow:\s*none;/,
    );
    expect(css, "桌面把角贴让给开页切口").toMatch(
      /\.app-shell\[data-game-shell="desk"\] \.folio-masthead::after \{[\s\S]{0,80}?display:\s*none;/,
    );
  });

  it("详情页族全部换用同一枚卷首，不再各手搓一条返回线与标题", () => {
    const pages = [
      "DongfuView",
      "MarketView",
      "SoulsView",
      "ApprenticeView",
      "CelestialView",
      "SettingsView",
      "CollectionView",
      "TitlesView",
      "BuildView",
      "RealmCodexView",
      "LegacyView",
    ];

    for (const page of pages) {
      const src = source(`src/views/${page}.vue`);
      expect(src, `${page} 还没接册页卷首`).toContain("<FolioPageHeader");
      expect(src, `${page} 没导入卷首组件`).toContain(
        'import FolioPageHeader from "@/components/common/FolioPageHeader.vue"',
      );
    }
  });

  it("卷首渐变纸上的说明改用中墨，不再用最低墨档勉强压线", () => {
    const home = source("src/views/HomeView.vue");
    const world = source("src/views/MortalWorldView.vue");

    expect(home, "天时说明与影响行要能在渐变卷首上稳定读到").toMatch(
      /class="[^"]*text-ink-soft[^"]*"[^>]*>\s*\{\{ weather\.desc/,
    );
    expect(home, "天时影响行不再把石青小字压在渐变纸上").toMatch(
      /weatherModText[\s\S]{0,100}class="[^"]*text-ink-soft/,
    );
    expect(world, "换界代价要在渐变卷首上稳定读到").toMatch(
      /换界即换路[\s\S]{0,160}class="[^"]*text-ink-soft/,
    );
  });

  it("需要父页的卷首都把兜底去向写清楚", () => {
    const expected: Record<string, string> = {
      DongfuView: 'back-to="home"',
      MarketView: 'back-to="dongfu"',
      SoulsView: 'back-to="celestial"',
      ApprenticeView: 'back-to="dongfu"',
      CelestialView: 'back-to="home"',
      SettingsView: 'back-to="home"',
      CollectionView: 'back-to="character"',
      TitlesView: 'back-to="character"',
      BuildView: 'back-to="character"',
      RealmCodexView: 'back-to="character"',
      LegacyView: 'back-to="character"',
    };

    for (const [page, marker] of Object.entries(expected)) {
      expect(source(`src/views/${page}.vue`), `${page} 的返回兜底去向丢了`).toContain(marker);
    }
  });
});
