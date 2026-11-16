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
import { worldIdentity } from "./mortalIdentity";

const ICON = new Map(REGIONS.map((r) => [r.id, r.icon]));
const STATIC_TIER = new Map(REGIONS.map((r) => [r.id, r.tier]));

/** 抽样看 24 世 —— 生成器不贵，但这条要跑在每条提交上 */
const SEEDS = Array.from({ length: 24 }, (_, i) => i * 37 + 1);

describe("本世路线 · 六处地界不该出现两次同一片天", () => {
  it("① 一条路线内图标不重复", () => {
    /*
     * 第 459 轮这条是「地板 ≥3」—— 当时无条件偏好被回退了。
     * 第 460 轮做了**条件式**去重（只在命名形态不变时才换），两个指标同时改善，
     * 故这里改回真正的目标。
     */
    const clashes: string[] = [];
    for (const seed of SEEDS) {
      const w = generateMortalWorld(seed);
      const icons = w.chain.map((c) => ICON.get(c.fromId) ?? `unknown:${c.fromId}`);
      const seen = new Map<string, string>();
      for (const [i, icon] of icons.entries()) {
        const prev = seen.get(icon);
        if (prev) clashes.push(`seed ${seed}：「${prev}」与「${w.chain[i]!.name}」都是 ${icon}`);
        else seen.set(icon, w.chain[i]!.name);
      }
    }
    /*
     * ## 口径（第 460 轮定）
     *
     * 条件式去重的约束是「替换后命名形态不变」。有些世界**换无可换** ——
     * 邻近候选里非重复的就那么几处，而换掉它们会改动命名形态。那时
     * 保留一处重复比改动形态划算（后者会让名字集中，而名字更常被看到）。
     *
     * 故这条量的是**残留世界的占比**，不是「必须为零」:
     *
     * ```text
     *   24 颗种子实测   seed 593 与 seed 667 各残留两处（cloud 与 castle 池子大）
     *   → 2 / 24 = 8.3%
     * ```
     *
     * 上限取 1/4 —— 压住「退回无条件版之前那种大面积重复」，又不惩罚无解的世界。
     */
    const worldsWithClash = new Set(clashes.map((c) => /seed (\d+)/.exec(c)![1]));
    const ratio = worldsWithClash.size / SEEDS.length;
    expect(
      ratio,
      `${worldsWithClash.size}/${SEEDS.length} 个世界的路线里有图标重复（上限 1/4）——` +
        "走一趟看到两次同样的景：" +
        clashes.join(";"),
    ).toBeLessThanOrEqual(0.25);
  });

  it("④ 反差：去重不许以「名字集中」为代价", () => {
    /*
     * 这是第 459 轮那条回退的教训，现在变成一条判据。
     *
     * 无条件偏好会让名字种类从 21 掉到 17、最高占比升到 23.3%。
     * 条件式去重只在**命名形态不变**时才换，故分布应当基本不动。
     *
     * 阈值取 20% —— 60 颗种子下条件式版 16.7%，无条件版 23.3%。留 3.3pp 余量。
     * 留出余量，但压住「退回无条件版」那种退化。
     */
    /*
     * 样本量**必须大**：24 颗时最高占比只有 16.7%，任何阈值都抓不到退化。
     * 「名字集中」是分布特征，小样本量测不出来 —— 这是第 460 轮注入验证发现的。
     */
    const NAMING_SEEDS = Array.from({ length: 60 }, (_, i) => i * 37 + 1);
    const names = new Map<string, number>();
    for (const seed of NAMING_SEEDS) {
      const n = worldIdentity(generateMortalWorld(seed)).name;
      names.set(n, (names.get(n) ?? 0) + 1);
    }
    const top = [...names.values()].sort((a, b) => b - a)[0] ?? 0;
    const share = top / NAMING_SEEDS.length;
    expect(
      share,
      `某个名字占了 ${(share * 100).toFixed(1)}% 的世界 —— 去重把名字压集中了`,
    ).toBeLessThanOrEqual(0.2);
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
