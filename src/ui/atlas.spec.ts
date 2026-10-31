import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import {
  atlasEntryCueOf,
  atlasInitialFocusOf,
  atlasJumpIndex,
  atlasSearchResults,
  atlasSectionIdForRoute,
  atlasSearchStatusOf,
  atlasShortcutHintOf,
  atlasVolumeCuesOf,
  isAtlasShortcut,
} from "./atlas";
import { NAVIGATION_SECTIONS } from "./navigation";

const ROOT = resolve(__dirname, "../..");

describe("玄枢图 · 五卷快引", () => {
  it("按当前路由落卷，未入册时回修行卷", () => {
    expect(atlasSectionIdForRoute("home")).toBe("practice");
    expect(atlasSectionIdForRoute("souls")).toBe("belongings");
    expect(atlasSectionIdForRoute("settings")).toBe("fate");
    expect(atlasSectionIdForRoute("not-a-route")).toBe("practice");
    expect(atlasSectionIdForRoute(undefined)).toBe("practice");
  });

  it("左右键循环、Home/End 落到两端，其他键不动游标", () => {
    expect(atlasJumpIndex(0, "ArrowLeft", 5)).toBe(4);
    expect(atlasJumpIndex(4, "ArrowRight", 5)).toBe(0);
    expect(atlasJumpIndex(3, "Home", 5)).toBe(0);
    expect(atlasJumpIndex(1, "End", 5)).toBe(4);
    expect(atlasJumpIndex(2, "Enter", 5)).toBe(2);
    expect(atlasJumpIndex(2, "ArrowRight", 0)).toBe(-1);
  });

  it("桌面首焦点落寻册口，触屏首焦点留当前卷签以免弹软键盘", () => {
    expect(atlasInitialFocusOf(true)).toBe("[data-atlas-search]");
    expect(atlasInitialFocusOf(false)).toBe('[data-atlas-volume][aria-selected="true"]');
  });

  it("按册名、说明、分卷、分册与日常叫法寻册，不另维护一份路径表", () => {
    expect(atlasSearchResults("器魂").map((result) => result.entry.name)).toEqual([
      "inventory",
      "souls",
    ]);
    expect(atlasSearchResults("背包").map((result) => result.entry.name)).toEqual(["inventory"]);
    expect(atlasSearchResults("人物").map((result) => result.entry.name)).toEqual(["character"]);
    expect(atlasSearchResults("存档").map((result) => result.entry.name)).toEqual(["settings"]);
    expect(atlasSearchResults("天机").map((result) => result.entry.name)).toEqual([
      "celestial",
      "build",
      "titles",
      "legacy",
      "settings",
    ]);
    expect(atlasSearchResults("  背 包  ").map((result) => result.entry.name)).toEqual([
      "inventory",
    ]);
    expect(atlasSearchResults("周易")).toMatchObject([
      { entry: { name: "codex" }, chapter: { id: "yi" }, to: "/codex?tab=yi" },
    ]);
    expect(atlasSearchResults("问卦")).toMatchObject([
      { entry: { name: "codex" }, chapter: { id: "yi" }, to: "/codex?tab=yi" },
    ]);
    expect(atlasSearchResults("交货")).toMatchObject([
      { entry: { name: "market" }, chapter: { id: "bounty" }, to: "/market?tab=bounty" },
    ]);
    expect(atlasSearchResults("天机 道果")).toMatchObject([
      { entry: { name: "legacy" }, to: "/legacy" },
    ]);
    expect(atlasSearchResults("不存在的册")).toEqual([]);
    expect(atlasSearchResults("   ")).toEqual([]);
  });

  it("寻册游标的播报带册次、卷名与分册，不只报一个总数", () => {
    const fate = atlasSearchResults("天机");
    expect(
      atlasSearchStatusOf(fate[1], 1, fate.length),
      "第二处要报出「构筑」与 2/5，读屏才知道方向键选中了谁",
    ).toBe("找到 5 处 · 第 2/5 处：天机卷 · 构筑，回车前往");
    const chapter = atlasSearchResults("周易")[0];
    expect(atlasSearchStatusOf(chapter, 0, 1)).toBe(
      "找到 1 处 · 第 1/1 处：行旅卷 · 界域志 · 周易，回车前往",
    );
    expect(
      atlasSearchStatusOf(
        atlasSearchResults("背包")[0],
        0,
        1,
        atlasEntryCueOf("inventory", 6, false),
      ),
      "寻册播报也要带上跨页待办",
    ).toBe("找到 1 处 · 第 1/1 处：身外卷 · 行囊，6 件新物，回车前往");
    expect(atlasSearchStatusOf(undefined, 0, 0)).toBe("");
  });

  it("新货与可破境只在对应册上落章，卷签汇总同一份提醒", () => {
    expect(atlasEntryCueOf("inventory", 0, false)).toBeNull();
    expect(atlasEntryCueOf("inventory", 1, false)).toEqual({
      tone: "bag",
      label: "1 新",
      spoken: "1 件新物",
    });
    expect(atlasEntryCueOf("inventory", 12, false)).toMatchObject({
      label: "9+ 新",
      spoken: "12 件新物",
    });
    expect(atlasEntryCueOf("cultivation", 0, true)).toEqual({
      tone: "breakthrough",
      label: "可破境",
      spoken: "可破境",
    });
    expect(atlasEntryCueOf("character", 6, true)).toBeNull();

    const belongings = NAVIGATION_SECTIONS.find((section) => section.id === "belongings")!;
    const practice = NAVIGATION_SECTIONS.find((section) => section.id === "practice")!;
    expect(atlasVolumeCuesOf(belongings.entries, 6, false)).toMatchObject([
      { tone: "bag", spoken: "6 件新物" },
    ]);
    expect(atlasVolumeCuesOf(practice.entries, 0, true)).toMatchObject([
      { tone: "breakthrough", spoken: "可破境" },
    ]);
    expect(atlasVolumeCuesOf(practice.entries, 0, false)).toEqual([]);
  });

  it("寻册快捷键与平台提示同源", () => {
    expect(isAtlasShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isAtlasShortcut({ key: "K", ctrlKey: false, metaKey: true, altKey: false })).toBe(true);
    expect(isAtlasShortcut({ key: "k", ctrlKey: false, metaKey: false, altKey: false })).toBe(
      false,
    );
    expect(isAtlasShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: true })).toBe(false);
    expect(atlasShortcutHintOf("MacIntel")).toBe("⌘ K");
    expect(atlasShortcutHintOf("Win32")).toBe("Ctrl K");
    expect(atlasShortcutHintOf("")).toBe("Ctrl K");
  });

  it("组件接上五卷快引、卷宗分册与极窄档规则", () => {
    const atlas = readFileSync(resolve(ROOT, "src/components/common/NavigationAtlas.vue"), "utf8");
    const app = readFileSync(resolve(ROOT, "src/App.vue"), "utf8");
    const top = readFileSync(resolve(ROOT, "src/components/common/TopStatusBar.vue"), "utf8");
    const spine = readFileSync(resolve(ROOT, "src/components/common/DesktopSpine.vue"), "utf8");
    const css = readStyleCss();
    const modal = readFileSync(resolve(ROOT, "src/components/common/BaseModal.vue"), "utf8");

    expect(app, "玄枢图要由应用外壳统一挂载，不再锁在顶栏里").toContain("<NavigationAtlas");
    expect(app, "全局快捷键要走同一枚寻册命令").toContain("isAtlasShortcut");
    expect(app, "有别的弹窗时不许抢走快捷键").toContain("hasOpenModal");
    expect(top, "顶栏只发开图意图，不私藏第二份开合状态").toContain("emit('openAtlas')");
    expect(top, "顶栏不再自己挂载玄枢图").not.toContain("<NavigationAtlas");
    expect(spine, "宽屏书脊要有寻册入口").toContain("data-spine-atlas-trigger");
    expect(spine, "宽屏书脊入口要发同一件事").toContain("emit('openAtlas')");
    expect(atlas, "顶栏的玄枢图要有五卷快引").toContain("data-atlas-compass");
    expect(atlas, "每一卷要有可点击的快引").toContain("data-atlas-volume");
    expect(atlas, "快引要有明确的目标关系").toContain(":aria-controls");
    expect(atlas, "五卷快引要被读屏认成一组卷签").toContain('role="tablist"');
    expect(atlas, "当前卷要报出选中状态").toContain(":aria-selected");
    expect(atlas, "每卷仍要完整铺出册目").toContain("data-atlas-section");
    expect(atlas, "当前卷要留可见落点").toContain("data-atlas-section-current");
    expect(atlas, "五卷快引要支持键盘游标").toContain("atlasJumpIndex");
    expect(atlas, "切卷只换单卷册页，不再沿用旧长列表的滚动跳转").toContain(
      "function activateVolume",
    );
    expect(atlas, "切卷不许把卷签与寻册口滚出视口").not.toContain("scrollTo({ top");
    expect(atlas, "总图要先给人一枚寻册口").toContain("data-atlas-search");
    expect(atlas, "检索结果仍落真实路由链接").toContain("data-atlas-result");
    expect(atlas, "分册检索要带 tab 直落到册内页码").toContain("result.chapter");
    expect(atlas, "分册检索仍读同一份册目").toContain("atlasSearchResults");
    expect(atlas, "检索为空要给出下一步，不只是一块空白").toContain("data-atlas-empty");
    expect(atlas, "中文输入法组合期间不许把回车当成翻册").toContain("event.isComposing");
    expect(atlas, "桌面总图要能比普通弹窗更宽").toContain('size="max"');
    expect(atlas, "总图面板要挂独立案台样式").toContain("panel-class");
    expect(atlas, "总图首焦点要按输入设备分流").toContain(":initial-focus");
    expect(atlas, "桌面焦点落寻册口、触屏留当前卷签").toContain("atlasInitialFocusOf");
    expect(atlas, "搜索结果游标要由同一句播报").toContain("atlasSearchStatusOf");
    expect(atlas, "寻册口与卷宗要接底栏、书脊同一份跨页提醒").toContain("useNavigationSignals");
    expect(atlas, "卷签要汇总本卷待办而不只靠点开后才看见").toContain("data-atlas-volume-cue");
    expect(atlas, "册目条要在对应册上直接落章").toContain("data-atlas-entry-cue");
    expect(atlas, "寻册结果保留同一枚待办章").toContain("data-atlas-result-cue");
    expect(atlas, "触屏不再展示按不出的键盘快捷键").toContain('v-if="finePointer"');
    expect(modal, "弹窗原语要支持总图宽度").toContain('props.size === "max"');
    expect(modal, "弹窗原语要支持指定首焦点").toContain("initialFocus");
    expect(modal, "弹窗原语要允许调用方追加面板样式").toContain("panelClass");
    expect(css, "五卷快引要有独立样式").toContain(".atlas-compass");
    expect(css, "寻册口要有独立样式").toContain(".atlas-search");
    expect(css, "书脊寻册入口要有独立样式").toContain(".desktop-spine__lookup");
    expect(css, "桌面总图要把卷目与当前卷宗并读").toMatch(
      /@media \(min-width: 720px\)[\s\S]{0,1600}?\.atlas-browser[\s\S]{0,220}?grid-template-columns:/,
    );
    expect(css, "195px 档五卷快引改两列，末卷跨满整行").toMatch(
      /@media \(max-width: 220px\)[\s\S]*?\.atlas-compass\s*\{[\s\S]{0,180}?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]{0,900}?\.atlas-volume:last-child\s*\{[\s\S]{0,100}?grid-column:\s*1\s*\/\s*-1;/,
    );
    expect(css, "195px 档要收住五卷快引字距").toContain(".atlas-volume__label");
  });
});
