/**
 * 注释里的「92 部全部可抽」—— 池子过滤后到底剩几部。
 *
 * ## 缺口(第 110 轮实测)
 *
 * 第 109 轮核了注释里的两个丹药池,这轮把剩下 14 处「N 味/件/部/只/枚/种」声明
 * 逐条核完。13 处准确,一处不准:
 *
 * ```text
 *   gongfaService.ts:69   `pool` 只按 minRealm <= major + 1 过滤,境界 20 时几乎全开
 *                         (92 部里 91 部可抽)
 *   gongfaService.ts:86   池子只按 minRealm <= major + 1 过滤,境界 20 时 92 部里 91 部可抽
 * ```
 *
 * 而 `GONGFA` 里 `minRealm` 的最大值**就是 20** —— 境界 20 时 `20 <= 20 + 1` 成立,
 * **92 部全部可抽**。那个「91」大概是从某个更早的版本留下来的:当时有一部
 * `minRealm: 21`,后来那张表补到 92 部时上限降到了 20。
 *
 * 已改成「92 部全部可抽」。
 *
 * ## 判据
 *
 * 不扫文本(那句已经改成正确的了),而是把**口径本身**钉住:
 *
 * ① `GONGFA` 的 `minRealm` 最大值不超过 20 —— 这是「境界 20 时全开」的前提;
 * ② 由 ① 推出:命中境界 20 时的筛选后,剩下的就是全池。
 *
 * ②看起来是同义反复,但它守的是**未来的改动**:哪天有人加一部 `minRealm: 21`
 * 的功法,①会红,提醒回来同步那句注释。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";

describe("功法池 · 境界 20 时全开的前提", () => {
  it("① 没有功法的 minRealm 超过 20", () => {
    const over = GONGFA.filter((g) => (g as unknown as { minRealm?: number }).minRealm! > 20).map(
      (g) => `${g.name}(minRealm ${(g as unknown as { minRealm: number }).minRealm})`,
    );
    expect(
      over,
      "这些功法的 minRealm 超过 20 —— `gongfaService` 的注释说「境界 20 时 92 部全部可抽」," +
        "若真加了 21 的,那句话要改回「N 部里 M 部可抽」:" +
        over.join("、"),
    ).toEqual([]);
  });

  it("② 境界 20 时筛选后仍是全池", () => {
    const at20 = GONGFA.filter((g) => (g as unknown as { minRealm: number }).minRealm <= 20 + 1);
    expect(
      at20.length,
      `境界 20 时只筛出 ${at20.length}/${GONGFA.length} 部 —— 注释里「全部可抽」不成立了`,
    ).toBe(GONGFA.length);
  });

  it("反空转:功法表规模正常,minRealm 分布有梯度", () => {
    expect(GONGFA.length, "功法表空了").toBeGreaterThan(60);
    const realms = new Set(GONGFA.map((g) => (g as unknown as { minRealm: number }).minRealm));
    expect(realms.size, "所有功法的 minRealm 都一样 —— 池子没有梯度").toBeGreaterThanOrEqual(10);
  });
});
