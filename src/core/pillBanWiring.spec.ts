/**
 * `lifeTrialBansItem("pill")` 这件事，全仓没有一处调用。
 *
 * ## 由来（第 515 轮）
 *
 * 查「本世禁用某类物品」这条玩法面时，看到两处不对等:
 *
 * ```text
 *   lifeTrialService.ts:86   lifeTrialBansItem(kind: "artifact" | "pill")
 *                                                        ↑ 类型支持两档
 *   调用方                   只有 ArtifactPanel 一处，且只传 "artifact"
 *   数据                     只有一份契禁法宝（tr_qi）
 * ```
 *
 * 也就是说:**「禁丹药」这个概念在类型上存在、在数据上不存在、在实现上从没接过。**
 *
 * 而它比「禁法宝」更有决策价值:丹药是战斗中的紧急手段 ——
 * 禁掉它，玩家要改的不是「带什么」，而是「打不过时怎么办」。
 *
 * ## 判据
 *
 * ① 类型支持的两档，都必须有真实的调用方（否则那半边的类型是空头支票）;
 * ② 反差:未立契时两档都不禁 —— 不许把「没签」读成「禁了」;
 * ③ 反差:签了禁法宝那一份，只禁法宝，不许顺手把丹药也禁了。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/** 扫描全仓（除 spec）里 `lifeTrialBansItem(` 的实参 */
function banCallArgs(): string[] {
  const roots = ["src/core", "src/views", "src/components", "src/stores", "src/ui"];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === "node_modules" || name.name.startsWith(".")) continue;
      const full = resolve(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|vue)$/.test(name.name) || name.name.endsWith(".spec.ts")) continue;
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/lifeTrialBansItem\(\s*"(\w+)"\s*\)/g)) out.push(m[1]!);
    }
  };
  for (const r of roots) walk(resolve(__dirname, "..", "..", r));
  return out;
}

describe("逆旅契 · 禁用物品这条玩法面要两边都接上", () => {
  it("① 类型支持的两档，都必须有真实的调用方", () => {
    const args = new Set(banCallArgs());
    const missing = ["artifact", "pill"].filter((k) => !args.has(k));
    expect(
      missing,
      `lifeTrialBansItem 的类型支持 "artifact" | "pill"，但这些档没有调用方：` +
        missing.join("、") +
        " —— 那半边的类型是空头支票，写在数据里也不生效",
    ).toEqual([]);
  });

  it("② 反差：禁法宝与禁丹药是两份不同的契", () => {
    /*
     * 这一条守的是①的边界 —— 免得后来者图省事把两档合并成「禁一切物品」。
     * 「少一块面板」与「少一条退路」是两种难法，各有各的价。
     */
    const src = readFileSync(resolve(__dirname, "../data/lifeTrials.ts"), "utf8");
    expect(/bannedItemKind:\s*"artifact"/.test(src), "没有禁法宝那一份").toBe(true);
    expect(/bannedItemKind:\s*"pill"/.test(src), "没有禁丹药那一份").toBe(true);
  });
});
