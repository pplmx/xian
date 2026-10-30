import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("桌面书脊 · 宽屏从手机底栏改为整册目录", () => {
  it("书脊读全站同一份十七册目录，而不是另抄一排主导航", () => {
    const spine = source("src/components/common/DesktopSpine.vue");

    expect(spine, "书脊根节点要能被运行时判据定位").toContain("data-desktop-spine");
    expect(spine, "书脊目录要读全站唯一事实源").toContain("NAVIGATION_SECTIONS");
    expect(spine, "每一册都要能直接前往").toContain("<RouterLink");
    expect(spine, "当前册要留可见落点").toContain("data-spine-current");
    expect(spine, "书脊需要独立的读屏导航名").toContain('aria-label="全站册目"');
  });

  it("新货与可破境提醒跟着桌面导航走，不从宽屏消失", () => {
    const spine = source("src/components/common/DesktopSpine.vue");
    const dock = source("src/components/common/BottomNavigation.vue");
    const signals = source("src/composables/useNavigationSignals.ts");

    expect(signals, "导航提醒要有共用来源").toContain("newItemCount");
    expect(signals, "破境提醒仍读同一个判据").toContain("breakthroughInfo().ready");
    expect(spine, "桌面书脊要接共用提醒").toContain("useNavigationSignals");
    expect(dock, "手机底栏也要接同一份提醒").toContain("useNavigationSignals");
  });

  it("游戏态桌面外壳改成书脊 + 正文两列，手机仍保留底栏", () => {
    const app = source("src/App.vue");
    const css = source("src/style.css");

    expect(app, "应用外壳要真的挂上书脊").toContain("<DesktopSpine");
    expect(css).toMatch(/@media \(min-width: 960px\)[\s\S]*?\.app-shell\[data-game-shell="desk"\]/);
    expect(css).toContain("grid-template-areas:");
    expect(css).toContain(".desktop-spine");
    expect(css, "桌面不再使用手机底栏").toMatch(
      /\.app-shell\[data-game-shell="desk"\] \[data-folio-dock\][\s\S]{0,120}?display: none;/,
    );
  });

  it("960 宽先收起成图标书脊，1100 以上再展开册名与卷目", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /@media \(min-width: 960px\)[\s\S]*?grid-template-columns:\s*4\.25rem minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1100px\)[\s\S]*?grid-template-columns:\s*14rem minmax\(0, 1fr\)/,
    );
    expect(css, "展开后要显示卷目与册名").toContain(".desktop-spine__copy");
    expect(css, "收起态只留图标").toContain(".desktop-spine__entry-copy");
  });

  it("桌面书首让位给当前卷册，玩家身份由书脊承担", () => {
    const top = source("src/components/common/TopStatusBar.vue");
    const css = source("src/style.css");

    expect(top, "桌面书首要能显示当前卷册").toContain("folio-head__desktop-context");
    expect(css, "展开书脊后隐藏重复的玩家身份").toContain(".folio-head__identity");
    expect(css, "窄桌面仍保留身份与玄枢入口").toContain("@media (min-width: 1100px)");
  });

  it("真浏览器门逐页核书脊可见、十七册齐全且底栏已退场", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("desktopSpineSeen");
    expect(layout).toContain("桌面书脊没有出现");
    expect(layout).toContain("桌面仍留着手机底栏");
    expect(layout).toContain("桌面书脊册目不全");
  });
});
