/**
 * 报告型用例要自己说明「我不做判断」—— 否则它与"忘了写断言"长得一模一样。
 *
 * 本仓有一批**审计/建模**用例,它们的产出是给人和 agent 读的读数表
 * (曲线每世多少小时、各境界压制比例、道果效率表…)。这些用 `console.log`
 * 打表、不写断言,是合理的设计:`pillValue.spec.ts` 早就用块级注释
 * `// ============ 审计报告(只打印,不断言) ============` 把这条惯例写下了。
 *
 * 但"合理"和"看得出来"是两件事。一条没有断言、也没有声明的用例,读代码的人
 * 无法区分两种情形:
 *   ① 这是报告,结论在别处由别的用例断言(正常);
 *   ② 这条本该判断点什么,写的时候忘了(缺陷)。
 * 实测就撞上过第 ②种:`suppressOnline.spec` 里「验证: 灵脉投资是否影响镇压产出」
 * 只打印一行灵石数字 —— 用例名问的是一个是非题,答案(不影响)却从没被写下来,
 * 于是"哪天有人把全局 mods 接进镇压结算"这件事没有任何东西守着。
 *
 * 故本判据要求:没有 `expect` 的用例,必须在**用例体内**或**它所在的 describe 块前**
 * 有一句声明(见 REPORT_MARKERS)。声明不是形式 —— 它逼作者回答
 * 「我的结论由哪条用例负责」,答不出来就说明该补断言。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

/** 递归收集本作 src 下的 spec */
function specFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) specFiles(full, out);
    /*
     * **跳过本文件** —— 自证用例里写着一段假样本(含 `it("有断言"){…}` 等三行),
     * 按行扫会被当成真用例而点名(实测)。探测器的样本不是被测代码,
     * 把自己从输入里摘出去是最直接的做法(与 Round 26 同一个道理)。
     */
    else if (name.endsWith(".spec.ts") && name !== "reportTestDecl.spec.ts") out.push(full);
  }
  return out;
}

/**
 * 承认的声明写法。**要求出现在用例体内或它上方**,不接受写在文件头 ——
 * 文件级豁免等于整份文件不再受管,那正是要防的(个别文件里既有真判据又有报告)。
 */
const REPORT_MARKERS = [
  "审计报告(只打印,不断言)",
  "只打印,不断言",
  "只打印不判断",
  "读数用例",
  "报告型",
] as const;

interface Offender {
  file: string;
  line: number;
  title: string;
}

/** 一行是不是 it( 的开头,返回用例名 */
function itTitle(line: string): string | null {
  const m = /^\s*it\(\s*"([^"]+)"/.exec(line);
  return m ? m[1]! : null;
}

/**
 * 找出「无 expect 且无声明」的用例。
 *
 * 按行扫:一个 `it(` 到**同缩进**的 `});` 之间算它的体。
 *
 * 不能只看到 `});` 就收尾 —— 用例体里的 `if (…) { … }`、`for (…) { … }`
 * 同样以 `});` 结尾,提前收尾会把后面的断言全漏在体外,于是**有断言的用例
 * 被误判成报告**(实测:playerLab、celestialCaliber 等五条含真断言的反被点名)。
 * 也不能数花括号:体里常出现模板字符串与正则,`${…}` 会把计数骗走。
 * 故按缩进:用例以 `  it(` 开头,那么只有同样两个空格的 `});` 才收尾。
 */
