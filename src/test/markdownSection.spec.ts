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
 * ## 这份用例守六件事
 *
 * ① 切出来的正文到下一个同级标题为止(不含下一个标题);
 * ② 到**更高级**标题也停 —— `## ` 切到下一个 `## `,`### ` 切到下一个 `## ` 或 `### `;
 * ③ **行内出现的标题字样不算边界** —— 这是三次踩坑的直接原因;
 * ④ 找不到标题时**抛错**,不返回空串(空串会让「找不到」伪装成「那节是空的」);
 * ⑤ **围栏代码块里的行首 `#` 不算标题** —— bash 注释就是这个形状,实测把
 *    `## 待办 · 下一步` 切成了 114 字符 / 6 行(正确的是 4073 字符 / 104 行);
 * ⑥ `stopAtSub` 打开时**连小节也停** —— 待办那一节后面接着一长串 `###` 历史记录,
 *    不打开就等于把整份文档的后半段当成了待办。
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

/*
 * ⑥ 围栏代码块 —— 接入 `releaseTodo.spec` 时撞上的那一处。
 *
 * 「待办 · 下一步」那一节的第一段就是 ```bash,里面写着:
 *
 * ```text
 *   # 1) 先把版本号提上去 —— 不改这一行,release-check 会拦「tag 已存在」
 *   # 2) 干净提交之后才打 tag
 * ```
 *
 * 这两行都以 `# ` 开头。而 `## ` 那一节的边界判定是「下一个同级或更高级标题」,
 * 于是 104 行的待办只切出 6 行(末尾是那行 ```bash):**114 字符 vs 4073 字符**,差 35 倍。
 *
 * 判据本身看不出来 —— `releaseTodo.spec` 只会报「待办里既没有 `git tag` 也没有占位符」,
 * 而人看到的是「文档里明明写着」。这一条守的就是「切少了」这个方向。
 */
describe("markdownSection · 围栏代码块", () => {
  const FENCED = [
    "# 顶层",
    "",
    "## 部署",
    "",
    "```bash",
    "# 1) 先装依赖",
    "# 2) 再打包",
    "bun run build",
    "```",
    "",
    "部署正文。",
    "",
    "## 下一节",
    "",
    "下一节的正文。",
  ].join("\n");

  it("围栏里的行首 `#` 不算边界 —— 切出来的那一节要包含围栏之后的正文", () => {
    const s = markdownSection(FENCED, "## 部署");
    expect(s, "切在 bash 注释那一行了 —— 围栏里的 `#` 被当成了标题").toContain("部署正文");
    expect(s, "越界到了下一节").not.toContain("下一节的正文");
    expect(s, "切出来的没有围栏本身").toContain("bun run build");
  });

  it("围栏里整行等于标题的,不算起点", () => {
    /*
     * 起点定位(`findIndex`)同样只该认围栏外的行。否则「切一节」切出来的是
     * **围栏里那行**到下一个标题之间 —— 一段既不是标题行、也不完整的残片。
     */
    const doc = [
      "# 顶层",
      "",
      "```text",
      "## 甲",
      "```",
      "",
      "## 甲",
      "",
      "真正的甲的正文。",
      "",
      "## 乙",
      "",
      "乙正文。",
    ].join("\n");
    const s = markdownSection(doc, "## 甲");
    expect(s.startsWith("## 甲\n\n真正的甲的正文。"), "起点定位到了围栏里那行").toBe(true);
    expect(s, "越界到了乙").not.toContain("乙正文");
  });

  it("波浪号围栏也认 —— 两种围栏写法不许只认一种", () => {
    const doc = [
      "## 丙",
      "",
      "~~~bash",
      "# 注释",
      "~~~",
      "",
      "丙的正文。",
      "",
      "## 丁",
      "",
      "丁正文。",
    ].join("\n");
    const s = markdownSection(doc, "## 丙");
    expect(s, "波浪号围栏里的 `#` 被当成了标题").toContain("丙的正文。");
    expect(s, "越界到了丁").not.toContain("丁正文");
  });

  it("围栏没闭合时,其后一律按围栏内处理(不猜半截围栏的语义)", () => {
    /*
     * 伞形兜底:闭合围栏缺失时,正文里剩下的 `#` 行仍然不该冒充标题。
     * 宁可少切一节(结果会包含后面所有内容),也不要在半截围栏里换边界。
     */
    const doc = ["## 戊", "", "```bash", "# 注释", "", "## 己", "", "己正文。"].join("\n");
    const s = markdownSection(doc, "## 戊");
    expect(s, "围栏没闭合时又把围栏里的 `#` 当成了边界").toContain("己正文。");
  });
});

/*
 * ⑦ `stopAtSub` —— 「待办 · 下一步」后面紧跟着一长串 `###` 历史记录。
 *
 * 按 markdown 语义,`###` 是 `##` 的小节,属于它;但「待办」这一节的实际边界
 * 就在第一个 `###` 之前 —— 后面那些是编年史,读的人不该把它当待办。
 * 两种口径都正当,故做成**显式开关**,默认仍是「只到同级或更高级」。
 */
describe("markdownSection · stopAtSub", () => {
  const SUB = [
    "## 甲",
    "",
    "甲的正文。",
    "",
    "### 甲一",
    "",
    "甲一的正文。",
    "",
    "#### 甲一之一",
    "",
    "更深那一层的正文。",
    "",
    "## 乙",
    "",
    "乙的正文。",
  ].join("\n");

  it("默认不停止于小节 —— 与从前口径一致", () => {
    const a = markdownSection(SUB, "## 甲");
    expect(a).toContain("甲一的正文。");
    expect(a).toContain("更深那一层的正文。");
    expect(a, "默认口径不该在 ### 处停").not.toContain("乙的正文");
  });

  it("打开时在第一个小节处停 —— 且不把更深的 `####` 留给下一节", () => {
    const a = markdownSection(SUB, "## 甲", { stopAtSub: true });
    expect(a, "切出来没有甲的正文").toContain("甲的正文。");
    expect(a, "停晚了,把 ### 小节也带上了").not.toContain("甲一的正文。");
    expect(a, "停晚了,把更深的正文也带上了").not.toContain("更深那一层的正文。");
    expect(a, "越界到了乙").not.toContain("乙的正文");
    expect(a.trimEnd().endsWith("甲的正文。"), "尾部不是甲的正文").toBe(true);
  });

  it("打开时对 `###` 标题同样生效(停在 `####`)", () => {
    const a1 = markdownSection(SUB, "### 甲一", { stopAtSub: true });
    expect(a1).toContain("甲一的正文。");
    expect(a1, "### 那一节没有在 #### 处停").not.toContain("更深那一层的正文。");
  });

  it("`stopAtSub` 不改起点定位 —— 起点仍按整行相等、围栏外匹配", () => {
    const doc = ["## 甲", "", "### 甲一", "", "甲一正文。", "", "## 乙", "", "乙正文。"].join("\n");
    const a = markdownSection(doc, "## 甲", { stopAtSub: true });
    // 甲的正文全在 ### 之后,故这一节只剩标题行本身 —— 这正是「停在小节」的含义
    expect(a.trimEnd(), "打开 stopAtSub 后仍带进了小节正文").toBe("## 甲");
  });
});
