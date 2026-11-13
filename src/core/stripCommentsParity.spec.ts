/**
 * `stripComments` 有八份副本 —— 而它们**已经分叉了**。
 *
 * ## 由来（第 173 轮）
 *
 * 「注释冒充正文」是本仓反复栽的那条坑（`docs/审计规范.md` 第三节）:
 * 判据写「源码里不许出现 X」，而注释里正好**举例**说明了旧的 X，
 * 于是判据在正确实现上红。解法是先抹掉注释再判。
 *
 * 这个工具被复制到了八份用例里。逐份核对，实现**并不一致**:
 *
 * | 文件 | HTML 注释 | 块注释 | 行注释 |
 * | --- | --- | --- | --- |
 * | rulesetEra / softCapVisibility / veinVisibility | 有 | 有 | 全部 |
 * | deadFallback / assertionLiveness / testDeterminism | 无 | 有 | 仅整行 |
 * | breakthroughCost / weatherUnitConsistency | 有 | 有 | 行尾也剥（且避开 `://`） |
 *
 * 两种漏法都真实存在:
 *
 * 1. **漏 HTML 注释** —— `.vue` 里的注释就是 `<!-- … -->`。只抹 `/* *\/` 与 `//`
 *    的版本对模板注释完全无效，而那正是 Vue 项目里最常见的一种。
 * 2. **漏行尾 `//`** —— 只认整行注释的实现，对 `const a = 1; // 旧写法`
 *    这类行尾注释穿过判据，判据照样举报正确实现。
 *
 * 分叉方向不对称:**宽的那份**能挡住误报，**窄的那份**挡不住 —— 而它们是同一个
 * 判据工具的副本，谁也不会去核对另一份。
 *
 * ## 判据
 *
 * ① 八份副本必须**行为一致**（同一段含三种注释的样本，抹完结果相同）;
 * ② 三种注释都得抹掉（HTML / 块 / 行尾）;
 * ③ 不许把 `://` 里的 `//` 当成注释（那会把 URL 后半截吃掉，连带抹掉真代码）;
 * ④ 不许再新增独立副本 —— 新用例应当引同一份（放 `src/test/` 下）。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSpecFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/**
 * 一份「三种注释都有」的样本。
 *
 * 每一行注释后面都跟着一段**真代码**（`KEEP_N`）—— 抹完之后这些必须还在，
 * 这是防「抹过头」的反向检查。
 */
const SAMPLE = [
  "<!-- 模板注释 KEEP_1 -->",
  "<div>{{ value }}</div>",
  "/* 块注释 KEEP_2 */",
  'const a = "url://not-a-comment"; // 行尾注释 KEEP_3',
  "// 整行注释 KEEP_4",
  "const b = 2; /* 行内块注释 KEEP_5 */",
  'const c = "http://x.com/y";',
].join("\n");

/** 抹完注释之后，这些都该还在 */
const KEEP = ["<div>", "const a", "url://not-a-comment", "const b", "const c", "http://x.com/y"];

/** 抹完注释之后，这些都不该在 */
const GONE = ["KEEP_1", "KEEP_2", "KEEP_3", "KEEP_4", "KEEP_5"];

/**
 * 从用例源码里把它的 `stripComments` 定义抓出来 —— 逐行比对**实现文本**。
 *
 * 不求值:函数体里含正则字面量，`new Function` 会把它当真的正则解析并报语法错
 * （第一版就是这么栽的）。而这里要判的本来就是「八份实现是否一致」——
 * 比文本比求值更直接，也不受求值环境的干扰。
 */
function implTextOf(src: string): string | null {
  const fn = /function stripComments\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(src);
  if (fn) return fn[1]!.replace(/\s+/g, " ").trim();
  const arrow = /const stripComments = [^=]*=>([\s\S]*?);\n/.exec(src);
  if (arrow) return arrow[1]!.replace(/\s+/g, " ").trim();
  return null;
}

describe("stripComments · 只许有一份实现", () => {
  it("共享的那一份抹得干净三种注释，且不吃真代码", () => {
    const out = stripComments(SAMPLE);
    for (const need of KEEP) expect(out, `抹过头，吃掉了 «${need}»`).toContain(need);
    for (const gone of GONE) expect(out, `没抹掉 «${gone}»`).not.toContain(gone);
    expect(out, "吃掉了 URL").toContain("http://x.com/y");
    expect(out, "吃掉了 URL").toContain("url://not-a-comment");
  });

  it("用例里不许再有本地副本 —— 一律 import 这一份", () => {
    const copies: string[] = [];
    for (const f of walkFiles("src", isSpecFile)) {
      /*
       * **排除本文件** —— 它的「地基」那一条里就写着两份样本实现（function 与箭头),
       * 扫进来就变成判据举报自己。要排除的永远只有它自己。
       */
      if (f.endsWith("stripCommentsParity.spec.ts")) continue;
      const src = readSource(f);
      if (implTextOf(src) !== null) copies.push(f.replace(/^.*\/src\//, "src/"));
    }
    expect(
      copies,
      "这些用例各写了一份 stripComments —— 八份曾经分叉过（窄的那份挡不住行尾 // 与 HTML 注释）。" +
        '改成 `import { stripComments } from "@/test/stripComments"`',
    ).toEqual([]);
  });

  it("判据自己认得出「一份副本长什么样」（地基）", () => {
    const sample = "function stripComments(src: string): string {\n  return src;\n}";
    expect(implTextOf(sample), "认不出 function 形态").not.toBeNull();
    const arrow = 'const stripComments = (text: string): string =>\n  text.replace(/a/g, "");\n';
    expect(implTextOf(arrow), "认不出箭头形态").not.toBeNull();
    expect(implTextOf("const x = 1;\n"), "把无关代码当成副本").toBeNull();
  });
});
