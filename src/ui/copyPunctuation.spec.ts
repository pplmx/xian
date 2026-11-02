/**
 * 文案标点一致性 —— 一篇文案里不许两套括号。
 *
 * 由来:全站正文以半角标点为主(中文里紧跟的半角逗号 8217 处、全角 483 处),
 * 括号同样是半角占绝对多数(6113 : 16)。可在六个文件的模板里同时混着两种,
 * 于是同一屏上会出现「(最多留 N 条)」与「(N 项)」并列 —— 字形不同、间距不同,
 * 读者不会说清哪里不对,只会觉得这页不够整。
 *
 * 判据口径是**文件内自洽**,不是全站统一:全站那种规模的一次性转换是另一件事
 * (要连带改 Spec 里钉住的字面量),这里只保证「同一页不出现两种括号」。
 * 全角括号有它的正当场合(竖排、题签),故不禁止,只要求一篇之内一致。
 */
import { describe, expect, it } from "vite-plus/test";
import { ROOT, isVueFile, walkFiles } from "@/test/readSource";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 只看模板本体:注释里的举例不算文案 */
function templateOf(src: string): string {
  const tpl = /<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? "";
  return tpl.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * 把 `{{ }}` 与 `${}` 表达式内部抹成等长空白 —— 保留偏移,便于报行号。
 *
 * 表达式里的逗号是 JS 语法,不是文案标点:混进统计就会把 "a, b" 这类
 * 代码逗号算成「半角中文逗号」,判据从此在错误的样本上做出决定。
 */
function maskExpressions(text: string): string {
  const chars = [...text];
  for (const re of [/\$\{[^{}]*\}/g, /\{\{[^{}]*\}\}/g]) {
    for (const m of text.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i += 1) chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * 只留**玩家读得到**的那部分:标签、注释、script/style、表达式一律抹成空白。
 *
 * 逗号判据必须与「清理时改的是哪些字」用同一把尺子:第一版只抹表达式,
 * 结果把标签属性里的 `hint="择契而入，逐层择路"` 与注释里的说明也算了进去 ——
 * 于是清完之后判据仍报「混用」。属性值确实是玩家看得见的(会被渲染成 title
 * 或说明),所以它要留在扫描面内;真正该排除的是标签语法本身与注释。
 */
function visibleOnly(text: string): string {
  const chars = [...text];
  for (const re of [
    /<!--[\s\S]*?-->/g,
    /<script[\s\S]*?<\/script>/g,
    /<style[\s\S]*?<\/style>/g,
    /\{\{[\s\S]*?\}\}/g,
    /\$\{[^{}]*\}/g,
    /<[^>]*>/g,
  ]) {
    for (const m of text.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i += 1) chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * 标签属性里的可见文案 —— `<p hint="甲，乙">` 这类值会被渲染出来,
 * 判据要看得见它。做法是把属性值单独摘出来拼在可见文本之后。
 */
function attributeText(text: string): string {
  return [...text.matchAll(/\b[\w:@.-]+\s*=\s*"([^"]*)"/g)].map((m) => m[1] ?? "").join(" ");
}

/** 带中文的括号片段才算「中文文案里的括号」 —— 不带 g:带 g 的 test 会记 lastIndex,跨文件串扰 */
const FULL = /（[^（）()]{0,60}[\u4e00-\u9fa5][^（）()]{0,60}）/;
const HALF = /\([^（）()]{0,60}[\u4e00-\u9fa5][^（）()]{0,60}\)/;
/** 中文后面的逗号 —— 两种写法各算一次(同样不带 g) */
const FULL_COMMA = /[\u4e00-\u9fa5]，/;
const HALF_COMMA = /[\u4e00-\u9fa5],/;

function mixed(files: { path: string; tpl: string }[]): string[] {
  return files.filter((f) => FULL.test(f.tpl) && HALF.test(f.tpl)).map((f) => f.path);
}

/**
 * 同一文件里两种逗号并存 —— 与括号同一条纪律,只是对象换了。
 *
 * 扫描面 = 可见文本 + 标签属性值(两者玩家都读得到),注释与表达式不含在内。
 * `FILES` 的 tpl 已经在 templateOf 里剥过注释,故属性值摘出来也不会带进注释文字。
 */
function mixedComma(files: { path: string; tpl: string }[]): string[] {
  return files
    .filter((f) => {
      const text = `${visibleOnly(f.tpl)} ${attributeText(f.tpl)}`;
      return FULL_COMMA.test(text) && HALF_COMMA.test(text);
    })
    .map((f) => f.path);
}

const FILES = walkFiles(resolve(ROOT, "src"), isVueFile).map((full) => ({
  path: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
  tpl: templateOf(readFileSync(full, "utf8")),
}));

describe("文案标点 · 一篇之内只有一套括号", () => {
  it("模板里不同时出现全角与半角的中文括号", () => {
    expect(mixed(FILES), "这些文件同屏混着两种括号 —— 统一成其中一种(全站以半角为主)").toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    // 若 templateOf 或两个正则坏了,上一条会因「一处都没扫到」假绿 ——
    // 两种括号都得真扫到过(洞府页整页用全角、其余多半用半角,正好各有一个样本)。
    const withHalf = FILES.filter((f) => /\([^（）()]*[\u4e00-\u9fa5]/.test(f.tpl)).length;
    const withFull = FILES.filter((f) => /（[^（）()]*[\u4e00-\u9fa5]/.test(f.tpl)).length;
    expect(withHalf, "带中文的半角括号一处都没扫到").toBeGreaterThan(20);
    expect(withFull, "带中文的全角括号一处都没扫到 —— 判据可能只认了一种").toBeGreaterThanOrEqual(
      1,
    );
  });

  it("判据自证:混用的样本认得出来,单一制的不误伤", () => {
    const bad = [{ path: "a.vue", tpl: "<p>最多留 3 条（本页）</p><p>共 5 项(全账)</p>" }];
    const ok = [{ path: "b.vue", tpl: "<p>最多留 3 条(本页)</p><p>共 5 项(全账)</p>" }];
    expect(mixed(bad)).toEqual(["a.vue"]);
    expect(mixed(ok)).toEqual([]);
  });
});

/**
 * 逗号 —— 与括号同一条纪律,但这一条过去只写在别处、没有判据。
 *
 * 全站两种写法都有人用(全角 178 处 / 半角 265 处),本来只是风格;可同一页里
 * 两种并置时,「逐词条，更好看」与「逐条目,更好看」上下两行,一个逗号占半格、
 * 一个占一格,行尾会跟着参差。
 *
 * 判据口径与括号一致:**一篇之内自洽**。文件想用哪一种由它自己那多数决定,
 * 判据只查「有没有两套」—— 逼全站换字是一次性的重排,那是另一件事。
 */
describe("文案标点 · 一篇之内只有一套逗号", () => {
  it("模板里不同时出现全角与半角的中文逗号", () => {
    expect(mixedComma(FILES), "这些文件同屏混着全角与半角的中文逗号 —— 统一成其中一种").toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    const masked = FILES.map((f) => maskExpressions(f.tpl));
    const full = masked.filter((t) => /[\u4e00-\u9fa5]，/.test(t)).length;
    const half = masked.filter((t) => /[\u4e00-\u9fa5],/.test(t)).length;
    // 两种都得真扫到:全站本来就有全角为主的文件(设置页、藏珍页)与半角为主的
    expect(full, "全角中文逗号一处都没扫到").toBeGreaterThan(3);
    expect(half, "半角中文逗号一处都没扫到").toBeGreaterThan(20);
  });

  it("判据自证:混用的样本认得出来,表达式里的代码逗号不误伤", () => {
    const bad = [{ path: "a.vue", tpl: "<p>逐词条，更好看</p><p>逐条目,更好看</p>" }];
    const ok = [{ path: "b.vue", tpl: "<p>逐条目,更好看</p><p>{{ a }}, {{ b }}</p>" }];
    expect(mixedComma(bad)).toEqual(["a.vue"]);
    expect(mixedComma(ok)).toEqual([]);
    // 表达式内部即便写了中文逗号,也不算「模板里的半角逗号」
    const expr = [{ path: "c.vue", tpl: "<p>{{ x ? '甲，乙' : '甲' }}</p><p>逐条目,更好看</p>" }];
    expect(mixedComma(expr)).toEqual([]);
  });
});

/**
 * 乘号 —— 玩家看得见的「几倍」只用一个符号。
 *
 * 全站写倍率用的是全角 ×(「修为 ×1.05」「道源 ×2.2」),但数值体系弹窗里那半句
 * 「耗时却压在 x2.4」用了 ASCII 的 x。同一个弹窗里两种乘号,一个宽一个窄,
 * 并排读起来像两个不同的意思。
 *
 * 判据只扫**模板里的可见文本**:CSS 的 `100%`、变量名里的 `x`、base64 之类
 * 一律不在此列。ASCII x 后面紧跟 `{{` 或数字、前面是中文或空白,才算「当乘号用」。
 */
describe("文案标点 · 乘号只用 ×", () => {
  /** 取出模板里去掉标签的那部分可见文本(属性值里的表达式不算文案) */
  function visibleText(tpl: string): string {
    return tpl
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\{\{[^}]*\}\}/g, " ");
  }

  it("模板可见文本里没有拿 ASCII x 当乘号", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const text = visibleText(file.tpl);
      // 中文或空白 + x + 数字/占位,且 x 不是某个英文单词的一部分
      if (
        /(?:[\u4e00-\u9fa5]\s*|\s)x\s*\d/.test(text) ||
        /(?:[\u4e00-\u9fa5])x(?:\.|\s|$)/.test(text)
      ) {
        offenders.push(file.path);
      }
    }
    expect(
      offenders,
      "这些模板里用 ASCII x 当乘号 —— 全站别的倍率都写 ×,同一个界面里别混两种",
    ).toEqual([]);
  });

  it("判据自证:认得出来,也不误伤真的字母 x", () => {
    const bad = visibleText("<p>耗时压在 x2.4 之间</p>");
    const ok = visibleText("<p>耗时压在 ×2.4 之间</p><p>max-width: 100%</p>");
    expect(/(?:[\u4e00-\u9fa5]\s*|\s)x\s*\d/.test(bad)).toBe(true);
    expect(/(?:[\u4e00-\u9fa5]\s*|\s)x\s*\d/.test(ok)).toBe(false);
  });
});

/**
 * 字与数的间距 —— 中文与阿拉伯数字之间留一个空格。
 *
 * 全站这个口径是统一的(「已凑出 1/2 个核心词条」「还剩 100%」),但灵草坊那两枚
 * 按钮写成了「买1」「买10」:同一个游戏里,数字有时候贴字、有时候留白,读起来像
 * 两种排版。数字已由模板插值出来的站点不在扫描面内(那种间距由数据决定),
 * 这里只钉**手写在模板里**的数字。
 */
describe("文案标点 · 中文与手写数字之间留空格", () => {
  /** 手写数字(不含 {{ }} 插值)紧贴中文的位置 */
  function glued(tpl: string): string[] {
    const text = tpl
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\{\{[\s\S]*?\}\}/g, " ")
      .replace(/<[^>]*>/g, " ")
      // 尖括号属性里可能带 px/rem 这类,把它们也当语法而不是文案
      .replace(/\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|ms|s)\b/g, " ")
      // 数字与量词之间没有空格的样本
      .match(/[\u4e00-\u9fa5]\d|\d[\u4e00-\u9fa5]/g);
    return text ?? [];
  }

  it("模板里没有中文紧贴手写数字的地方", () => {
    const offenders: { file: string; sample: string[] }[] = [];
    for (const file of FILES) {
      const hits = glued(file.tpl);
      if (hits.length) offenders.push({ file: file.path, sample: hits.slice(0, 4) });
    }
    expect(
      offenders,
      "这些模板里中文紧贴着手写的数字 —— 全站口径是留一个空格(「买 1」而不是「买1」)",
    ).toEqual([]);
  });

  it("判据自证:「买1」认得出来,插值与 CSS 数字不误伤", () => {
    expect(glued("<button>买1</button>")).toEqual(["买1"]);
    expect(glued("<span>{{ n }} 件</span>")).toEqual([]);
    expect(glued('<p class="text-[11px]">大约 3 次</p>')).toEqual([]);
  });
});

