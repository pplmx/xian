/**
 * 主题服务单测 —— 日间/夜间/跟随系统
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { applyTheme, initTheme } from "./theme";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 最小 document stub(theme.ts 用 documentElement.dataset + meta[name=theme-color]) */
const docEl = {
  _theme: "",
  dataset: {} as Record<string, string>,
  setAttribute(k: string, v: string) {
    this._theme = v;
    this.dataset[k] = v;
  },
  removeAttribute(k: string) {
    delete this.dataset[k];
  },
};

/** 捕获的 theme-color meta:querySelector 返回既有元素(无则走 createElement 新建同一元素) */
const metaEl = { name: "", content: "" };
const docStub = {
  documentElement: docEl,
  querySelector: () => metaEl,
  createElement: () => metaEl,
  head: { appendChild: () => {} },
};

type Listener = () => void;

/** 模拟 matchMedia:listeners 保存,set() 触达系统切换 */
const mockMatchMedia = (initialDark: boolean) => {
  let dark = initialDark;
  const listeners: Listener[] = [];
  vi.stubGlobal("matchMedia", (query: string) => {
    const isDark = query.includes("dark");
    return {
      get matches() {
        return isDark ? dark : !dark;
      },
      media: query,
      addEventListener: (_: string, cb: Listener) => listeners.push(cb),
      removeEventListener: (_: string, cb: Listener) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      },
    };
  });
  return {
    set: (d: boolean) => {
      dark = d;
      listeners.forEach((cb) => cb());
    },
  };
};

describe("theme", () => {
  beforeEach(() => {
    vi.stubGlobal("document", docStub);
    docEl.removeAttribute("data-theme");
    metaEl.content = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("显式夜间设置 data-theme=dark,日间设置 light", () => {
    applyTheme("dark");
    expect(docEl.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(docEl.dataset.theme).toBe("light");
  });

  it("theme-color 随主题切换在亮暗两色间同步", () => {
    applyTheme("dark");
    expect(metaEl.content).toBe("#211F1C");
    applyTheme("light");
    expect(metaEl.content).toBe("#F3EFE4");
  });

  it("auto 跟随系统深浅", () => {
    const mq = mockMatchMedia(true);
    applyTheme("auto");
    expect(docEl.dataset.theme).toBe("dark");
    mq.set(false);
    applyTheme("auto");
    expect(docEl.dataset.theme).toBe("light");
  });

  it("initTheme 注册系统切换监听:auto 下系统切换实时跟随,显式模式不跟随", () => {
    const mq = mockMatchMedia(true);
    let mode = "auto" as "auto" | "light" | "dark";
    const dispose = initTheme(() => mode);
    expect(docEl.dataset.theme).toBe("dark");

    // 系统切日间,auto 跟随
    mq.set(false);
    expect(docEl.dataset.theme).toBe("light");

    // 用户显式选夜间:系统再切不应改主题
    mode = "dark";
    applyTheme("dark");
    mq.set(true);
    expect(docEl.dataset.theme).toBe("dark");

    // 回到 auto:跟随当前系统(日间)
    mode = "auto";
    mq.set(false);
    expect(docEl.dataset.theme).toBe("light");

    dispose();
  });

  it("无 matchMedia 环境不抛错", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => applyTheme("auto")).not.toThrow();
    expect(() => initTheme(() => "auto")).not.toThrow();
  });
});

/**
 * 首帧底色只有一处权威。
 *
 * `THEME_CHROME.light` 这一个 #F3EFE4 在本仓另有三个抄本:
 * index.html 的 <meta name=theme-color>(脚本还没跑时的首帧)、
 * PWA manifest 的 background_color / theme_color(装到主屏时的启动底色)、
 * 以及生成图标脚本的 PAPER(图标衬底)。
 *
 * 三者都不是可有可无的重复 —— 它们各自在「JS 还没接手」的时刻生效。
 * 但它们也没有任何东西保证一致:改了 theme.ts 而漏了 manifest,装到主屏的
 * 玩家会看到一帧不同色的启动画面;漏了 index.html 则每次冷启动都闪一下。
 */
describe("首帧底色 · 与抄本逐处对账", () => {
  const root = resolve(__dirname, "../..");
  const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
  // 从 theme.ts 本体读,不在这里再写一遍颜色字面量
  const light = /light:\s*"(#[0-9A-Fa-f]{6})"/.exec(read("src/core/theme.ts"))?.[1] ?? "";
  const dark = /dark:\s*"(#[0-9A-Fa-f]{6})"/.exec(read("src/core/theme.ts"))?.[1] ?? "";

  it("theme.ts 里两档色都读得到(判据自身不许空转)", () => {
    expect(light).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("index.html 的首帧 meta 跟着同一枚亮色", () => {
    const html = read("index.html");
    expect(html, "冷启动首帧的 theme-color 要与 THEME_CHROME.light 一致").toContain(
      `content="${light}"`,
    );
  });

  it("PWA manifest 的启动底色与主题色也跟着同一枚亮色", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as Record<string, string>;
    expect(manifest.background_color, "装到主屏时的启动底色").toBe(light);
    expect(manifest.theme_color, "任务切换器里的条色").toBe(light);
  });

  it("图标生成脚本的纸色也是同一枚", () => {
    const script = read("scripts/gen-pwa-icons.mjs");
    expect(script, "图标衬底要与首帧同色,否则装到主屏会看出方块的边").toContain(
      `PAPER = "${light}"`,
    );
  });
});
