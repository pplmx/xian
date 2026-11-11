/**
 * `markdownSection` —— 把「按标题切一节」这件事收到一处。
 *
 * ## 由来
 *
 * 第 137 / 140 / 150 三轮,**同一个坑踩了三次**:
 *
 * ```text
 *   137  misjudgmentLedger  正文里的 ⑬ 冒充了「下一个条目」的起点
 *   140  designToc          目录上方说明里的「动效」冒充了列表项
 *   150  misjudgmentLedger  又一次 —— 修了 nextAt 却漏了 at
 * ```
 *
 * 三次的形状一样:**用 `indexOf(某个词)` 找边界,而那个词在正文里也出现**。
 *
 * 前两次都写进了 `docs/development.md` 的误判清单(⑪⑫⑬⑭ 那一族),而第三次照样踩 ——
 * 说明**记下来不等于不会再犯**。真正的护栏是:让「切一节」只有一个实现,而那个实现
 * 按**行首标题**匹配,不按词。
 *
 * ## 这份用例守四件事
 *
 * ① 切出来的正文到下一个同级标题为止(不含下一个标题);
 * ② 到**更高级**标题也停 —— `## ` 切到下一个 `## `,`### ` 切到下一个 `## ` 或 `### `;
 * ③ **行内出现的标题字样不算边界** —— 这是三次踩坑的直接原因;
 * ④ 找不到标题时**抛错**,不返回空串(空串会让「找不到」伪装成「那节是空的」)。
 */
import { describe, expect, it } from "vite-plus/test";
import { markdownSection } from "./readSource";

const DOC = [
  "# 顶层",
  "",
  "## 甲",
  "",
  "甲的正文。这里提到一个行内的 `## 乙` 字样 —— 那不是标题。",
  "",
  "### 甲一",
  "",
  "甲一的正文。",
  "",
  "## 乙",
  "",
  "乙的正文。",
  "",
  "### 乙一",
  "",
  "乙一的正文。",
  "",
  "## 丙",
  "",
  "丙的正文。",
].join("\n");

describe("markdownSection", () => {
  it("① 切到下一个同级标题为止,不含下一个标题", () => {
    const a = markdownSection(DOC, "## 甲");
    expect(a, "切出来的没有甲").toContain("甲的正文");
    expect(a, "切出来的把甲一也带上了").toContain("甲一的正文");
    expect(a, "切出来的越界到了乙").not.toContain("乙的正文");
    expect(a.startsWith("## 甲"), "切出来的不是从甲那一行开始").toBe(true);
  });

  it("② 到更高级标题也停", () => {
    const a1 = markdownSection(DOC, "### 甲一");
    expect(a1).toContain("甲一的正文");
    // ### 之后是 ## 乙 —— 比它高级,要停
    expect(a1, "### 那一节没有在下一个 ## 处停").not.toContain("乙的正文");

    const b1 = markdownSection(DOC, "### 乙一");
    expect(b1).toContain("乙一的正文");
    expect(b1, "### 乙一 越界到了丙").not.toContain("丙的正文");
  });

  it("③ 行内出现的标题字样不算边界 —— 三次踩坑的直接原因", () => {
    /*
     * 甲的正文里有一句「这里提到一个行内的 `## 乙` 字样」。
     * 若实现用 `doc.indexOf("## 乙")`,它会在这里停下,切出来的甲节只有半句。
     */
    const a = markdownSection(DOC, "## 甲");
    expect(a, "切在行内那个「## 乙」上了 —— 这正是 137/140/150 三轮踩的坑").toContain("那不是标题");
    expect(a, "行内的标题字样被当成了边界").toContain("甲一的正文");
  });

  it("④ 找不到标题时抛错,不返回空串", () => {
    /*
     * 返回空串比抛错更坏:调用方拿到的空串看起来像「那一节是空的」,
     * 而「空」在内容审计里是一个**结论**(内容缺口),不是错误。
     */
    expect(() => markdownSection(DOC, "## 不存在的节")).toThrow(/找不到标题/);
    // 标题不带 # 也要立刻报错,不许静默当成普通字符串去搜
    expect(() => markdownSection(DOC, "甲")).toThrow(/标题要以 # 开头/);
  });

  it("⑤ 标题必须整行相等 —— 行内提及的同一串不算", () => {
    /*
     * `findIndex` 用的是整行相等(`trimEnd` 之后),故「正文里提到 `## 乙`」那一行
     * 不会被当成人乙的起点。这条与 ③ 是一体两面:③ 查切段结果,这条查起点定位。
     */
    const b = markdownSection(DOC, "## 乙");
    expect(b).toContain("乙的正文");
    expect(b, "起点定位到了行内那句提及上").not.toContain("甲的正文");
    expect(b.trimEnd().endsWith("乙一的正文。"), "尾部不对").toBe(true);
  });

  it("反空转:真的切到了东西,且三节各不同", () => {
    const a = markdownSection(DOC, "## 甲");
    const b = markdownSection(DOC, "## 乙");
    const c = markdownSection(DOC, "## 丙");
    for (const [name, body] of [
      ["甲", a],
      ["乙", b],
      ["丙", c],
    ] as const) {
      expect(body.length, `${name} 切出来几乎是空的`).toBeGreaterThan(10);
    }
    expect(new Set([a, b, c]).size, "三节切出来有重复 —— 切法坏了").toBe(3);
  });
});
