import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
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
    expect(app, "外壳宽度与朝向交给样式层，工具类不能压死桌面书桌").not.toContain("max-w-107.5");
    expect(css, "手机册宽由 .app-shell 自己兜底").toMatch(
      /\.app-shell\s*\{[\s\S]{0,180}?max-width:\s*26\.875rem;/,
    );
    expect(app, "手机不挂载整份桌面目录,不能只靠 CSS 藏起来").toMatch(
      /<DesktopSpine\s+v-if="game\.started && route\.name !== 'create' && desktopSpineVisible"/,
    );
    expect(app, "书脊结构断点与样式共用 960px 口径").toContain(
      'useMediaQuery("(min-width: 960px)")',
    );
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

  it("1280 级桌面把五卷摊成两列,十七册与末卷都在一屏目录里", () => {
    const css = source("src/style.css");

    expect(css, "两列总目要晚于 1100 的单列展开").toMatch(
      /@media \(min-width: 1200px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    );
    expect(css, "左列收修行、道场、行旅").toContain(".desktop-spine__section:nth-child(3)");
    expect(css, "右列从身外卷起").toContain(
      '.desktop-spine__section[data-spine-section="belongings"]',
    );
    expect(css, "末卷天机要固定在右侧第二段").toContain(
      '.desktop-spine__section[data-spine-section="fate"]',
    );
    expect(css, "两列里的单条目录仍保 28px 触达").toMatch(
      /\.desktop-spine__entry\s*\{[\s\S]{0,80}?min-height:\s*28px;/,
    );
  });

  it("展开书脊后顶栏退场，身份、资源与设置都由书脊常驻", () => {
    const spine = source("src/components/common/DesktopSpine.vue");
    const css = source("src/style.css");

    expect(spine, "书脊要接资源账").toContain("useResourcesStore");
    expect(spine, "灵石与灵气要各留可定位读数").toContain('title="灵石"');
    expect(spine, "灵石与灵气要各留可定位读数").toContain('title="灵气"');
    expect(spine, "顶栏撤下后设置仍要有常驻入口").toContain('to="/settings"');
    expect(css, "窄桌面书脊只露图标时仍由顶栏报身份").toMatch(
      /@media \(min-width: 1100px\)[\s\S]*?\.app-shell\[data-game-shell="desk"\] \.folio-head\s*\{[\s\S]{0,80}?display:\s*none;/,
    );
  });

  it("真浏览器门逐页核书脊可见、十七册齐全且底栏已退场", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("desktopSpineSeen");
    expect(layout).toContain("桌面书脊没有出现");
    expect(layout).toContain("桌面仍留着手机底栏");
    expect(layout).toContain("桌面书脊册目不全");
    expect(layout).toContain("桌面书脊随身账没有出现");
    expect(layout).toContain("桌面书脊还有册目藏在滚动区外");
  });
});
