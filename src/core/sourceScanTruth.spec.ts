/**
 * 扫源码的判据，得先分清「代码」与「字符串里的代码」。
 *
 * ## 由来（第 510 轮）
 *
 * 第 509 轮写 `testNameTruth.spec` 时，它的自证用例里写了一段假样本
 * （含 `it("…")` 字样），结果被本仓**另外两条**按行扫的判据当成真用例:
 *
 * ```text
 *   reportTestDecl.spec   红：「既无断言也无报告声明」
 * ```
 *
 * 而这不是第一次。三处判据各自都撞过同一个问题，而它们各自的办法都是
 * **把自己整个文件跳过**:
 *
 * ```text
 *   reportTestDecl.spec   name !== "reportTestDecl.spec.ts"
 *   specGapClaims.spec    x !== "specGapClaims.spec.ts"
 *   testNameTruth.spec    x !== "testNameTruth.spec.ts"
 * ```
 *
 * 跳过整个文件是「不再查自己」，而不是「查对」——
 * 那三份文件里的真实内容也因此脱离了检查。
 *
 * ## 判据
 *
 * ① `stripStringLiterals` 抹掉字符串里的内容，但**偏移量与行号不变**;
 * ② 抹完之后，假样本里的 `it("…")` 不再被当成用例;
 * ③ 反差：注释**不**被抹掉（判据常要扫注释里的说法）;
 * ④ 反差：代码里的标识符、函数调用、正则字面量的位置都不动。
 */
import { describe, expect, it } from "vite-plus/test";
import { stripStringLiterals } from "@/utils/sourceScan";

describe("扫源码 · 先分清代码与字符串", () => {
  it("① 抹掉字符串内容，但偏移量与行号不变", () => {
    const src = 'const a = "hello";\nconst b = `world`;\n';
    const out = stripStringLiterals(src);
    expect(out.length, "长度变了 —— 偏移量会错位").toBe(src.length);
    expect(out.split("\n").length, "行数变了 —— 报错位置会错位").toBe(src.split("\n").length);
    expect(out, "字符串里的内容没被抹掉").not.toContain("hello");
    expect(out, "字符串里的内容没被抹掉").not.toContain("world");
    expect(out, "代码部分被动了").toContain("const a =");
    expect(out, "引号本身该保留").toContain('"');
  });

  it('② 假样本里的 it("…") 不再被当成用例', () => {
    /*
     * 这正是第 509 轮撞到的那一段：判据的自证用例里写了一段假源码。
     */
    const fake = [
      "it(" + JSON.stringify("只有两项是真正的自动复利") + ", () => {",
      "  console.log(`自动复利 ${auto.length} 项`);",
      "});",
    ].join("\n");
    const out = stripStringLiterals(fake);
    /* 抹完之后，用例名不在文本里了 */
    expect(out, "用例名还在 —— 按行扫的判据仍会把它当真用例").not.toContain("只有两项");
    /* 但 `it(` 这个调用本身还在（它在代码里） */
    expect(out, "it( 被一起抹掉了 —— 那判据就找不到任何用例了").toContain("it(");
  });

  it("③ 反差：注释不被抹掉", () => {
    /*
     * 判据常要扫注释里的说法（比如「注释里的数与实现不一致」那一类）。
     * 故这个函数只抹字符串，不碰注释。
     */
    const src = '// 注释里的话要留着\nconst x = "字符串里的抹掉";\n';
    const out = stripStringLiterals(src);
    expect(out, "注释被抹掉了 —— 扫注释的判据会失效").toContain("注释里的话要留着");
    expect(out, "字符串没被抹掉").not.toContain("字符串里的抹掉");
  });

  it("④ 反差：转义与换行都不打乱偏移", () => {
    const src = 'const s = "a\\"b\\nc";\nconst t = 1;\n';
    const out = stripStringLiterals(src);
    expect(out.length, "转义处长度错位").toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out, "后面的代码被吞了").toContain("const t = 1;");
  });
});
