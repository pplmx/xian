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
