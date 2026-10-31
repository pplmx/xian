import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { folioArrivalTextOf } from "./folioArrival";
import { folioTurnDirectionOf } from "./folioTurn";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function vueFiles(dir = resolve(ROOT, "src")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.isFile() && entry.name.endsWith(".vue") ? [path] : [];
  });
}

describe("册页装帧 · 全站导航与浮层共用一套书页语言", () => {
  it("全站翻卷按玄枢目录辨前后，开局与未知页才走横向开卷", () => {
    expect(folioTurnDirectionOf("home", "cultivation")).toBe("forward");
    expect(folioTurnDirectionOf("cultivation", "home")).toBe("back");
    expect(folioTurnDirectionOf("souls", "celestial")).toBe("forward");
    expect(folioTurnDirectionOf("celestial", "souls")).toBe("back");
    expect(folioTurnDirectionOf("welcome", "home")).toBe("cross");
    expect(folioTurnDirectionOf("home", "home")).toBe("cross");
  });

  it("路由壳接上方向化翻卷，前进、回翻与开卷各有独立过渡", () => {
    const app = source("src/App.vue");
    const css = source("src/style.css");

    expect(app, "翻卷方向要读共享目录").toContain("folioTurnDirectionOf");
    expect(app, "路由过渡名要由方向生成").toContain(':name="turnName"');
    expect(app, "导航完成后更新方向").toContain("router.afterEach");
    expect(app, "外壳要留下运行时方向标记").toContain(':data-folio-turn="turnDirection"');
    expect(css).toContain(".folio-turn-forward-enter-from");
    expect(css).toContain(".folio-turn-back-enter-from");
    expect(css).toContain(".folio-turn-cross-enter-from");
  });

  it("翻页后由玄枢册目同源播报落点，键盘可越过导航直入正文", () => {
    const app = source("src/App.vue");
    const css = source("src/style.css");
    const index = source("index.html");

    expect(folioArrivalTextOf("settings")).toBe("已翻至第五卷「天机」第五册「设置」");
    expect(folioArrivalTextOf("welcome")).toBe("");
    expect(folioArrivalTextOf(undefined)).toBe("");
    expect(app, "路由落点要交给 polite 播报区").toContain("data-folio-arrival");
    expect(app, "播报区不能抢读屏当前操作").toContain('aria-live="polite"');
    expect(app, "翻页后要更新同一份玄枢报词").toContain("folioArrivalTextOf(to.name)");
    expect(app, "键盘要先能越过书脊与底栏").toContain("data-folio-skip-link");
    expect(app, "直入正文要落到真实滚动宿主").toContain('id="folio-main"');
    expect(app, "正文焦点不能触发浏览器滚动").toContain(
      "scrollHost.value?.focus({ preventScroll: true })",
    );
    expect(app, "入卷后要把顺序焦点起点交还正文起始处").toMatch(
      /from\.name === "create"[\s\S]{0,160}document\.body\.focus\(\{ preventScroll: true \}\)/,
    );
    expect(index, "body 要能被程序化聚焦，body.focus() 才不会静默失败").toContain(
      '<body tabindex="-1">',
    );
    expect(css, "跳读入口只在键盘聚焦时展开").toContain(".folio-skip-link:focus-visible");
    expect(css, "跳读入口要有独立书签形制").toContain(".folio-skip-link");
    expect(
      css.match(/\.folio-skip-link \{[\s\S]*?\}/)?.[0],
      "键盘焦点提示不能等过渡跑完才出现",
    ).not.toContain("transition:");
  });

  it("事件浮层不抢首屏带宽：正文与楷体落定后才按需装载", () => {
    const app = source("src/App.vue");

    expect(app, "重浮层要按需拆块").toContain("defineAsyncComponent");
    expect(app, "浮层组等正文与字体落定后再挂").toMatch(
      /<template v-if="overlaysReady">[\s\S]{0,1200}<OfflineRewardDialog/,
    );
    expect(app, "挂载时机读浏览器字体就绪").toContain("document.fonts?.ready");
    expect(app, "装备详情不再随 App 静态进首屏").not.toContain(
      'import EquipmentDetailDialog from "@/components/equipment/EquipmentDetailDialog.vue"',
    );
    expect(app, "归来卷轴不再随 App 静态进首屏").not.toContain(
      'import OfflineRewardDialog from "@/components/offline/OfflineRewardDialog.vue"',
    );
  });

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
    const layout = source("scripts/layout-check.mjs");
    const css = source("src/style.css");

    expect(dock, "底栏根节点要能被装帧判据定位").toContain("data-folio-dock");
    expect(dock, "每一册都要有书脚签结构").toContain("bottom-dock-slip");
    expect(dock, "当前册要带运行时标记").toContain("data-dock-current");
    expect(dock, "平板不让五枚书脚签随宽页拉成一条长栏").toContain("max-w-[40rem]");
    expect(dock, "收束后的书脚索引要在栏内居中").toContain("mx-auto");
    expect(dock, "底栏要有独立可访问名").toContain('aria-label="主册导航"');
    expect(css, "书脚签要有独立样式").toContain(".bottom-dock-slip");
    expect(css, "当前书脚签要抬起纸面").toContain(".bottom-dock-slip[data-dock-current]");
    expect(layout, "真浏览器要核平板底栏书脚索引没有拉满宽页").toContain(
      "平板底栏书脚索引没有按 40rem 上限与可用宽度收束",
    );
    expect(layout, "收束后的书脚索引必须居中").toContain("平板底栏书脚索引没有居中");
  });

  it("手机外壳是一册连续卷面：深色书口夹住正文，不再叠两张浅色导航卡", () => {
    const app = source("src/App.vue");
    const top = source("src/components/common/TopStatusBar.vue");
    const dock = source("src/components/common/BottomNavigation.vue");
    const toast = source("src/components/common/ToastHost.vue");
    const css = source("src/style.css");

    expect(app, "外壳不再把手机宽度交给通用投影卡工具类").not.toContain(
      "shadow-[0_0_60px_rgba(0,0,0,0.45)]",
    );
    expect(top, "书首用独立的书口带结构").toContain("folio-head--ribbon");
    expect(top, "位置仍读同一份玄枢落点").toContain("data-folio-position");
    expect(top, "手机书首不再保留第二行位置签").not.toContain("data-folio-trail");
    expect(dock, "书脚导航要有同一套书口带结构").toContain("folio-dock");
    expect(css, "书口带颜色只从设计变量取").toContain("--chrome-rgb");
    expect(css, "书首落深色书口").toContain(".folio-head--ribbon");
    expect(css, "底栏落深色书口").toContain(".folio-dock");
    expect(css, "手机外壳贴满阅读面，不再像浮在桌面上的卡片").toMatch(
      /\.app-shell\s*\{[\s\S]{0,400}?isolation:\s*isolate;[\s\S]{0,160}?box-shadow:\s*none;/,
    );
    expect(toast, "全局提示条要跳出书壳 isolation，打开弹窗时仍能点击").toContain(
      '<Teleport to="body">',
    );
    expect(css, "620px 起才把外壳当独立宽叶托起").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,200}?\.app-shell\s*\{[\s\S]{0,200}?box-shadow:/,
    );
    for (const [selector, label] of [
      [".folio-head--ribbon", "书首"],
      [".folio-dock", "书脚"],
    ] as const) {
      const block =
        new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n  \\}`).exec(
          css,
        )?.[1] ?? "";
      expect(block, `${label}要有带内压线`).toMatch(/box-shadow:\s*inset 0 1px 0/);
      expect(block, `${label}不许向正文投外影，免得压暗贴着书口的小字`).not.toMatch(
        /box-shadow:[\s\S]*?\n\s*0\s+-?\d+(?:\.\d+)?px/,
      );
    }
  });

  it("玄枢图是一张可翻的五卷案台，而不是三层总目卡片叠在一起", () => {
    const atlas = source("src/components/common/NavigationAtlas.vue");
    const css = source("src/style.css");

    expect(atlas, "五卷与卷宗要收进同一张案台").toContain("atlas-browser");
    expect(atlas, "五卷要有总目快引").toContain("atlas-compass");
    expect(atlas, "快引要逐卷落点").toContain("data-atlas-volume");
    expect(atlas, "册目仍要完整铺成卷宗").toContain("atlas-index");
    expect(atlas, "每一卷要有卷次标记").toContain("atlas-section__number");
    expect(atlas, "每一册改为单列目录行").toContain("atlas-entry-list");
    expect(atlas, "当前落点要压成一条册口签").toContain("data-atlas-location");
    expect(atlas, "当前册要有读屏可辨认的页签面板").toContain('role="tabpanel"');
    expect(atlas, "只展开当前卷，其余卷宗保留在 DOM 中供检索").toContain(
      'v-show="activeVolumeId === group.id"',
    );
    expect(css, "五卷总目要有独立样式").toContain(".atlas-compass");
    expect(css, "卷宗分册要有独立样式").toContain(".atlas-index");
    expect(css, "桌面案台把卷目与册页并成两栏").toMatch(
      /@media \(min-width: 720px\)[\s\S]{0,1600}?\.atlas-browser\s*\{[\s\S]{0,160}?grid-template-columns:/,
    );
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
    expect(css, "页框上缘要给首屏行动让出 10px，而不是层层加白").toMatch(
      /\.folio-page\s*\{[\s\S]{0,180}?padding:\s*0\.625rem var\(--folio-page-gutter\) 1\.5rem;/,
    );
    expect(css, "页框要承接纵向节奏").toContain(".folio-page--stack");
    expect(css, "章节要在页内自动编号").toContain(".folio-page .folio-section-mark::before");
    expect(css, "旧的双笔章节头不该继续和栏号签叠成三重记号").not.toContain(
      ".folio-page .section-title::before",
    );
    expect(css, "节次计数器只能由页框重置").toContain("counter-reset: folio-section");
  });

  it("章节头只有一个组件出处，眉题、标题、副读与动作席沿同一条栏号", () => {
    const title = source("src/components/common/SectionTitle.vue");
    const cultivation = source("src/views/CultivationView.vue");
    const inventory = source("src/views/InventoryView.vue");
    const css = source("src/style.css");

    expect(title, "章节头要有统一运行时标记").toContain("data-folio-chapter-head");
    expect(title, "栏号仍由页内 counter 生成").toContain("data-folio-section-mark");
    expect(title, "章首支持可选眉题").toContain('v-if="eyebrow"');
    expect(title, "章首支持右侧动作席").toContain('<slot name="actions" />');
    expect(cultivation, "修炼账走同一个章节头").toContain("<SectionTitle");
    expect(inventory, "行囊检点走同一个章节头").toContain("<SectionTitle");
    expect(cultivation, "不再另造第二套章首组件").not.toContain("<FolioChapterHeader");
    expect(inventory, "不再另造第二套章首组件").not.toContain("<FolioChapterHeader");
    expect(css, "极窄档动作席落到整行").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,300}?\.folio-chapter-head__actions\s*\{[\s\S]{0,120}?flex:\s*1 0 100%;/,
    );
  });

  it("册页内不再保留 App 式中圆角，纸片只留 2px 方倒角", () => {
    const banned = /^(?:rounded|rounded-(?:md|lg|xl|2xl|3xl))$/;
    const offenders: string[] = [];

    for (const file of vueFiles()) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/class="([^"]*)"/g)) {
        for (const token of match[1]!.split(/\s+/)) {
          if (!banned.test(token)) continue;
          offenders.push(
            `${file.slice(ROOT.length + 1)}:${text.slice(0, match.index).split("\n").length}`,
          );
        }
      }
    }

    expect(offenders, `仍在中圆角:${offenders.join(", ")}`).toEqual([]);
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

  it("玄枢图在 195px 档收住五卷与册目，不把卷名与副题挤成竖排", () => {
    const atlas = source("src/components/common/NavigationAtlas.vue");
    const css = source("src/style.css");

    expect(atlas, "五卷快引在极窄档要收字距").toContain("tinylens:tracking-[0.06em]");
    expect(atlas, "目录行在极窄档要收紧间距与图标").toContain("tinylens:gap-1.5");
    expect(atlas, "目录行在极窄档要收回横向内边距").toContain("tinylens:px-1");
    expect(atlas, "目录图标在极窄档要缩成 28px").toContain("tinylens:h-7 tinylens:w-7");
    expect(atlas, "册名在极窄档要收字距").toContain("tinylens:tracking-[0.08em]");
    expect(css, "卷宗题头与目录行在极窄档要收回内边距").toMatch(
      /\.atlas-section__head \{\n\s+padding-inline: 0\.5rem;/,
    );
  });

  it("未开启册页是封卷页：报当前境界、门限与尚隔，不再只剩一块大白卡", () => {
    const sealed = source("src/components/common/UnopenedFolio.vue");
    const celestial = source("src/views/CelestialView.vue");
    const souls = source("src/views/SoulsView.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(sealed, "封卷页要能被运行时与判据定位").toContain("data-unopened-folio");
    expect(sealed, "封卷页要报当前境界").toContain("currentRealm");
    expect(sealed, "封卷页要报开启门限").toContain("gateRealm");
    expect(sealed, "封卷页要把尚隔几重境摊开").toContain("remainingMajors");
    expect(sealed, "封卷页的进度要与境界差同源").toContain("progress");
    expect(sealed, "封卷页要有下一步入口").toContain('to="/cultivation"');
    expect(sealed, "封卷页要有境界谱入口").toContain('to="/codex"');
    expect(sealed, "封卷页要有读屏隐藏的氛围层").toContain('aria-hidden="true"');

    expect(celestial, "天界未开启要走同一枚封卷页").toContain("<UnopenedFolio");
    expect(souls, "器魂未开启要走同一枚封卷页").toContain("<UnopenedFolio");
    expect(celestial, "天界不再保留旧的通用空白卡").not.toContain(
      '<div v-if="!unlocked" class="card-ink px-6 py-16 text-center">',
    );
    expect(souls, "器魂不再保留旧的通用空白卡").not.toContain(
      '<div v-if="!unlocked" class="card-ink px-6 py-16 text-center">',
    );
    expect(layout, "真浏览器门要核封卷页真的渲染出来").toContain("封卷页没有渲染出来");
  });

  it("封卷页的门槛读数取境界事实源，不把「真仙境」与九重差各抄一份", () => {
    const sealed = source("src/components/common/UnopenedFolio.vue");
    const celestial = source("src/views/CelestialView.vue");
    const souls = source("src/views/SoulsView.vue");

    expect(sealed, "尚隔几重由 currentMajor / gateMajor 计算").toContain(
      "props.gateMajor - props.currentMajor",
    );
    expect(sealed, "进度也由同一对境界计算").toContain("props.currentMajor / props.gateMajor");
    expect(celestial, "天界门限读 WORLD_BREAK_MAJOR").toContain("WORLD_BREAK_MAJOR");
    expect(souls, "器魂门限读 WORLD_BREAK_MAJOR").toContain("WORLD_BREAK_MAJOR");
    expect(souls, "器魂槽位数不手抄，读 SOUL_SLOTS").toContain("${SOUL_SLOTS}");
  });

  it("像素对比度采样不许替换会每秒刷新的文本节点", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout, "采样要按元素挂 data-pixel-probe").toContain('el.dataset.pixelProbe = "1"');
    expect(layout, "隐藏文字要用透明填色,不能换掉 Vue 的文本节点").not.toContain(
      "node.parentNode.replaceChild(span, node)",
    );
    expect(layout, "截图后要撤掉采样标记").toContain(
      'document.querySelectorAll("[data-pixel-probe]")',
    );
  });
});
