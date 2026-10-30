import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("册页装帧 · 全站导航与浮层共用一套书页语言", () => {
  it("弹窗是带卷目题签的册页，关闭动作写成合卷而不是通用图标", () => {
    const modal = source("src/components/common/BaseModal.vue");
    const css = source("src/style.css");

    expect(modal, "弹窗根节点要能被装帧判据定位").toContain("data-folio-modal");
    expect(modal, "题签要先报当前分卷").toContain("data-folio-modal-section");
    expect(modal, "关闭键要有可辨识的合卷字形").toContain(">合<");
    expect(modal, "合卷按钮仍要有可访问名").toContain('aria-label="关闭"');
    expect(css, "弹窗装帧要有独立样式入口").toContain(".folio-modal");
  });

  it("页签是书口索引签：连续栏线 + 方角索引，不再是一枚滑动胶囊", () => {
    const tabs = source("src/components/common/InkTabs.vue");
    const css = source("src/style.css");

    expect(tabs, "页签根节点要能被装帧判据定位").toContain("data-folio-tabs");
    expect(tabs, "索引签需要独立结构类").toContain("folio-tab-index");
    expect(tabs, "当前索引签要留一道朱砂落款").toContain("folio-tab-index__marker");
    expect(tabs, "索引签不再套通用卡片").not.toContain("card-ink");
    expect(tabs, "索引签不再用圆角滑块").not.toContain("rounded-md");
    expect(css, "索引签要有独立样式").toContain(".folio-tab-index");
  });

  it("底栏是五枚书脚签：当前册抬为纸面，其余压回栏内", () => {
    const dock = source("src/components/common/BottomNavigation.vue");
    const css = source("src/style.css");

    expect(dock, "底栏根节点要能被装帧判据定位").toContain("data-folio-dock");
    expect(dock, "每一册都要有书脚签结构").toContain("bottom-dock-slip");
    expect(dock, "当前册要带运行时标记").toContain("data-dock-current");
    expect(css, "书脚签要有独立样式").toContain(".bottom-dock-slip");
    expect(css, "当前书脚签要抬起纸面").toContain(".bottom-dock-slip[data-dock-current]");
  });

  it("玄枢图是按卷展开的册目，而不是两列通用入口卡", () => {
    const atlas = source("src/components/common/NavigationAtlas.vue");
    const css = source("src/style.css");

    expect(atlas, "册目要有连续索引结构").toContain("atlas-index");
    expect(atlas, "每一卷要有卷次标记").toContain("atlas-section__number");
    expect(atlas, "每一册改为单列目录行").toContain("atlas-entry-list");
    expect(atlas, "当前册要留一枚在册印").toContain("atlas-current__seal");
    expect(css, "玄枢图索引要有独立样式").toContain(".atlas-index");
  });

  it("书首、卷首与弹窗共用同一套卷次册次，不再各算各的序号", () => {
    const top = source("src/components/common/TopStatusBar.vue");
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const modal = source("src/components/common/BaseModal.vue");

    expect(top, "顶栏要有独立书首标记").toContain("data-folio-head");
    expect(top, "顶栏卷目要从册目位置读出").toContain("navigationPositionOf");
    expect(top, "顶栏要能标出卷次册次").toContain("data-folio-position");
    expect(masthead, "卷首卷目要从册目位置读出").toContain("navigationPositionOf");
    expect(masthead, "卷首要能标出卷次册次").toContain("data-folio-position");
    expect(modal, "弹窗题签也要读同一份卷次").toContain("navigationPositionOf");
  });

  it("正文页框与节次只有一处出处，页页沿同一条书页基线", () => {
    const css = source("src/style.css");

    expect(css, "常规页要有统一页框").toContain(".folio-page");
    expect(css, "页框要承接纵向节奏").toContain(".folio-page--stack");
    expect(css, "章节要在页内自动编号").toContain(".folio-page .section-title::before");
    expect(css, "节次计数器只能由页框重置").toContain("counter-reset: folio-section");
  });

  it("书首书脊走伪元素，不拿空 span 冒充顶栏文字", () => {
    const top = source("src/components/common/TopStatusBar.vue");
    const css = source("src/style.css");

    expect(top, "装饰书脊不该生成参与顶栏折行判据的空元素").not.toContain("folio-head__spine");
    expect(css, "书脊仍要保留在书首上").toContain(".folio-head::before");
  });

  it("书口索引签的负边距跟页框 gutter 同源，195px 档不越出 4px", () => {
    const css = source("src/style.css");
    const rail = css.match(/^[ \t]*\.tab-rail \{[\s\S]*?^[ \t]*\}/m)?.[0] ?? "";

    expect(rail, "页签栏负边距要跟页框留白同步").toContain("var(--folio-page-gutter, 1rem)");
    expect(rail, "页签栏自身也要用同一份留白").toContain(
      "padding-inline: var(--folio-page-gutter, 1rem);",
    );
  });

  it("玄枢图在 195px 档收紧索引槽，册名与副题不被挤成竖排", () => {
    const atlas = source("src/components/common/NavigationAtlas.vue");
    const css = source("src/style.css");

    expect(atlas, "目录行在极窄档要收紧间距与图标").toContain("tinylens:gap-1.5");
    expect(atlas, "目录行在极窄档要收回横向内边距").toContain("tinylens:px-1");
    expect(atlas, "目录图标在极窄档要缩成 28px").toContain("tinylens:h-7 tinylens:w-7");
    expect(atlas, "册名在极窄档要收字距").toContain("tinylens:tracking-[0.08em]");
    expect(css, "册目索引槽也要让出极窄档的宽度").toContain(
      ".atlas-entry-list {\n    margin-left: 1.5rem;",
    );
  });
});
