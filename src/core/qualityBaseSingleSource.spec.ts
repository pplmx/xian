/**
 * 品质的基础抽取权重，两个池子必须同源。
 *
 * ## 由来（第 450 轮）
 *
 * `singleSourceAudit` 守着七处「同一个数不许算两遍」，而下面这一处它没覆盖 ——
 * 我是用「跨文件完全相同的公式行」扫出来的:
 *
 * ```text
 *   core/gongfaService.ts   const qualityWeight = 100 / (1 + qualityDef(def.quality).rank * 1.5);
 *   core/loot.ts            const qualityWeight = 100 / (1 + qualityDef(def.quality).rank * 1.5);
 * ```
 *
 * 两处**故意有不同的就近加成**（功法窗口 12、法宝窗口 5），故它们不该被合并成
 * 一个函数 —— 但「品质本身值多少」那一项必须是同一个数。
 *
 * 这种漂移的危险在于**两份代码各自读起来都是对的**:
 *
 * ```text
 *   改了功法那边的 1.5 → 0.9
 *   → 功法池变得更平（高品更容易撞见）
 *   → 法宝池不变
 *   → 没有任何东西会红，而两个池子的稀有度悄悄分家
 * ```
 *
 * ## 判据
 *
 * ① 两个池子算出的品质权重，对每一档品质都逐位相等；
 * ② 反差：那两个函数本身**不许**被合并成一个（它们的就近加成不同）——
 *    这条守的是「同源的是基础项，不是整个函数」这个边界。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QUALITIES, qualityBaseWeight } from "@/data/qualities";
import { stripComments } from "@/test/stripComments";

const GONGFA = stripComments(readFileSync(resolve(__dirname, "gongfaService.ts"), "utf-8"));
const LOOT = stripComments(readFileSync(resolve(__dirname, "loot.ts"), "utf-8"));

describe("品质基础权重 · 两个池子同源", () => {
  it("① 两条公式都读同一个函数，不各写一遍", () => {
    for (const [name, src] of [
      ["gongfaService", GONGFA],
      ["loot", LOOT],
    ] as const) {
      expect(src, `${name} 又自己写了一遍品质权重公式`).toContain("qualityBaseWeight(");
      expect(
        src,
        `${name} 里还留着硬编码的 1 + …rank … * 1.5 —— 那一份没有跟着共享函数走`,
      ).not.toMatch(/100\s*\/\s*\(1\s*\+[^\n]*rank\s*\*\s*1\.5\)/);
    }
  });

  it("② 基础权重对每一档品质都落在一个确定的数上", () => {
    /*
     * 这条钉住的是**曲线本身**，不只是「两处相等」—— 若哪天有人把共享函数的
     * 系数改掉，这里会指出新的曲线长什么样，而不是只报一个「不等」。
     */
    const table = QUALITIES.map((q) => ({ id: q.id, rank: q.rank, w: qualityBaseWeight(q.id) }));
    for (const row of table) {
      const want = 100 / (1 + row.rank * 1.5);
      expect(row.w, `品质 ${row.id} 的基础权重变了`).toBeCloseTo(want, 10);
    }
    /*
     * 单调递减 —— 高品质必须更难抽。这条是那两个池子共同的**语义承诺**。
     */
    const sorted = [...table].sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(
        sorted[i]!.w,
        `rank ${sorted[i]!.rank} 的权重不低于 rank ${sorted[i - 1]!.rank} —— 高品质反而更容易抽`,
      ).toBeLessThan(sorted[i - 1]!.w);
    }
  });

  it("③ 反差：就近加成仍然各算各的 —— 那两个函数不该被合并", () => {
    /*
     * 功法的邻近窗口是 12、倍率 1.5；法宝是 5 与 ARTIFACT_NEAR_BONUS。
     * 若有人「为了同源」把它们合并成一个函数，两边的手感会被拉平 ——
     * 那不是这一轮想做的事。
     */
    expect(GONGFA, "功法的邻近窗口不见了").toMatch(/12\s*-\s*distance/);
    expect(LOOT, "法宝的就近窗口不见了").toMatch(/ARTIFACT_NEAR_WINDOW/);
    expect(GONGFA, "两边被合并成同一个函数了").toMatch(/export function gongfaDrawWeight/);
    expect(LOOT, "两边被合并成同一个函数了").toMatch(/export function artifactDropWeight/);
  });
});
