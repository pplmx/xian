/**
 * 「差多少」那种读数，到边界之后必须换成另一句话。
 *
 * ## 由来（第 197 轮）
 *
 * 这个形状在最近两轮各出过一次:
 *
 * ```text
 * 第 195 轮  core/goal        core === total 时仍说「继续寻找关键装备」（进度条却已 100%）
 * 第 196 轮  BuildDiscovery   closestGap === 0 时仍说「再补 ⋯ 跨过便会成路」
 * ```
 *
 * 两次都不是算错，而是**到边界之后那句话没换** —— 读数已经走到头，
 * 文案还停在边界之前的样子。
 *
 * ## 这条判据守什么
 *
 * 扫全仓 `xxxGap / xxxLeft / xxxShort / xxxRemain > 0 ? A : B` 这种分支:
 * **两支的文案必须不一样**（不能 `x > 0 ? "尚差 0" : "尚差 0"` 这种空转），
 * 且那个边界读数确实参与了两支的选择。
 *
 * 它挡不住「两支都写错」（那要靠行为判据），但挡得住最常见的退化:
 * 有人把分岔删掉、或把两支写成同一句。
 *
 * ## 为什么不做成「必须写对边界那一句」
 *
 * 那条做不到 —— 什么话算「写对」是语义判断，机械判据判不了。
 * 能做的是守住**结构**:有分岔、两支不同、边界读数在分岔条件里。
 *
 * ## 故障注入
 *
 * 把 `BuildDiscovery` 的 `gap > 0 ? A : B` 两支写成同一句 → 「两支不是同一句」红。
 * 把 `EventDialog` 的 `left > 0 ?` 两支写成同一句 → 同上那条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/** 边界读数的命名习惯（本仓的四种） */
const BOUNDARY = /(?:gap|left|short|shortfall|remain|deficit|need)\w*/i;

interface Site {
  file: string;
  cond: string;
  yes: string;
  no: string;
}

/**
 * 抓出 `cond > 0 ? A : B` 形状的三元式。
 *
 * ## 已知局限:只认同一行内的三元
 *
 * 全仓还有几处是**跨行**写的（`?` 与 `:` 分在两行），这里抓不到 ——
 * 实测扫到 2 处，而人工数下来是 7 处。跨行的那种要判「两支是否同一句」需要
 * 跨行配对括号，写出来会是一段脆弱的小解析器，而它换来的是「多覆盖 5 处」。
 *
 * 判断是**不做**。这个判据挡的是最常见的那种退化（把分岔删掉、或两支写成同一句）,
 * 它在能做到这件事的那部分代码上是有效的;而做不到的那部分,
 * 上面那句 `expect(n).toBeGreaterThan(1)` 会让判据在覆盖面变小时先叫。
 *
 * 与其造一个半可靠的全量扫描,不如把边界说清楚 —— 下一个人知道它守到哪。
 */
function boundaryBranches(src: string, file: string): Site[] {
  const out: Site[] = [];
  for (const line of src.split("\n")) {
    const m = new RegExp(`(${BOUNDARY.source})\\s*(?:\\.value)?\\s*>\\s*0\\s*\\?`).exec(line);
    if (!m) continue;
    const afterQ = line.slice(m.index + m[0].length);
    // 找配对的冒号（跳过嵌套三元，够用即可）
    const colon = afterQ.indexOf(":");
    if (colon < 0) continue;
    out.push({
      file,
      cond: m[1]!,
      yes: afterQ
        .slice(0, colon)
        .replace(/[;,)]+\s*$/, "")
        .trim(),
      // 剥掉末尾的标点（`;` `,` `)`）—— 它们不属于文案，却会让「同一句」判不成
      no: afterQ
        .slice(colon + 1)
        .replace(/[;,)]+\s*$/, "")
        .trim(),
    });
  }
  return out;
}

describe("「差多少」到边界之后要换一句话", () => {
  it("扫到了足够多的边界分岔（防空转）", () => {
    let n = 0;
    for (const f of walkFiles("src", isSourceFile)) {
      n += boundaryBranches(stripComments(readSource(f)), f).length;
    }
    expect(n, "一个边界分岔都没扫到 —— 判据空转，或命名习惯变了").toBeGreaterThan(1);
  });

  it("每一处边界分岔的两支说的不是同一句", () => {
    const offenders: string[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      for (const site of boundaryBranches(stripComments(readSource(f)), f)) {
        const norm = (t: string) => t.replace(/[\s"'`]/g, "");
        if (norm(site.yes) === norm(site.no)) {
          offenders.push(`${site.file}: ${site.cond} 的两支写成同一句`);
        }
      }
    }
    expect(
      offenders,
      "这些边界分岔的两支是同一句话 —— 那这个分岔等于不存在，" +
        "而「差多少」走到 0 之后玩家读到的还是边界之前的样子:" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出这个形状（地基）", () => {
    const bad = `const t = gap > 0 ? "尚差" : "尚差";`;
    const sites = boundaryBranches(bad, "x");
    expect(sites.length, "认不出边界分岔").toBe(1);
    const norm = (t: string) => t.replace(/[\s"'`]/g, "");
    expect(norm(sites[0]!.yes), "正例该被判成同一句").toBe(norm(sites[0]!.no));

    // 用普通串:模板串里的 `${...}` 会被求值，而这个样本里没有 `gap`
    const good = 'const t = gap > 0 ? "尚差 " + gap : "已齐";';
    const s2 = boundaryBranches(good, "x");
    expect(norm(s2[0]!.yes) === norm(s2[0]!.no), "把两支不同的也报成同一句").toBe(false);
  });
});
