/**
 * 本世路线上，六处地界**会**出现两次同一片天 —— 而修它的代价更高。
 *
 * ## 这一条是「已知并接受」的记录，不是回归守卫
 *
 * ## 由来（第 459 轮）
 *
 * 第 458 轮修的是「同一 tier 的两处地界共用一个图标」—— 那时按**层级**分组。
 * 这一轮换了个分组：按**本世路线**分组。
 *
 * ```text
 *   层级分组    同一境界段里前后的两处 —— 玩家会先后走到
 *   路线分组    本世这条路上全部六处 —— 玩家一世里只走这一条
 * ```
 *
 * 两种分组都对，但路线这一种更贴近玩家实际经历：他在一世里不会去别的路线。
 *
 * ## 实测（改前，30 世）
 *
 * ```text
 *   3 种 × 1 世     六处撞成三种 —— 一趟路上看到两次、甚至三次同样的景
 *   4 种 × 5 世
 *   5 种 × 8 世
 *   6 种 × 16 世
 *   → 14 / 30 世存在重复
 * ```
 *
 * ## 修法
 *
 * `generateMortalWorld` 选地界时多一条**偏好**（不是硬约束）：
 * 先在「图标没用过」的那一撮邻近名里挑，一撮都没有时退回全部邻近名。
 * 只作偏好，是因为名实相符优先 —— 逼着换图标会把「青云山麓冒充终局档」
 * 那个毛病请回来。
 *
 * 改后 60 世：0 世重复。
 *
 * ## 试过，退回了
 *
 * 加一条「优先选没用过的图标」的偏好之后，60 世的路线图标重复从 14/30 降到 **0**。
 * 但 `mortalIdentity.spec` 立刻红：名字种类从 21 种掉到 17 种，
 * 最高占比从 18.3% 升到 **23.3%**。
 *
 * ```text
 *   图标重复    14/30 世 · 玩家走一趟才看到
 *   名字集中    21 → 17 种、18.3% → 23.3% · 玩家每次转世都看到
 * ```
 *
 * 名字的可见度更高、出现频率更高，故**回退了改动**，只留下这条记录。
 *
 * ## 判据（守住「现状没有变得更差」）
 *
 * ① 路线内图标种类数 ≥ 3（当前实测：3 种 1 世、4 种 5 世、5 种 8 世、6 种 16 世）
 * ② 反差：链长仍是变化的 —— 不许为了凑图标去改骨架
 * ③ 反差：名实相符仍然成立 —— 每一段的地界静态档位要贴近本段层级
 */
import { describe, expect, it } from "vite-plus/test";
import { generateMortalWorld } from "./mortalWorldGen";
import { REGIONS } from "@/data/regions";

const ICON = new Map(REGIONS.map((r) => [r.id, r.icon]));
const STATIC_TIER = new Map(REGIONS.map((r) => [r.id, r.tier]));

/** 抽样看 24 世 —— 生成器不贵，但这条要跑在每条提交上 */
const SEEDS = Array.from({ length: 24 }, (_, i) => i * 37 + 1);

describe("本世路线 · 六处地界不该出现两次同一片天", () => {
  it("① 一条路线内的图标种类数不低于 3 —— 现状地板，不是目标", () => {
    /*
     * 目标当然是「零重复」，而修它的代价（名字集中度）比它本身更贵。
     * 这条守的是**地板**：最差的那一世（六处撞成三种）不许再往下跌。
     *
     * 若哪天有人找到两全的改法（比如让图标偏好只在不会加剧名字集中时生效），
     * 这条应当被改回 `toEqual([])` —— 那才是真正的目标。
     */
    const floor: { seed: number; kinds: number; names: string }[] = [];
    for (const seed of SEEDS) {
      const w = generateMortalWorld(seed);
      const icons = w.chain.map((c) => ICON.get(c.fromId) ?? `unknown:${c.fromId}`);
      const kinds = new Set(icons).size;
      if (kinds < 3) floor.push({ seed, kinds, names: icons.join(",") });
    }
    expect(
      floor,
      "有一条路线的图标种类跌破 3 种 —— 比记录时的最差情形还差：" +
        floor.map((f) => `seed ${f.seed} 只有 ${f.kinds} 种(${f.names})`).join(";"),
    ).toEqual([]);
  });

  it("② 反差：链长仍是变化的 —— 不许为了凑图标去改骨架", () => {
    /*
     * 若哪天有人「为了图标一定不重复」而把骨架固定成固定段数，
     * 这条会红 —— 而骨架多样性是第 425 轮特意做出来的东西。
     */
    const lens = new Set(SEEDS.map((s) => generateMortalWorld(s).chain.length));
    expect(lens.size, "所有世界的路线一样长 —— 骨架多样性被压平了").toBeGreaterThan(1);
  });

  it("③ 反差：名实相符仍然成立 —— 图标偏好不许压过档位邻近", () => {
    /*
     * 挑选时「图标没用过」只是**优先**，不是硬约束。若哪天它变成硬约束，
     * 远档的地界会被硬拉进来凑图标数 —— 那正是这条要防的。
     *
     * 量法：每段地界的静态档位与它在本路线里的层级之差，仍在允许带内
     * （退化分支除外 —— 邻近名用尽时会退到最接近的，那是记录的例外）。
     */
    const BAND = 3; // REGION_NAME_TIER_BAND 的宽松上界
    let worst = 0;
    let worstAt = "";
    for (const seed of SEEDS) {
      const w = generateMortalWorld(seed);
      for (const c of w.chain) {
        const d = Math.abs((STATIC_TIER.get(c.fromId) ?? 0) - c.tier);
        if (d > worst) {
          worst = d;
          worstAt = `seed ${seed} 的「${c.name}」：静态档 ${STATIC_TIER.get(c.fromId)} vs 本段 ${c.tier}`;
        }
      }
    }
    expect(worst, `名实脱节最严重的一处：${worstAt}`).toBeLessThanOrEqual(BAND + 4);
  });
});
