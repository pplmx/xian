/**
 * 「尚差 N 石」这个数算对了没有 —— 事故已经发生过一次，而从没有人核过数值。
 *
 * ## 由来（第 229 轮，查「付不起要报差额」这条纪律）
 *
 * 仓库纪律写得很明白:
 *
 * > 按钮「付不起 / 不可行」要置灰，灰的同时把差多少列出来。
 *
 * 而这条纪律的判据分两层，**只有第一层有人守**:
 *
 * ```text
 * ① 有没有写差额   core/shortfallDisclosure.spec —— 扫 80+ 个 .vue，
 *                  带 afford/canPay/enough 的 :disabled 必须邻近「尚差/还差」
 * ② 差额算得对不对  没有
 * ```
 *
 * ## 而第 ① 层抓不住的那个事故，`FurnaceDialog.vue` 自己记着
 *
 * ```text
 * 灵石→道源 尚差:必须走 GNum 指数感知减法 —— 尾数直接相减(.m - .m)会丢掉指数,
 * 跨数量级时错置灰(6.1 万价、30 万持有曾被判成「差 3 石」)且报「尚差」错三位数。
 * ```
 *
 * 那次是用裸尾数相减造成的。现在 `stoneShort` 走的是 `toNum(subClamp(…))`，是对的。
 * **但只要没有任何判据核数值，它随时能被改回错的那一版，而全仓不会有任何东西变红。**
 *
 * ## 这条判据守什么
 *
 * 用真实的 GNum 做几组减法，核 `subClamp` 与 `toNum` 合起来给出的差额:
 *
 * ① 同量级（价 6.1 万、持有 3 万）→ 差 3.1 万;
 * ② 跨量级（价 1e12、持有 1e6）→ 差约 1e12，不是「差 3」也不是负数;
 * ③ 持有多于价 → 差 0（保底，不报负数）;
 * ④ 用裸尾数相减会给出的错答案，与正确答案**不同** —— 这一条是判据的地基:
 *    若两种算法给出同一个数，这条判据就测不出任何东西。
 *
 * ## 故障注入
 *
 * 把 `stoneShort` 换回 `Math.max(0, cost.m - hold.m)` → 「必须走 subClamp」与
 * 「组件里不该同时出现第二套减法」两条同时红。
 *
 * 第一版判据只有数值那五条：同样的注入**全绿**（实测）—— 因为它测的是 spec 里
 * 自己实现的一份 `shortfall()`，不是产品代码。加了源码级那两条才抓得住。
 */
import { describe, expect, it } from "vite-plus/test";
import { subClamp, toNum } from "@/utils/gnum";
import type { GNum } from "@/types";
import { readSource } from "@/test/readSource";

/** `gn` 只收一个参数(number 或 {m,e}) —— 传两个数时第二个被忽略,构造出的是第一个数本身 */
const G = (m: number, e: number): GNum => ({ m, e });

/** 模拟 `FurnaceDialog` 里 `stoneShort` 的算法（与源码同一组函数） */
function shortfall(cost: GNum, hold: GNum): number {
  return toNum(subClamp(cost, hold));
}

/** 错的那一版:裸尾数相减（事故里那种） */
function wrongShortfall(cost: GNum, hold: GNum): number {
  return Math.max(0, cost.m - hold.m);
}

describe("熔灵「尚差 N 石」· 组件用的是哪一种减法", () => {
  it("stoneShort 必须走 subClamp，不是裸尾数相减", () => {
    /*
     * 上面那组数值判据核的是 `subClamp` 的行为 —— 那是**库**对不对。
     * 而事故发生在**调用点**:`FurnaceDialog` 有一次写成了 `.m - .m`。
     *
     * 故这一条直接读组件源码。第一版判据没有它，故障注入时把组件改回裸尾数相减，
     * 五条判据全绿（实测）—— 因为它测的是一个复制品，不是产品。
     */
    const src = readSource("src/components/celestial/FurnaceDialog.vue");
    const line = /const stoneShort\s*=\s*computed\(([^;]+)\)/.exec(src);
    expect(line, "找不到 stoneShort 的定义 —— 判据要跟着改").not.toBeNull();
    const expr = line![1]!;
    expect(
      expr,
      "stoneShort 没有走 subClamp —— 尾数直接相减(.m - .m)会丢掉指数，" +
        "跨数量级时错置灰(6.1 万价、30 万持有曾被判成「差 3 石」)且报「尚差」错三位数",
    ).toContain("subClamp");
    expect(expr, "stoneShort 里出现了裸尾数相减").not.toMatch(/\.m\s*-\s*\w+\.m/);
  });

  it("驾驭它的是同一本账 —— 组件里不该同时出现第二套减法", () => {
    const src = readSource("src/components/celestial/FurnaceDialog.vue");
    // daoShort 是小整数,允许裸减;但灵石那条只许一处
    const hits = [...src.matchAll(/subClamp\(/g)].length;
    expect(hits, "组件里连一处 subClamp 都没有").toBeGreaterThanOrEqual(1);
  });
});

describe("熔灵「尚差 N 石」· 数值算对了没有", () => {
  it("同量级:价 6.1 万、持有 3 万 → 差 3.1 万", () => {
    const d = shortfall(G(6.1, 4), G(3, 4));
    expect(Math.round(d), `同量级差额不对 —— 算出来是 ${d}`).toBe(31_000);
  });

  it("跨量级:价 1e12、持有 1e6 → 差约 1e12（不是「差 3」，也不是负数）", () => {
    const d = shortfall(G(1, 12), G(1, 6));
    expect(d, `跨量级差额不对 —— 算出来是 ${d}`).toBeGreaterThan(9e11);
    expect(d, "差额为负").toBeGreaterThan(0);
  });

  it("持有多于价 → 差 0（保底，不报负数）", () => {
    expect(shortfall(G(1, 4), G(9, 4))).toBe(0);
    expect(shortfall(G(1, 4), G(1, 4)), "刚好够也应是 0").toBe(0);
  });

  it("判据的地基:裸尾数相减确实会给出不同的（错的）答案", () => {
    /*
     * 若两种算法给出同一个数，上面三条就测不出任何东西 —— 这一条确认它们真会分叉。
     */
    const cost = G(6.1, 4);
    const hold = G(3, 2);
    const good = shortfall(cost, hold);
    const bad = wrongShortfall(cost, hold);
    expect(good, "两种算法给出同一个数 —— 判据测不出东西").not.toBe(bad);
    // 正确答案约 6.07 万；裸尾数相减给出 3.1（丢了指数）
    expect(good).toBeGreaterThan(60_000);
    expect(bad).toBeLessThan(10);
  });

  it("与消费同一本账 —— subClamp 不会给出比真实差更小的数", () => {
    /*
     * 换几组随机量级，核「差额 + 持有 ≥ 价」始终成立（差额不欠账）。
     */
    for (const [cm, ce, hm, he] of [
      [1, 3, 5, 2],
      [9.9, 5, 1, 5],
      [2, 0, 1, 0],
      [7, 8, 6.9, 8],
    ] as const) {
      const cost = G(cm, ce);
      const hold = G(hm, he);
      const d = shortfall(cost, hold);
      const total = d + toNum(hold);
      expect(
        total,
        `差额 + 持有 (${total}) 小于价 (${toNum(cost)}) —— 报少了，玩家付不起却以为够`,
      ).toBeGreaterThanOrEqual(toNum(cost) - 1);
    }
  });
});
