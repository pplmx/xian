import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("册页卷首 · 一页只讲清一件事", () => {
  it("卷首从玄枢图读分卷与说明，返回走父页兜底，标题是真正的 h1", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");

    expect(masthead, "卷首要读全站册目事实源").toContain("navigationEntryOf");
    expect(masthead, "卷首说明要有册目兜底").toContain("navigation.value?.description");
    expect(masthead, "冷启动返回要走 goBack 的父页兜底").toContain("goBack(router");
    expect(masthead, "页面主标题必须是 h1").toContain("<h1");
    expect(masthead, "运行时判据要能定位卷首").toContain("data-folio-masthead");
    expect(masthead, "右侧动作要独立成槽").toContain('<slot name="action"');
    expect(masthead, "卷首读数要独立成槽").toContain('<slot name="meta"');
  });

  it("极窄档动作落整行，不把册名与说明挤成竖排", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const css = source("src/style.css");

    expect(masthead).toContain("tinylens:w-full");
    expect(css).toContain(".folio-masthead");
    expect(css).toContain(".folio-masthead::after");
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
