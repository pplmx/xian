/**
 * 注释里引用代码片段时，要引用**常量名**，不要引用它此刻的数值。
 *
 * ## 由来（第 452 轮）
 *
 * `core/engineCraft.ts` 的文件头写着：
 *
 * ```text
 *   · 双成在成功之后再掷一次，且夹在 0.8：那行 `Math.min(0.8, …)` 的意图
 *     （"加成再高也别必双"）现在是库的参数。
 * ```
 *
 * 而代码第 44 行是 `Math.min(ALCHEMY_BONUS_CAP, …)` —— 常量在第 23 行。
 *
 * 这属于「注释落后于一次重构」：那句 `Math.min(0.8, …)` 曾是真实代码，
 * 后来被提成常量，注释没跟着改。**它不改变行为，但会让读注释的人以为那还是硬编码的。**
 *
 * ## 判据
 *
 * 扫 core 下的注释，找出 `Math.min/max(数字` 这种**看起来在引用代码**的写法，
 * 若同文件里有值相同的 UPPER_CASE 常量，就报出来。
 *
 * ## 为什么只有一条这么窄的规则
 *
 * 评论里出现数字是极常见且正当的（「夹在 0.8」「上限 75%」这类说明）。
 * 只有**带函数调用的那段代码形状**才是在引用实现 —— 那个边界划得很窄，
 * 是为了让这条判据不产生误报。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CORE = resolve(__dirname, ".");

describe("注释里引用代码 · 该引用常量名", () => {
  it("没有「注释写 Math.min(数字，而同文件有同值常量」的地方", () => {
    const hits: string[] = [];
    for (const f of readdirSync(CORE).filter((x) => x.endsWith(".ts") && !x.endsWith(".spec.ts"))) {
      const src = readFileSync(resolve(CORE, f), "utf-8");
      const consts = [...src.matchAll(/export const ([A-Z][A-Z0-9_]*) = ([0-9.]+)/g)].map((m) => ({
        name: m[1]!,
        val: m[2]!,
      }));
      for (const m of src.matchAll(/^\s*\*.*Math\.(?:min|max)\(([0-9]+(?:\.[0-9]+)?)/gm)) {
        const v = m[1]!;
        const c = consts.find((x) => x.val === v);
        if (c) hits.push(`${f}: 注释写 Math.*(${v},…)，而常量是 ${c.name}`);
      }
    }
    expect(
      hits,
      "这些注释引用的是数值而不是常量名 —— 常量一改它就过时：" + hits.join("；"),
    ).toEqual([]);
  });

  it("反差：注释里直接说数字是允许的 —— 判据只查「看起来在引用代码」的形状", () => {
    /*
     * 只禁 `Math.min(数字` 这种**函数调用形状**。同一批文件里必然还有大量
     * 「夹在 0.8」「上限 75%」这类纯说明 —— 它们不该被这条判据碰到。
     */
    let plainNumberComments = 0;
    for (const f of readdirSync(CORE).filter((x) => x.endsWith(".ts") && !x.endsWith(".spec.ts"))) {
      const src = readFileSync(resolve(CORE, f), "utf-8");
      plainNumberComments += (src.match(/^\s*\*.*夹在 [0-9]/gm) ?? []).length;
    }
    expect(
      plainNumberComments,
      "全仓没有一处「夹在 N」这类纯说明 —— 判据的边界量不到东西",
    ).toBeGreaterThan(0);
  });
});
