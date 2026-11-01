import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css)?.[1] ?? "";
}

describe("玄枢视觉 v2 · 连续卷面与星图册页", () => {
  it("手机外壳不再用上下深墨书口冒充装帧", () => {
    const top = source("src/components/common/TopStatusBar.vue");
    const dock = source("src/components/common/BottomNavigation.vue");
    const css = source("src/style.css");

    expect(top, "书首要换成透明天幕带").toContain("folio-head--aether");
    expect(top, "旧深墨书口不再留在模板里").not.toContain("folio-head--ribbon");
    expect(dock, "底栏要换成章印式导航").toContain("folio-dock--seal-rail");
    expect(rule(css, ".folio-head--aether"), "书首必须直接落在连续纸面").toContain(
      "background: transparent;",
    );
    expect(rule(css, ".folio-dock--seal-rail"), "底栏不再铺整条深色封皮").toContain(
      "background: transparent;",
    );
    expect(css, "书口固定深色带不再作为公共外壳底").not.toMatch(
      /\.folio-head--ribbon\s*\{[\s\S]{0,240}?background:\s*linear-gradient\(180deg,\s*rgb\(var\(--chrome-rgb\)\)/,
    );
  });

  it("公共页首、章节、总账与卡片回到纸面，不套第二层方框", () => {
    const css = source("src/style.css");
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const modal = source("src/components/common/BaseModal.vue");

    expect(rule(css, ".folio-masthead"), "卷首应是开页题签，不是压在正文上的卡片").toMatch(
      /border:\s*0;/,
    );
    expect(rule(css, ".folio-masthead"), "卷首要直接落在连续纸面").toContain(
      "background: transparent;",
    );
    expect(css, "卷首不再画四边内框").not.toContain(".folio-masthead::before");
    expect(masthead, "卷首印章不再用通用方框工具类").not.toContain("border border-ink/20");

    expect(rule(css, ".card-ink"), "通用卡片改成无边纸笺").toMatch(/border:\s*0;/);
    expect(rule(css, ".card-ink"), "通用卡片不再靠投影浮起").toContain("box-shadow: none;");
    expect(css, "通用卡片不再画四边内框").not.toContain(".card-ink::before");

    expect(rule(css, ".folio-ledger-pulse"), "此刻账改成开口账页").toMatch(/border:\s*0;/);
    expect(rule(css, ".folio-ledger-pulse"), "此刻账不再复制一张卡片底").toContain(
      "background: transparent;",
    );

    expect(modal, "弹窗不再套四边框工具类").not.toContain("border border-ink/20");
    expect(rule(css, ".folio-modal"), "弹窗要成为悬浮卷面而非方卡").toMatch(/border:\s*0;/);
  });

  it("页签、索引签与书脊只保留底线、留白与当前落款", () => {
    const tabs = source("src/components/common/InkTabs.vue");
    const css = source("src/style.css");

    expect(tabs, "页签外壳不再用上下边框与整块纸底").not.toContain(
      "border-y border-ink/15 bg-paper/90",
    );
    expect(rule(css, ".folio-tab-index"), "页签只留一道下缘书口").toMatch(
      /border:\s*0;[\s\S]*?border-bottom:/,
    );
    expect(rule(css, ".desktop-spine"), "书脊不再像另一张实心卡片").toContain(
      "background: transparent;",
    );
    expect(css, "桌面外壳撤掉浏览器窗口般的厚边与投影").toMatch(
      /\.app-shell\[data-game-shell="desk"\]\s*\{[\s\S]{0,420}?box-shadow:\s*none;/,
    );
  });

  it("首页暗场是全出血主舞台，下方的道途与日课不再贴着卡片边", () => {
    const home = source("src/styles/pages/home.css");

    expect(rule(home, ".home-deck__hero"), "主舞台要去掉四边框").toMatch(/border:\s*0;/);
    expect(rule(home, ".home-deck__hero"), "主舞台要从页边铺满").toContain(
      "margin-inline: calc(var(--folio-page-gutter, 1rem) * -1);",
    );
    expect(rule(home, ".home-card"), "长期道途与日课回到连续纸面").toMatch(/border:\s*0;/);
    expect(rule(home, ".home-card"), "纸面段落不再投卡片阴影").toContain("box-shadow: none;");
    expect(rule(home, ".home-card"), "纸面段落不再铺整块卡片底").toContain(
      "background: transparent;",
    );
    expect(rule(home, ".home-daily__row"), "日课行改成账线，不再一格格套框").toMatch(
      /border:\s*0;[\s\S]*?border-bottom:/,
    );
    expect(rule(home, ".home-passage"), "门径改成开口入口，不再画四边卡片").toMatch(/border:\s*0;/);
  });

  it("设计规范把这套语言写成唯一出处", () => {
    const design = source("docs/design.md");

    expect(design.includes("## 玄枢视觉 v2：天穹卷"), "设计规范缺少视觉 v2 章节").toBe(true);
    expect(
      design.includes("不再用整条深墨书口夹住正文"),
      "设计规范仍把深墨上下书口写成当前语言",
    ).toBe(true);
    expect(design.includes("一个页面最多一层容器边"), "设计规范缺少去嵌套的硬约束").toBe(true);
  });
});
