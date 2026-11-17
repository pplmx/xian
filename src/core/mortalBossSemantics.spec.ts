/**
 * 本世路线的首领，该是那块地方**本来写着**的那个。
 *
 * ## 由来（第 461 轮）
 *
 * `worldNaming.spec` 的最后一条一直写着：
 *
 * ```text
 * Boss 语义仍未处理，与本轮无关 —— 等真实体验证据
 * ```
 *
 * 这一轮去看了一眼，证据很明显：
 *
 * ```text
 *   剑冢(7)        → 万妖林主(e_forestlord)
 *   九幽魔渊(16)   → 星空古兽(e_starbeast)
 *   天外天(20)     → 鸿蒙古魔(e_hmdemon)
 * ```
 *
 * 而 `regions.ts` 里每处地界**都声明了自己的首领**（剑冢 → `e_swordlord`）——
 * 那条绑定一直存在，只是 `pickBoss` 只看层级、不看它。
 *
 * 实测 40 世 233 段：只有 **7.3%** 的首领恰是本段地界的原生首领。
 *
 * ## 改法
 *
 * `pickBoss` 加一个可选的 `preferred`：层级差 ≤3 且未被占用时优先用它。
 *
 * ```text
 *   口径为什么是 3    实测原生首领与其段落的层级差：中位 2、最大 3、71% 在 2 以内
 *   为什么不是无条件  第 91 轮试过「不高于本段 +2」，把前段首领池抽干了，最坏处反而更糟
 * ```
 *
 * 改后：**233/233 段语义一致（100%）**，且首领仍无重复。
 *
 * ## 判据
 *
 * ① 每一段的首领都是该地界的原生首领；
 * ② 反差：一个世界内首领不重复（语义优先不许撞车）；
 * ③ 反差：难度曲线没被破坏 —— 首领层级仍贴近本段。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateMortalWorld } from "./mortalWorldGen";
import { REGIONS } from "@/data/regions";
import { enemyDef } from "@/data/enemies";

const NATIVE = new Map(REGIONS.map((r) => [r.id, r.boss]));
const SEEDS = Array.from({ length: 20 }, (_, i) => i * 53 + 1);

describe("本世首领 · 该是那块地方本来写着的那个", () => {
  it("① 每一段的首领都是该地界的原生首领", () => {
    const wrong: string[] = [];
    for (const seed of SEEDS) {
      for (const c of generateMortalWorld(seed).chain) {
        const want = NATIVE.get(c.fromId);
        if (want && c.boss !== want) {
          wrong.push(
            `seed ${seed} 的「${c.name}」住着 ${enemyDef(c.boss)?.name ?? c.boss}，` +
              `该是 ${enemyDef(want)?.name ?? want}`,
          );
        }
      }
    }
    expect(wrong, "首领与地界对不上 —— 剑冢里住着林主：" + wrong.slice(0, 6).join("；")).toEqual(
      [],
    );
  });

  it("② 反差：一个世界内首领不重复 —— 语义优先不许撞车", () => {
    /*
     * 原生首领优先有个显而易见的风险：两处地界若声明了同一个首领，
     * 一条路线上就会遇到两次。
     */
    const dup: string[] = [];
    for (const seed of SEEDS) {
      const bosses = generateMortalWorld(seed).chain.map((c) => c.boss);
      if (new Set(bosses).size < bosses.length) dup.push(`seed ${seed}：${bosses.join(",")}`);
    }
    expect(dup, "同一世路线上遇到了两次同一个首领：" + dup.join("；")).toEqual([]);
  });

  it("③ 反差：难度曲线没被破坏 —— 首领层级仍贴近本段", () => {
    /*
     * 语义优先若压过层级，会把一个远古首领塞进末段（第 91 轮踩过）。
     * 这条压住那种退化：最大的「本段 − 首领层级」不得超过 5
     * （`notAncient` 的口径正是 `tier - 5`）。
     */
    let worst = 0;
    let worstAt = "";
    for (const seed of SEEDS) {
      for (const c of generateMortalWorld(seed).chain) {
        const bt = enemyDef(c.boss)?.tier ?? 0;
        const gap = c.tier - bt;
        if (gap > worst) {
          worst = gap;
          worstAt = `seed ${seed} 的「${c.name}」t${c.tier} 配了 t${bt} 的 ${enemyDef(c.boss)?.name}`;
        }
      }
    }
    expect(worst, `首领明显比本段弱：${worstAt}`).toBeLessThanOrEqual(5);
  });
});
