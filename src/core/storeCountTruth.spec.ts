/**
 * README 说「N 个 store」，而实际有 M 个。
 *
 * ## 由来（第 448 轮）
 *
 * 第 446 轮补了 `development.md` 的导引之后，这一轮去核**数字类**的说法 ——
 * 也就是 `AGENTS.md` 说的「先在源码里找注释，再找判据」之外的那一层：**文档与实现**。
 *
 * 抓到的一处：
 *
 * ```text
 *   README   「18 个 store，除瞬态 ui 外 17 个自动持久化」
 *   实际      19 个 .ts 文件（17 个含 persist + ui + apexCultivation）
 * ```
 *
 * 17 那个数是**对的**（持久化的确实 17 个），错的是「总数 18」——
 * 而它之所以错，是因为后来多了第 19 个文件，那句话没跟着改。
 *
 * ## 为什么这类数会被漏
 *
 * 它在 README 的**技术栈表格**里，不在正文行文中 —— 而 `docs-check` 查的是
 * 「文档点名的路径存在」，不查「表格里的数」。于是它没有任何东西守着。
 *
 * ## 判据
 *
 * ① README 里那句 store 总数与实际文件数一致；
 * ② 三个子数（持久化 / 瞬态 / 纯接线）加起来等于总数 —— 否则句子自相矛盾；
 * ③ 反差：`ui` 必须是真的不落盘（那句「瞬态」要有依据）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const README = readFileSync(resolve(ROOT, "README.md"), "utf-8");

/** 所有 store 文件（去掉用例） */
const STORE_FILES = readdirSync(resolve(ROOT, "src/stores"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
  .map((f) => f.replace(/\.ts$/, ""));

/** 含 persist 的 store */
const PERSISTING = STORE_FILES.filter((f) =>
  /persist/.test(readFileSync(resolve(ROOT, `src/stores/${f}.ts`), "utf-8")),
);

describe("README 的 store 数 · 与实际对得上吗", () => {
  it("① 总数与实际文件数一致", () => {
    const m = /(\d+) 个 store/.exec(README);
    expect(m, "README 里找不到「N 个 store」那句话").not.toBeNull();
    expect(
      Number(m![1]),
      `README 说 ${m![1]} 个 store，实际 ${STORE_FILES.length} 个 —— ` +
        "加 store 时请连同这句话一起改",
    ).toBe(STORE_FILES.length);
  });

  it("② 三个子数加起来等于总数 —— 否则那句话自相矛盾", () => {
    const m = /(\d+) 个自动持久化/.exec(README);
    expect(m, "README 里找不到「N 个自动持久化」").not.toBeNull();
    expect(
      Number(m![1]),
      `README 说 ${m![1]} 个持久化，实际 ${PERSISTING.length} 个（含 persist 的 store）`,
    ).toBe(PERSISTING.length);
    /*
     * 总数 = 持久化 + 瞬态(ui) + 纯接线(apexCultivation)。
     * 这条不是算出来的，是**指名**的 —— 那两句里点了这两个名字，故它们必须存在。
     */
    expect(STORE_FILES, "README 点名的瞬态 ui 不存在了").toContain("ui");
    expect(STORE_FILES, "README 点名的纯接线 apexCultivation 不存在了").toContain(
      "apexCultivation",
    );
    expect(
      PERSISTING.length + 2,
      "持久化数 + 两个点名的特例，应当等于总数 —— 多出的那个没被这句话解释",
    ).toBe(STORE_FILES.length);
  });

  it("③ 反差：那句「瞬态」要有依据 —— ui 确实不落盘", () => {
    const ui = readFileSync(resolve(ROOT, "src/stores/ui.ts"), "utf-8");
    expect(ui, "ui 现在是持久化的了 —— README 那句「瞬态」已过时").not.toMatch(/persist/);
    expect(ui, "ui 的文件头没写明它不持久化").toMatch(/不持久化|瞬态/);
  });
});
