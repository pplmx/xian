/**
 * 装饰层判据
 *
 * 这一层管的是「不承载文字的墨」:分隔线、进度槽、按压底色、卡片顶光、章节笔杆。
 * 它们不参与对比度考核(那在 palette.spec),却有一个更隐蔽的翻车方式 ——
 * **白天看着对,夜里等于没画**。
 *
 * 根因是色板上同名的两档墨:
 *   `--shadow-ink-rgb` 是**投影**的墨,夜间被重定义成近黑(8 7 5);
 *   `--color-ink-rgb`   是**纸上**的墨,夜间翻成浅墨(232 226 210)。
 * 白天两者都是 41 39 34,看不出区别;写成「深纸上画深线」之后,22% 的透明度
 * 在夜间合成出来只差三五个色阶 —— 分隔线、进度槽、按钮按下那一下,全哑了。
 * 一遍扫掉之后,口径钉成一句话:**投影才用阴影墨,凡要在纸上被看见的取纸上墨**。
 *
 * 另有四件事单独核:
 *   卡片顶光与印面亮边 —— 夜间不许沿用浅色那份(会浮成灰塑料);
 *   装饰墨的浓度上限 —— 背景里的墨不许浓到能当第二条边框;
 *   章节头的三件套 —— 主笔随世界换色、副笔走装饰档、尾线可让位;
 *   花饰分隔的位置 —— 只在页面层,弹窗是密集面板,一枚墨点会与数据争视线。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

const CSS_RAW = readFileSync(resolve(ROOT, "src/style.css"), "utf-8");
const CSS = stripComments(CSS_RAW);

type Decl = { selector: string; prop: string; value: string };

/**
 * 把 CSS 摊平成「一条声明一行」的清单。
 *
 * 只取最内层规则:`[^{}]*` 天然跳过外层的 `@media` 前缀,故 `@media` 里的规则
 * 也能取到(选择器只剩内层那一段,前缀丢了 —— 本文件不需要它)。注释先剥掉,
 * 否则说明文字里的示例写法会被当成真声明。
 */
function decls(css: string): Decl[] {
  const out: Decl[] = [];
  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = rule[1]!.trim().replace(/\s+/g, " ");
    for (const chunk of rule[2]!.split(";")) {
      const i = chunk.indexOf(":");
      if (i < 0) continue;
      const prop = chunk.slice(0, i).trim();
      if (prop.length === 0) continue;
      out.push({ selector, prop, value: chunk.slice(i + 1).trim() });
    }
  }
  return out;
}

const DECLS = decls(CSS);

/** 某一族选择器的全部声明(用于按主题分开核同一处装饰) */
function declsOf(match: (selector: string) => boolean): Decl[] {
  return DECLS.filter((d) => match(d.selector));
}

function isDark(selector: string): boolean {
  return selector.includes('data-theme="dark"') || selector.includes("data-theme='dark'");
}

/**
 * 一句话判据:凡是把「阴影墨」当色用的,都该换成纸上墨。
 *
 * 只在 box-shadow 里放行 —— 那是它真正的职责。返回的不是布尔而是违例清单,
 * 因为报红时要一眼看出是哪条规则、哪个属性。
 */
function shadowInkMisuse(css: string): string[] {
  return decls(css)
    .filter((d) => d.value.includes("--shadow-ink-rgb") && d.prop !== "box-shadow")
    .map((d) => `${d.selector} → ${d.prop}`);
}

/** 背景里那几道装饰墨各自的透明度(超上限的要报出来) */
function inkBackgroundAlphas(css: string): { at: string; alpha: number }[] {
  const out: { at: string; alpha: number }[] = [];
  for (const d of decls(css)) {
    if (!/^background(-image)?$/.test(d.prop) || !d.value.includes("--color-ink-rgb")) continue;
    for (const m of d.value.matchAll(/--color-ink-rgb\)\s*\/\s*([\d.]+)/g)) {
      out.push({ at: `${d.selector} → ${m[1]}`, alpha: Number(m[1]) });
    }
  }
  return out;
}