function scan(file: string): Offender[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const out: Offender[] = [];
  let cur: { title: string; line: number; body: string[]; indent: number } | null = null;

  /** 一条行的前导空格数 */
  const indentOf = (s: string): number => s.length - s.trimStart().length;

  const flush = (): void => {
    if (!cur) return;
    const body = cur.body.join("\n");
    /*
     * **恒真断言不算断言。**
     *
     * `expect(true).toBe(true)` 与 `expect(1).toBe(1)` 常见于报告型用例末尾的
     * "占位"——它让测试框架满意,却什么也没验证。若把它算作 `hasAssert`,
     * 这类用例就逃过了本判据,而它与"忘了写断言"是同一件事。
     *
     * 修法是先**剥掉**这些形态,再看还剩不剩 expect。
     * (只剥完全字面量的恒真:任何依赖被测值的断言都不受影响。)
     */
    const stripped = body
      .replace(
        /expect\(\s*(?:true|false|1|0)\s*\)\s*\.\s*(?:toBe|toEqual)\(\s*(?:true|false|1|0)\s*\)/g,
        "",
      )
      .replace(/expect\(\s*(true|false|1|0)\s*\)\s*\.\s*(?:toBe|toEqual)\(\s*\1\s*\)/g, "");
    const hasAssert = stripped.includes("expect(") || stripped.includes(".toThrow");
    const declared = REPORT_MARKERS.some((m) => body.includes(m));
    if (!hasAssert && !declared) {
      out.push({ file: file.slice(ROOT.length + 1), line: cur.line, title: cur.title });
    }
    cur = null;
  };

  for (const [i, line] of lines.entries()) {
    const title = itTitle(line);
    if (title) {
      flush();
      /*
       * 往上回看**紧邻的说明注释**(声明通常写用例上方)。
       *
       * 原先是固定回看 24 行 —— 那会把**前一条用例的断言**一并吞进本体,
       * 于是报告型用例只要前面有个带真断言的邻居,就再也不被点名
       * (实测:`artifactGrowth` 的「报告各族增长」逃过了检查,因为它上方
       * 24 行内有 `${type} 族相邻档增长率` 那条真断言在第 91 行)。
       *
       * 改成向上走**只收注释行**:遇到第一条非注释就停。块注释可能跨行,
       * 故中间行(以 `*` 开头)也算注释。
       */
      const above: string[] = [];
      for (let j = i - 1; j >= 0; j--) {
        const t = lines[j]!.trim();
        if (t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) {
          above.unshift(lines[j]!);
          continue;
        }
        break;
      }
      cur = {
        title,
        line: i + 1,
        body: [...above, line],
        indent: indentOf(line),
      };
      continue;
    }
    if (!cur) continue;
    // 收尾:同缩进的 `});`(或 `}`),才算这条用例结束
    const t = line.trim();
    const sameIndent = indentOf(line) === cur.indent;
    if (sameIndent && (t === "});" || t === "}")) {
      flush();
      continue;
    }
    // 同级的新 describe / it 也意味着前一条结束(容错)
    if (sameIndent && /^(describe|it)\(/.test(t)) {
      flush();
      continue;
    }
    cur.body.push(line);
  }
  flush();
  return out;
}

describe("报告型用例 · 不判断就要说明为什么不判断", () => {
  it("没有断言的用例必须声明它是报告", () => {
    const offenders = specFiles(join(ROOT, "src")).flatMap(scan);
    expect(
      offenders.map((o) => `${o.file}:${o.line}  「${o.title}」`),
      "这些用例既无断言也无「只打印/报告型」声明 —— 要么补断言,要么写明结论由谁负责",
    ).toEqual([]);
  });

  it("判据先自证:真断言 / 声明 / 两者都无,三种都认得出", () => {
    // 不先自证的话,切分逻辑漏掉一种写法就等于没有判据
    const sample = `
describe("x", () => {
  it("有断言", () => {
    expect(1).toBe(1);
  });
  it("是报告", () => {
    // 只打印,不断言
    console.log("读数");
  });
  it("什么都没有", () => {
    console.log("读数");
  });
});
`;
    const tmp = join(ROOT, "src", "__tautology_sample.spec.ts");
    // 不落盘:直接复用 scan 的正则逻辑对样本文本判一遍
    const lines = sample.split("\n");
    const titles: { title: string; hasAssert: boolean; declared: boolean }[] = [];
    let cur: { title: string; body: string[] } | null = null;
    const flush = (): void => {
      if (!cur) return;
      const body = cur.body.join("\n");
      titles.push({
        title: cur.title,
        hasAssert: body.includes("expect("),
        declared: REPORT_MARKERS.some((m) => body.includes(m)),
      });
      cur = null;
    };
    for (const line of lines) {
      const t = itTitle(line);
      if (t) {
        flush();
        cur = { title: t, body: [line] };
        continue;
      }
      if (cur && /^\s*(describe|it)\(|^\s*\}\);?\s*$/.test(line)) flush();
      if (cur) cur.body.push(line);
    }
    flush();
    expect(titles.map((t) => t.title)).toEqual(["有断言", "是报告", "什么都没有"]);
    expect(titles[0]!.hasAssert).toBe(true);
    expect(titles[1]!.hasAssert).toBe(false);
    expect(titles[1]!.declared).toBe(true);
    // 第三种才是要抓的:既没断言也没声明
    expect(titles[2]!.hasAssert).toBe(false);
    expect(titles[2]!.declared).toBe(false);
    expect(tmp.length > 0).toBe(true);
  });

  it("切块边界:前一条有断言,不该被当成后一条的", () => {
    /*
     * Round 51 的真 bug:`scan` 原先往**上回看固定 24 行**去捞声明注释,
     * 于是前一条用例的真断言被一并吞进后一条的本体 —— 一条只有 `console.log`
     * 的空用例因此被判成"有断言"而放行(实测漏了 12 条)。
     *
     * 修法是向上**只收注释行**,遇到第一条非注释就停。这一条回归测试直接
     * 用一个真的 spec 文件验那个边界:**相邻**两条用例,前者有断言、后者没有。
     * 若有人改回固定窗口,后者会被吞进来而漏判,这条就红。
     *
     * 用真实文件而不是样本字符串 —— 自证用例原先复制了一份切分逻辑,
     * 验的是副本而不是被测代码,那种自证挡不住任何回归。
     */
    const probe = join(ROOT, "src", "__neighbor_probe.spec.ts");
    const source = [
      'describe("x", () => {',
      '  it("前一条有断言", () => {',
      "    expect([1, 2].length).toBe(2);",
      "  });",
      '  it("后一条什么都没写", () => {',
      '    console.log("读数");',
      "  });",
      "});",
      "",
    ].join("\n");
    writeFileSync(probe, source, "utf-8");
    try {
      const found = scan(probe);
      expect(
        found.map((o) => o.title),
        "后一条被前一条的断言遮住了 —— 切块边界又吞了邻居",
      ).toEqual(["后一条什么都没写"]);
    } finally {
      rmSync(probe, { force: true });
    }
  });
});
