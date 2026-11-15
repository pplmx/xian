/**
 * 「此刻这一劫打的是哪一境」—— 这个表达式只许有一处
 *
 * ## 第 370 轮那个 bug 的形状
 *
 * 那一轮修的是渡劫面板取错境界。它的成因不是"写错了一个函数"，而是:
 *
 * ```text
 *   core/tribulationDecision  nextMajor = isMajorStep ? major+1 : major
 *   core/tribulationDecision  nextMajor = isMajorStep ? major+1 : major   ← 第二处
 *   ui/TribulationPanel       tribTargetMajor = ...                       ← 第三处
 *   ui/TribulationPanel       又一次内联展开                               ← 第四处
 * ```
 *
 * 四处各写一遍同一个三目。**只要有一处改了另一半没改，就又是一次「面板与结算对不上」。**
 * 而第 370 轮那次正是如此:第三处写对了（`tribTargetMajor`），第四处却还在用
 * `player.major` —— 同一个文件里两个口径。
 *
 * ## 为什么这条判据值得存在
 *
 * 本仓对「两本账」的纪律写得很清楚，但多数判据守的是**结果**（两个数相等），
 * 而这一条守**成因**（同一句话只写一遍）。结果型判据只在有人跑它的那几条路径上有效;
 * 表达式一旦散开，新增的第五条、第六条路径不会被任何结果判据覆盖。
 *
 * ## 判据守什么
 *
 * 一 那个三目在**运行时代码**里只出现一次；
 * 二 它出现的那一处是具名导出（`tribulationTargetMajor`），别处用它;
 * 三 注释里提到它不算违规（那是解释，不是第二份实现）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource, walkFiles, isTypeScriptOrVue } from "@/test/readSource";

/** 那个三目的规范写法（允许两侧括号与空格差异） */
const PATTERN = /isMajorStep\s*\?\s*player\.major\s*\+\s*1\s*:\s*player\.major/g;

/** 抹掉注释 —— 注释里提到这行是解释，不是第二份实现 */
function codeOf(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("「这一劫打的是哪一境」· 只许一处", () => {
  it("运行时代码里那个三目只出现一次", () => {
    const hits: string[] = [];
    for (const file of walkFiles("src", isTypeScriptOrVue)) {
      if (file.includes(".spec.")) continue;
      const code = codeOf(readSource(file));
      const n = [...code.matchAll(PATTERN)].length;
      if (n > 0) hits.push(`${file.replace(/^.*\/src\//, "src/")} × ${n}`);
    }
    expect(
      hits,
      "这个三目在多处各写了一遍 —— 只要有一处改了另一半没改，就又是一次「面板与结算对不上」:\n" +
        hits.join("\n"),
    ).toHaveLength(1);
  });

  it("留下的是那个具名导出，且别处从它取", () => {
    /*
     * 「只有一处」还不够 —— 那一处若是个匿名内联，别处仍然没法用，
     * 于是下一个人还是会展开一遍。故要求它是可复用的形态。
     */
    const core = readSource("src/core/tribulationDecision.ts");
    expect(core, "core 里没有具名导出那个三目 —— 界面只能自己再写一遍").toMatch(
      /export function tribulationTargetMajor\(/,
    );
    const panel = readSource("src/components/cultivation/TribulationPanel.vue");
    expect(panel, "渡劫面板没有从 core 取 —— 它自己那份就是第二个来源").toContain(
      "tribulationTargetMajor",
    );
  });

  it("注释里的提及不算违规 —— 判据不会把解释当成第二份实现", () => {
    // 自证:构造一段只在注释里提到它的源码，判据应当放行
    const commented = "// nextMajor = isMajorStep ? player.major + 1 : player.major\nconst x = 1;";
    expect([...codeOf(commented).matchAll(PATTERN)].length, "注释被当成了实现").toBe(0);
  });
});
