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
});
