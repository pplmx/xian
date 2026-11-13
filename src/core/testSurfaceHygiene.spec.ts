/**
 * 落在 `src/` 里的一次性探针 —— 那场「全量测试突然多出两次失败」事故的动作结论。
 *
 * ## 由来（第 172 轮）
 *
 * `docs/development.md` 记着一场真实事故:
 *
 * ```text
 * ?? src/core/__probe_tmp.spec.ts     ← 注释写着 TEMPORARY PROBE
 * ```
 *
 * 它是并行侦察留下的探针。收尾验证时 `vp test run` 从「627 个文件 / 5823 过」
 * 变成「628 个文件 / 2 败」,而 `git log` 干净、自己的改动早已提交并验过。
 *
 * 文档写下了结论:**收尾验证之前先跑一次 `git status --short`**。那条结论是对的,
 * 但它是一条**动作纪律** —— 只能靠人记得。而「记得」正是本仓反复失手的地方。
 *
 * ## 这条判据补的是什么
 *
 * `src/**` 就是测试面(`.spec.ts` 就是入口)。一个临时探针落在那里,
 * 「全绿」与「有失败」之间的差别立刻不可信 —— 而收尾时最需要的正是那份读数。
 *
 * 判据只认一件事:**文件名或文件头自认是临时的 spec,不许留在 `src/` 里**。
 * 这不是「不许调试」——探针该放在 `scripts/` 下、或者用完删掉。
 *
 * ## 口径
 *
 * 命中条件(任一即可,因为三种写法都见过):
 *
 * 1. 文件名里带 `probe` / `tmp` / `temp` / `scratch` / `demo` 这类词;
 * 2. 文件头 20 行里写着 `TEMPORARY` / `TEMP PROBE` / `一次性探针` 之类。
 *
 * 正常的 `*.spec.ts` 一个都不会命中 —— 判据自己另有一条反空转。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSpecFile, readSource } from "@/test/readSource";

/** 文件名里出现这些词，说明它是临时产物 */
const TEMP_NAME = /(?:^|[_\-.])(probe|tmp|temp|scratch|demo|playground|sandbox)(?:[_\-.]|$)/i;

/** 文件头自认是临时的写法 */
const TEMP_HEADER = /TEMPORARY|TEMP PROBE|一次性探针|临时探针|用完即删|scaffold/i;

describe("测试面 · 不许留一次性探针", () => {
  it("src 里的 spec 文件名不带临时词", () => {
    const bad = walkFiles("src", isSpecFile)
      .filter((f) => TEMP_NAME.test(f.split("/").pop() ?? ""))
      .map((f) => f.replace(/^.*\/src\//, "src/"));
    expect(
      bad,
      "这些文件看起来是一次性探针 —— 探针放 scripts/ 下，或用完删掉。" +
        "它们落在 src/ 会让「全量测试」的读数不可信",
    ).toEqual([]);
  });

  it("src 里的 spec 文件头不自认临时", () => {
    const bad: string[] = [];
    for (const f of walkFiles("src", isSpecFile)) {
      /*
       * **排除本文件** —— 它的文件头正写着那两个词（说明判据在抓什么）。
       * 这是上一轮同样的坑:判据举报自己。要排除的永远只有它自己。
       */
      if (f.endsWith("testSurfaceHygiene.spec.ts")) continue;
      const head = readSource(f).split("\n").slice(0, 20).join("\n");
      if (TEMP_HEADER.test(head)) bad.push(f.replace(/^.*\/src\//, "src/"));
    }
    expect(bad, "文件头写着 TEMPORARY / 一次性探针 —— 那种文件不该留在测试面里").toEqual([]);
  });

  it("防空转:扫到了足够多的 spec", () => {
    // 正则写错、路径变了,上面两条都会「永远绿」而什么都没验
    const count = walkFiles("src", isSpecFile).length;
    expect(count, "一个 spec 都没扫到 —— 判据空转").toBeGreaterThan(100);
  });

  it("判据自己认得出那两种写法（地基）", () => {
    // 文件名:那场事故的具体名字
    expect(TEMP_NAME.test("__probe_tmp.spec.ts"), "认不出事故里那个名字").toBe(true);
    /*
     * 裸名与前后缀形态都认（`tmp.spec.ts` / `tmp_x.spec.ts` / `x_tmp.spec.ts`）。
     * **不放宽到「包含即命中」** —— 那会把 `template.spec.ts` 也判成临时文件
     * （实测：`…(?:[_.-]|$)` 收到后面时 `tmpHelper` 不匹配，而放宽之后
     * `template` 会匹配)。宁可漏一个臆想的名字，不要误伤真文件。
     */
    expect(TEMP_NAME.test("tmp.spec.ts"), "裸 tmp").toBe(true);
    expect(TEMP_NAME.test("tmp_probe.spec.ts"), "下划线后缀").toBe(true);
    expect(TEMP_NAME.test("x_tmp.spec.ts"), "下划线前缀").toBe(true);
    expect(TEMP_NAME.test("template.spec.ts"), "误伤:template 不是临时文件").toBe(false);
    expect(TEMP_NAME.test("probe.spec.ts")).toBe(true);
    // 正常名字不许误报
    expect(TEMP_NAME.test("offlineClockSkew.spec.ts")).toBe(false);
    expect(TEMP_NAME.test("trialForecast.spec.ts")).toBe(false);
    expect(TEMP_NAME.test("expIncome.spec.ts")).toBe(false);
    // 文件头
    expect(TEMP_HEADER.test("/** TEMPORARY PROBE —— 用完删 */")).toBe(true);
    expect(TEMP_HEADER.test("/** 离线结算的判据 */")).toBe(false);
  });

  it("真正的事故文件名命中了这条判据（可复现）", () => {
    /*
     * 那场事故的文件叫 `__probe_tmp.spec.ts` —— 放在 `src/core/` 下。
     * 用它逐字验一遍:若这个文件真回来了,本判据会红。
     */
    expect(TEMP_NAME.test("__probe_tmp.spec.ts")).toBe(true);
  });
});