/** 读一个 .vue 组件(判据要核模板里的写法,故直接读源) */
function vue(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

/**
 * 只看模板本体 —— 去掉 `<script>` 与 HTML 注释。
 *
 * 这条不是洁癖:本轮的判据第一版就栽在这里。`min-w-1` 那条断言写的是
 * 「模板里必须有它」,可组件里的注释恰好写着「窄屏上它先让位(min-w-1)」——
 * 于是把类名真的删掉,判据照样绿灯:它在读自己的说明。**判据读到的必须是
 * 会被浏览器执行的写法**,说明文字一律剥掉。故障注入才把它逼出来的。
 */
function templateOf(src: string): string {
  const tpl = /<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? "";
  return tpl.replace(/<!--[\s\S]*?-->/g, "");
}

describe("装饰层 · 阴影墨只配阴影", () => {
  it("--shadow-ink-rgb 只许出现在 box-shadow 里", () => {
    expect(shadowInkMisuse(CSS), "投影墨被当成纸上墨用了 —— 夜间这些线会等于没画").toEqual([]);
  });

  it("这条判据确实扫得到东西(卡面两道投影 + 滑块一道)", () => {
    // 防空转:判据若一条都没扫到,上面那条会因为「违例清单为空」而假绿
    const real = DECLS.filter(
      (d) => d.prop === "box-shadow" && d.value.includes("--shadow-ink-rgb"),
    );
    expect(real.length).toBeGreaterThanOrEqual(3);
  });
});

describe("装饰层 · 墨的浓度", () => {
  it("背景里的墨都不浓于 25% —— 浓了就不是装饰,是第二条边框", () => {
    const over = inkBackgroundAlphas(CSS)
      .filter((x) => x.alpha > 0.25)
      .map((x) => x.at);
    expect(over).toEqual([]);
  });

  it("扫到的装饰底色/线不能太少(否则上一条形同虚设)", () => {
    expect(inkBackgroundAlphas(CSS).length).toBeGreaterThanOrEqual(8);
  });

  it("夜间禁用印面也在这条上限之内 —— 它是压色,不是第二条边框", () => {
    // 暗色主题里 html[data-theme="dark"] .btn-seal 特指度高于 .btn-seal:disabled,
    // 禁用钮会在夜间原地退回深朱(与可用钮同一个色块,只差一道投影)。故另给一档墨色印面;
    // 它同样受 25% 上限约束 —— 浓了就从「淡下去」变成第二条边框。
    const hit = inkBackgroundAlphas(CSS).find((x) => x.at.includes(".btn-seal:disabled"));
    expect(hit, "夜间禁用印面没被这条判据扫到 —— 选择器写法变了?").toBeTruthy();
    expect(hit!.alpha, "夜间禁用印面超过 25% 墨浓度上限").toBeLessThanOrEqual(0.25);
  });
});

describe("装饰层 · 卡片顶光与印面压印", () => {
  /** 取某选择器那条 box-shadow,并数出里面「白色 inset 顶光」的强度 */
  function topSheen(match: (s: string) => boolean): number {
    const shadow = declsOf(match).find((d) => d.prop === "box-shadow");
    expect(shadow, "找不到那条 box-shadow,判据要跟着改").toBeTruthy();
    const m = /inset 0 1px 0 rgb\(255 255 255 \/ ([\d.]+)\)/.exec(shadow!.value);
    expect(m, "卡片顶上那道内高光没了 / 换了写法").toBeTruthy();
    return Number(m![1]);
  }

  it("浅色卡片压一线 0.5 的白(纸的厚度)", () => {
    expect(topSheen((s) => s === ".card-ink")).toBeCloseTo(0.5, 2);
  });

  it("暗色卡片另给一档,不许沿用浅色那份", () => {
    // 暗色卡本就从底纸上浮一点,再压 0.5 的白会浮成一块灰塑料
    const dark = topSheen((s) => isDark(s) && s.endsWith(".card-ink"));
    expect(dark).toBeLessThanOrEqual(0.1);
  });

  it("印面沿上缘也有一道亮边(压印感),不是一块平色", () => {
    const seal = declsOf((s) => s === ".btn-seal").find((d) => d.prop === "box-shadow");
    expect(seal?.value).toMatch(/inset 0 1px 0 rgb\(255 255 255 \/ [\d.]+\)/);
  });
});

describe("装饰层 · 章节头", () => {
  const TITLE = templateOf(vue("src/components/common/SectionTitle.vue"));

  it("主笔随世界换色 —— 不许写死朱砂", () => {
    expect(TITLE).toContain("--world-bar");
    expect(TITLE, "章节笔杆写死了颜色,换界之后不跟").not.toMatch(/bg-cinnabar/);
  });

  it("副笔与主笔并置,且走装饰档(墨 20%)", () => {
    // 单笔时章节与列表项题头同一级;两笔并置才读作「笔杆」。
    // 间距取 2px 而不是 1px:2x 屏上 1px 会与主笔糊成一根「略脏的粗线」
    expect(TITLE).toMatch(/bg-ink\/20/);
    expect(TITLE).toMatch(/gap-0\.5/);
  });

  it("尾线拉满剩余宽度,但留得住 4px 的让位底线", () => {
    expect(TITLE, "尾线没有 flex-1 就拉不满").toContain("flex-1");
    expect(TITLE, "尾线没有下限,窄屏会被挤成 0").toContain("min-w-1");
    expect(TITLE, "尾线两侧收口靠渐变,不是实色").toMatch(/from-ink\/\d+/);
  });

  it("章节名不裁切 —— 折行也要读全(它不是列表项)", () => {
    expect(TITLE).not.toContain("truncate");
  });
});

describe("装饰层 · 两栏的上下切口", () => {
  const TOP = templateOf(vue("src/components/common/TopStatusBar.vue"));
  const BOTTOM = templateOf(vue("src/components/common/BottomNavigation.vue"));

  it("顶栏与底栏都用同一道渐隐线画边", () => {
    expect(TOP).toContain("ink-divider");
    expect(BOTTOM).toContain("ink-divider");
  });

  it("顶栏的 border 让位成透明 —— 否则实线叠渐隐线,读作双线", () => {
    expect(TOP).toMatch(/border-b border-transparent/);
  });

  it("底栏的落笔只给当前这一栏,且不占高度", () => {
    expect(BOTTOM).toMatch(
      /v-if="route\.name === tab\.name"[\s\S]{0,200}?class="[^"]*absolute[^"]*bg-cinnabar"/,
    );
    // absolute 是硬要求:底栏高度被「两栏钉死」盯着,长一分就报红
    expect(BOTTOM).toMatch(/class="absolute[^"]*bg-cinnabar[^"]*"/);
  });
});

describe("装饰层 · 花饰分隔只在页面层", () => {
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (
        entry.name.endsWith(".vue") &&
        templateOf(readFileSync(path, "utf-8")).includes("ink-divider-mark")
      )
        hits.push(path.slice(ROOT.length + 1).replace(/\\/g, "/"));
    }
  };
  walk(resolve(ROOT, "src"));

  it("花饰分隔不进弹窗 —— 密集面板里一枚墨点会与数据争视线", () => {
    // 天界拆分后,exped 页签 body(含行程点列下的那枚墨点分隔)整段搬进
    // ExpeditionPanel —— 它是页面层本体(非弹窗),随模板原样迁移,与 views/
    // 同待遇放行(逐个列名,不放开整个目录:同目录的弹窗仍严禁)
    const PANEL_PAGE_BODIES = [
      "src/components/celestial/MarksPanel.vue",
      "src/components/celestial/ExpeditionPanel.vue",
      "src/components/celestial/TrialPanel.vue",
    ];
    expect(
      hits.filter((f) => !f.startsWith("src/views/") && !PANEL_PAGE_BODIES.includes(f)),
    ).toEqual([]);
  });

  it("确实有页面在用(否则这条判据在替一份空名单站岗)", () => {
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });
});

