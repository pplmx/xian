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
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** 只看模板本体:注释里的举例不算文案 */
function templateOf(src: string): string {
  const tpl = /<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? "";
  return tpl.replace(/<!--[\s\S]*?-->/g, "");
}

/** 带中文的括号片段才算「中文文案里的括号」 */
const FULL = /（[^（）()]{0,60}[\u4e00-\u9fa5][^（）()]{0,60}）/g;
const HALF = /\([^（）()]{0,60}[\u4e00-\u9fa5][^（）()]{0,60}\)/g;

function mixed(files: { path: string; tpl: string }[]): string[] {
  return files.filter((f) => FULL.test(f.tpl) && HALF.test(f.tpl)).map((f) => f.path);
}

const FILES = walk(resolve(ROOT, "src")).map((full) => ({
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
