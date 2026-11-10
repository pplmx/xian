/**
 * 横向对账的覆盖审计 —— 「哪些该比的维度还没有判据在比」。
 *
 * ## 由来
 *
 * 第 43~60 轮里同一个形状出现了五次:
 *
 * ```text
 * 43  修为奖励没和同境界的邻居比      → 肥 66%
 * 44  材料奖励没和同格子的邻居比      → dust 高 5 倍
 * 55  功法基座没和同席位同品阶的比    → 肥两倍
 * 58  灵兽没先算可行域                → 连撞七八轮
 * 60  weaken 族没查「同族不倒退」     → t12 与 t25 一样
 * ```
 *
 * 根因都不是「某条判据写错了」,而是**某个维度上根本没有判据**。
 * 判据的覆盖天然分块:这一族查了增长,那一族查了封顶,中间那条谁都没管。
 *
 * 所以「哪些维度还没人看着」本身要被测量。这个 spec 就是那把量尺。
 *
 * ## 它不做什么
 *
 * 不判断判据写得好不好 —— 那归各自的 spec。它只回答「这一维有没有人管」。
 * 也因此,它的清单是**手工维护**的:每次发现一个新的可比较维度,就往 `WANTED`
 * 里加一行。加了却没写判据,这条就会红 —— 那正是它该做的事。
 */
import { describe, expect, it } from "vite-plus/test";
import { unguarded, specTitles } from "./balanceCoverage";

/**
 * 待查清单:**内容表 × 可比较维度 × 判定关键字**。
 *
 * 关键字是粗粒度的 —— 任一 spec 标题同时命中全部关键字,即认为这一维有人看着。
 * 宁可粗,不要漏:这一层要回答的是「有没有人写过这一维的用例」,
 * 写得好不好由那条用例自己证明。
 */
const WANTED = [
  // ---- 法宝 ----
  { table: "法宝", dimension: "族内相邻档增长率", keywords: ["相邻档"] },
  { table: "法宝", dimension: "族内不许倒退", keywords: ["不回落"] },
  { table: "法宝", dimension: "主动神通名不重复", keywords: ["主动神通名"] },
  { table: "法宝", dimension: "被动不超装备上限", keywords: ["被动", "装备上限"] },
  { table: "法宝", dimension: "九档分布不空", keywords: ["天品"] },
  // ---- 灵兽 ----
  { table: "灵兽", dimension: "预算随品阶不回落", keywords: ["预算", "品阶"] },
  { table: "灵兽", dimension: "同品阶不许全面压过", keywords: ["压过"] },
  { table: "灵兽", dimension: "同词条跨品阶不回落", keywords: ["跨品阶"] },
  { table: "灵兽", dimension: "可行域计算器自洽", keywords: ["可行域"] },
  // ---- 功法 ----
  { table: "功法", dimension: "分支不超装备上限", keywords: ["分支", "上限"] },
  { table: "功法", dimension: "基座同格不呈两极", keywords: ["基座"] },
  { table: "功法", dimension: "每部都有悟道分支", keywords: ["悟道分支"] },
  { table: "功法", dimension: "硬属性 accuracy 不越界", keywords: ["accuracy"] },
  // ---- 丹药 ----
  { table: "丹药", dimension: "每-成本不倒挂", keywords: ["每-成本"] },
  { table: "丹药", dimension: "固定点数只用于入门", keywords: ["固定点数"] },
  // ---- 事件 ----
  { table: "际遇", dimension: "修为奖励与同段可比", keywords: ["中位数"] },
  { table: "际遇", dimension: "材料单格不被抬量级", keywords: ["材料"] },
] as const;

describe("横向对账 · 覆盖审计", () => {
  it("每一个待查维度都有判据在管", () => {
    const titles = specTitles();
    // 防空转:真的扫到了 spec
    expect(titles.size, "一个 spec 都没扫到 —— 路径或后缀变了").toBeGreaterThan(200);
    const totalTitles = [...titles.values()].flat().length;
    expect(totalTitles, "扫到的标题太少 —— 正则没切对").toBeGreaterThan(1000);

    const missing = unguarded(WANTED, titles);
    expect(
      missing,
      "这些维度还没有判据在管 —— 加一条用例,或把这一项从 WANTED 里去掉:" +
        missing.map((m) => `${m.table} / ${m.dimension}`).join("、"),
    ).toEqual([]);
  });

  it("清单本身不许空转:待查项够多,且每个都有关键字", () => {
    expect(WANTED.length, "待查清单只剩几项 —— 审计失去意义").toBeGreaterThanOrEqual(10);
    for (const item of WANTED) {
      expect(item.keywords.length, `${item.table}/${item.dimension} 没有关键字`).toBeGreaterThan(0);
    }
  });
});