describe("判据自证", () => {
  it("认得出把阴影墨当色用的坏样本", () => {
    const bad = `.x { background: rgb(var(--shadow-ink-rgb) / 0.2); }`;
    expect(shadowInkMisuse(stripComments(bad))).toEqual([".x → background"]);
  });

  it("投影里的阴影墨不误报", () => {
    const ok = `.y { box-shadow: 0 1px 2px rgb(var(--shadow-ink-rgb) / 0.06); }`;
    expect(shadowInkMisuse(stripComments(ok))).toEqual([]);
  });

  it("认得出过浓的装饰底色", () => {
    const bad = `.z { background: rgb(var(--color-ink-rgb) / 0.4); }`;
    expect(inkBackgroundAlphas(stripComments(bad)).map((x) => x.alpha)).toEqual([0.4]);
  });

  it("注释里的示例写法不算真声明", () => {
    // 本文件与 style.css 的说明里都会写到 `rgb(var(--shadow-ink-rgb) / alpha)`,
    // 若不先剥注释,判据会被自己写的说明绊倒
    const doc = `/* 说明:background: rgb(var(--shadow-ink-rgb) / 0.2); */\n.a { color: red; }`;
    expect(shadowInkMisuse(stripComments(doc))).toEqual([]);
  });

  it("模板判据只看模板本体,不读说明文字", () => {
    // 这条是被故障注入逼出来的:第一版断言「模板里必须有 min-w-1」,
    // 而组件注释里正好写着「窄屏上它先让位(min-w-1)」—— 删掉类名照样绿灯。
    const src = `<template>\n<!-- 这里是 min-w-1 的说明 -->\n<div class="x" />\n</template>\n<script>\nconst a = "min-w-1";\n</script>`;
    const tpl = templateOf(src);
    expect(tpl).not.toContain("min-w-1");
    expect(tpl).toContain('class="x"');
  });
});
