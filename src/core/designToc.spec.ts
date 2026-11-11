/**
 * `docs/design.md` 的目录 —— 加它是为了让读者找得到,而目录最容易过时。
 *
 * ## 由来(第 140 轮)
 *
 * 这份文档 6300 余行、16 节、130 个子节,而它**一直没有目录**。
 * 上两轮核 `README` 与 `usage` 时发现:给人看的文档,弱点往往不是数字
 * (那些早被 `docs-check` 与各类 spec 钉着),而是**导航与结构**。
 *
 * 这轮补了目录,同时发现一件熟悉的事:**「6355 行、15 节、106 个子节」
 * 这串数字在插入目录的同一刻就过时了**(变成 6376 / 16 / 130)。
 *
 * 故那三行改成了不含数字的描述:
 *
 * ```text
 * 这份文档混着两类内容:规格(配色、版式、字体、动效、无障碍)与查证记录
 * (为什么某个设计定成这样)。后者集中在「图标」一节 —— 那节的子节是逐条
 * 设计决策的追溯,不是图标本身的规格。
 * ```
 *
 * ## 判据
 *
 * ① 目录必须列全每一个 `##` 小节(除目录自己);
 * ② 目录里的链接必须是**该文档真的有的锚点**;
 * ③ 目录开头那段说明不许写会变的数字 —— 行数、节数、子节数都算。
 *
 * ③ 是这轮的直接教训:**同一段话里既想报规模又想长期正确,只能不报。**
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const DOC = readFileSync(join(ROOT, "docs/design.md"), "utf8");
const LINES = DOC.split("\n");

/** 所有 `## ` 小节标题(含「目录」自己) */
function allSections(): string[] {
  return LINES.filter((l) => l.startsWith("## ")).map((l) => l.slice(3).trim());
}

/** 目录区块(从 `## 目录` 到下一个 `## `) */
function tocBlock(): string {
  const start = LINES.findIndex((l) => l === "## 目录");
  expect(start, "找不到「## 目录」").toBeGreaterThanOrEqual(0);
  const rest = LINES.slice(start + 1);
  const next = rest.findIndex((l) => l.startsWith("## "));
  return (next >= 0 ? rest.slice(0, next) : rest).join("\n");
}

describe("design.md 的目录", () => {
  it("① 目录列全每一个 `##` 小节", () => {
    const toc = tocBlock();
    /*
     * 目录自己也在 `##` 列表里,要排除 —— 否则它会要求「目录里也列一条目录」。
     */
    /*
     * 只查**目录列表行**(`- [标题](#锚点)`)。
     *
     * 第一版用 `toc.includes(s)`,而目录上方那段说明里恰好写着
     * 「规格(配色、版式、字体、动效、无障碍)」—— 删掉「动效」那一行之后,
     * `includes("动效")` 仍被说明段命中,判据照样绿。
     * **同一个词出现在说明里与出现在列表里,不是同一件事。**
     */
    /*
     * 目录行是**纯文本** `- 标题`,不是锚点链接。
     *
     * 第 140 轮第一版写成锚点链接(`- [标题](#锚点)`),而 rumdl 的 MD051 规则
     * 对中文锚点解析不了 —— 它按 GitHub 的算法算出来对不上手写的那一串。
     * 与其在文档里维护一份易碎的锚点,不如列成纯文本:读者照样扫得到全貌,
     * 而文档不再有一个「换个渲染器就报错」的结构。
     */
    const listed = new Set([...toc.matchAll(/^- (.+)$/gm)].map((m) => m[1]!.trim()));
    const sections = allSections().filter((s) => s !== "目录");
    const missing = sections.filter((s) => !listed.has(s));
    expect(missing, "目录里少了这些小节 —— 加了新节没回来更新目录:" + missing.join("、")).toEqual(
      [],
    );
    expect(sections.length, "一个 `##` 小节都没解析出来").toBeGreaterThan(10);
  });

  it("② 目录的条目数与小节数相等", () => {
    /*
     * 纯文本列表没有锚点可校验,于是换一条等价的下限:**条目数要与小节数一致**。
     * 少了是漏列,多了是写了已删的节。
     */
    const toc = tocBlock();
    const listed = [...toc.matchAll(/^- (.+)$/gm)].map((m) => m[1]!.trim());
    const sections = allSections().filter((s) => s !== "目录");
    expect(listed.length, `目录 ${listed.length} 条,而小节有 ${sections.length} 个`).toBe(
      sections.length,
    );
  });

  it("③ 目录开头那段说明不许写会变的数字", () => {
    const toc = tocBlock();
    /*
     * 「N 行」「N 节」「N 个子节」都会随编辑变。第 140 轮第一次写的就是
     * 「6355 行、15 节、106 个子节」—— 插入目录的同一刻三个数全错。
     */
    const volatile = [...toc.matchAll(/(\d+)\s*(行|节|个子节)/g)].map((m) => m[0]);
    expect(
      volatile,
      "目录说明里写了会变的数字(行数 / 节数 / 子节数)—— 它们随每次编辑过期:" + volatile.join("、"),
    ).toEqual([]);
  });

  it("④ 目录要说明「这份文档混着两类内容」", () => {
    /*
     * design.md 的 16 节里,前五节是**规格**(配色/版式/字体/图标/动效/无障碍),
     * 后十节是**查证记录**(为什么某个设计定成这样)。不说明这一点,
     * 读者会以为后面那些也是「必须遵守的规范」。
     */
    const toc = tocBlock();
    expect(
      /规格|查证记录/.test(toc),
      "目录没有说明这份文档混着「规格」与「查证记录」两类内容",
    ).toBe(true);
  });

  it("反空转:文档读得到,目录不是空的", () => {
    expect(DOC.length, "design.md 太短").toBeGreaterThan(100000);
    expect(tocBlock().split("\n").length, "目录几乎是空的").toBeGreaterThan(10);
    expect(allSections().length, "小节太少").toBeGreaterThan(10);
  });
});
