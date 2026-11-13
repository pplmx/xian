/**
 * 源码注释里点名的文档必须存在 —— 一条指向空气的「去读某份文档」。
 *
 * ## 由来（第 168 轮）
 *
 * `core/contentReachabilityAudit.spec` 的文件头写着:
 *
 * ```text
 * 往这里加判据之前先读 docs/审计规范.md —— 每条判据都附有故障注入配方,
 * 新加的那条也得先证明自己能被打红,否则只是让测试计数 +1。
 * ```
 *
 * 而 `docs/审计规范.md` **不存在**。那份文档里最要紧的一条(每条判据都要能被打红)
 * 恰恰是这一轮反复栽的那件事 —— 判据写了三版都不红,而本该提醒我的那扇门是关着的。
 *
 * ## 为什么 `docs-check` 没拦住
 *
 * `scripts/docs-check.mjs` 扫的是**文档正文**里点名的路径。源码注释里的路径不在它的
 * 视野里 —— 而「去读 docs/xxx.md」这类指路多半写在源码注释里(那正是读者读到它的
 * 地方)。
 *
 * ## 判据
 *
 * 源码与脚本里出现的 `docs/*.md` 引用，逐个验存在。
 * 中文文件名也算 —— 第一版扫描的正则漏了中文,于是它报 0 条,而那条就摆在那儿。
 */
import { describe, expect, it } from "vite-plus/test";
import { existsSync } from "node:fs";
import { walkFiles, isSpecFile, isSourceFile, readSource, ROOT } from "@/test/readSource";
import { join } from "node:path";

/**
 * 源码里点名的 doc 路径。
 *
 * 字符类要**宽**:中文文件名(`docs/审计规范.md`)是合法且真实存在的写法。
 * 第一版写成 `[\w\u4e00-\u9fa5-]+` 而漏了实际那一条 —— 判据自己把自己写瞎了。
 */
const DOC_REF = /docs\/[A-Za-z0-9_\u4e00-\u9fa5-]+\.md/g;

describe("源码点名的文档 · 必须真实存在", () => {
  it("每一处 docs/*.md 引用都验证一遍", () => {
    /*
     * **用例文件也要扫**。第一版把 `.spec.ts` 排除了，而唯一那条坏引用恰好就写在
     * `contentReachabilityAudit.spec.ts` 的文件头里 —— 判据因此报绿，什么都没验到。
     * 「去读某份文档」这类指路，最常写的两个地方就是实现文件头和用例文件头。
     */
    /*
     * `isSourceFile` 本身就排除了 `.spec.ts`（见 `test/readSource`）—— 直接用它
     * 会漏掉用例文件头，而唯一那条坏引用恰好写在那里。故两个谓词都要。
     */
    const files = walkFiles("src", (f) => isSourceFile(f) || isSpecFile(f)).filter(
      /*
       * **排除本文件**：它的注释与样例字符串里写着 `docs/审计规范.md`
       * （正是那条要抓的路径），扫进来就成了「判据举报自己」。
       * 判据要排除的永远只有它自己，不是一大类文件。
       */
      (f) => !f.endsWith("docRefExistence.spec.ts"),
    );
    const broken: string[] = [];
    let refs = 0;
    for (const f of files) {
      const src = readSource(f);
      for (const m of src.matchAll(DOC_REF)) {
        refs += 1;
        if (!existsSync(join(ROOT, m[0]))) {
          broken.push(`${f.split("/").slice(-2).join("/")}: ${m[0]}`);
        }
      }
    }
    expect(broken, "这些注释让人去读一份不存在的文档").toEqual([]);
    expect(refs, "一条引用都没扫到 —— 判据瞎了").toBeGreaterThan(0);
  });

  it("判据自己验过它认得出中文文件名", () => {
    /*
     * 防空转的第二层:拿一条**已知存在**的中文名文档验一遍匹配。
     * 正则漏中文时,这一条会先红 —— 而不是等到「0 条引用」那种更难看出来的时候。
     */
    const sample = "去读 docs/design.md 与 docs/审计规范.md";
    const hits = [...sample.matchAll(DOC_REF)].map((m) => m[0]);
    expect(hits, "中文名的 doc 引用要能匹配到").toContain("docs/审计规范.md");
    expect(hits).toContain("docs/design.md");
  });
});