/**
 * 省略号 —— 中文里用六个点(两个 U+2026),不用三个点。
 *
 * 全站可见文案本来就是这个写法(「正在测定灵根……」「山风掠过,四下无声……」),
 * 丹房搜索框的 placeholder 却写成「搜方名…」:同一个游戏里一处占两个汉字宽、
 * 一处占一个,光标挪过去时两种空。单省略号在**代码注释与日志截断**里是正当的
 * (「9.99…e52」「${text.slice(0, 34)}…」),故判据只扫模板可见文本与属性值。
 */
describe("文案标点 · 省略号写 ……", () => {
  /**
   * 单个 … 且**贴着中文**才算「中文散文里的省略号」。
   *
   * 特意排除两种正当写法:`万/亿/兆/京…` 这类紧跟在符号后的是清单收尾,
   * 与 `…+N` 一样属于图形标记(它后面接的是加号或数字,不是话),不是句子。
   */
  function singleEllipsis(tpl: string): string[] {
    const text = `${visibleOnly(tpl)} ${attributeText(tpl)}`;
    return [...text.matchAll(/(?<!…)(?<=[\u4e00-\u9fa5])…(?!…)/g)].map((m) =>
      text.slice(Math.max(0, m.index - 12), m.index + 12).trim(),
    );
  }

  it("模板可见文案里没有单省略号", () => {
    const offenders: { file: string; sample: string[] }[] = [];
    for (const file of FILES) {
      const hits = singleEllipsis(file.tpl);
      if (hits.length) offenders.push({ file: file.path, sample: hits.slice(0, 3) });
    }
    expect(offenders, "这些地方用了单省略号 —— 中文文案里写「……」").toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    const withDouble = FILES.filter((f) => /……/.test(visibleOnly(f.tpl))).length;
    expect(withDouble, "双省略号一处都没扫到 —— 判据可能在空转").toBeGreaterThanOrEqual(2);
  });

  it("判据自证:单省略号认得出来,…… 与注释里的数学符号不误伤", () => {
    expect(singleEllipsis("<p>正在测定灵根…</p>")).toHaveLength(1);
    expect(singleEllipsis("<p>正在测定灵根……</p>")).toEqual([]);
    // 注释与表达式里的单省略号不算文案
    expect(singleEllipsis("<!-- 9.99…e52 --><p>甲</p>")).toEqual([]);
    expect(singleEllipsis('<p>{{ a ? "甲…" : "乙" }}</p>')).toEqual([]);
  });
});
