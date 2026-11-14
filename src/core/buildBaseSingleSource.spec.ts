/**
 * 构筑模拟的基准三维只能有一份 —— 它曾经写在两个文件里。
 *
 * ## 由来（第 209 轮，扫「两本账」）
 *
 * ```text
 * core/buildSearch.ts:41   const BASE = { attack: 100, defense: 55, maxHp: 1400 };
 * core/buildSim.ts:31      const BASE = { attack: 100, defense: 55, maxHp: 1400 };
 * ```
 *
 * 两处的用法**逐字相同**:
 *
 * ```ts
 * attack:  gn(BASE.attack  * 倍率),
 * defense: gn(BASE.defense * 倍率),
 * maxHp:   gn(BASE.maxHp   * 倍率),
 * ```
 *
 * 也就是说这是同一个基准，被抄了两遍。而**没有一条判据保证它们相等**。
 *
 * ## 为什么这算缺陷
 *
 * `buildSim` 拿它算「六路流派各自的基础三维」，`buildSearch` 拿它算
 * 「随机撒点的候选构筑」。两者最终都要进同一场战斗推演比高低 ——
 * 若有人调了其中一处（比如把 `maxHp` 从 1400 提到 1600），
 * 两边就**在同一张表上比不同基准的构筑**，而报告里看不出任何异常。
 *
 * ## 这条判据守什么
 *
 * 那个基准只许有一处定义，另一处必须 import 它。
 *
 * 不钉它叫什么、放在哪个文件 —— 只核「没有第二份字面量」。
 *
 * ## 故障注入
 *
 * 把 `const BASE = { attack: 100, defense: 55, maxHp: 1400 }` 抄回 `buildSearch.ts`
 * （并去掉那边的 import）→ 「字面量只出现一次」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const FILES = ["src/core/buildSearch.ts", "src/core/buildSim.ts"];

/** 认「三维基准」那种字面量：attack/defense/maxHp 三个键同时出现 */
const BASE_LITERAL = /\{\s*attack:\s*\d+,\s*defense:\s*\d+,\s*maxHp:\s*\d+\s*\}/;

describe("构筑基准 · 三维只许有一份定义", () => {
  it("判据的前提还在 —— 那两个文件都还在用这个基准", () => {
    for (const f of FILES) {
      const src = stripComments(readSource(f));
      expect(src, `${f} 里已经不用基准三维了 —— 判据该跟着改`).toMatch(
        /BASE\.(attack|defense|maxHp)/,
      );
    }
  });

  it("基准三维的字面量只出现一次", () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const src = stripComments(readSource(f));
      if (BASE_LITERAL.test(src)) hits.push(f.replace(/^.*\/src\//, "src/"));
    }
    expect(
      hits.length,
      "基准三维 `{ attack, defense, maxHp }` 在这两个文件里各写了一份 —— 《" +
        hits.join(" / ") +
        "》。两处都要进同一场战斗推演比高低:调了一处而不调另一处，" +
        "就会在同一张表上比不同基准的构筑，而报告里看不出任何异常",
    ).toBe(1);
  });

  it("另一处是从同一处 import 来的", () => {
    /*
     * 防空转的第二层:光「只有一份字面量」不够 —— 剩下的那一处要能被另一处读到。
     * 判法:两个文件里，至少有一个从另一个 import 了东西。
     */
    const [a, b] = FILES.map((f) => stripComments(readSource(f)));
    const aFromB = new RegExp(
      `from\\s+"\\./${FILES[1]!.replace(/^.*\//, "").replace(/\.ts$/, "")}"`,
    ).test(a!);
    const bFromA = new RegExp(
      `from\\s+"\\./${FILES[0]!.replace(/^.*\//, "").replace(/\.ts$/, "")}"`,
    ).test(b!);
    expect(
      aFromB || bFromA,
      "基准只留了一份，但两个文件之间没有任何 import —— 那另一处要么自己又算了一遍，" +
        "要么这一条判据漏看了什么",
    ).toBe(true);
  });
});
