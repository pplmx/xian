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
  // ---- 天界试炼 ----
  { table: "试炼", dimension: "回报与难度同向", keywords: ["难度"] },
  { table: "试炼", dimension: "锚点层级单调", keywords: ["锚点"] },
  // ---- 际遇 ----
  { table: "际遇", dimension: "修为奖励与同段可比", keywords: ["中位数"] },
  { table: "际遇", dimension: "材料单格不被抬量级", keywords: ["材料"] },
  { table: "际遇", dimension: "境界带合法且不越界", keywords: ["境界带"] },
  { table: "际遇", dimension: "每条至少一个无条件选项", keywords: ["无条件"] },
  { table: "际遇", dimension: "地域标签够得着", keywords: ["够得着"] },
  { table: "际遇", dimension: "每个地域带内可用际遇不少于三条", keywords: ["带内"] },
  // ---- 灵兽补充 ----
  { table: "灵兽", dimension: "契语与灵兽一一对应", keywords: ["契语"] },
  { table: "灵兽", dimension: "性格表全覆盖", keywords: ["性格"] },
] as const;

describe("横向对账 · 覆盖审计", () => {
  it("每一个待查维度都有判据在管", () => {
    const titles = specTitles();
    // 防空转:真的扫到了 spec
    expect(titles.size, "扫到的 spec 太少 —— 只扫了 core 目录?").toBeGreaterThan(500);
    const totalTitles = [...titles.values()].flat().length;
    expect(totalTitles, "扫到的标题太少 —— 正则没切对").toBeGreaterThan(5000);

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

/**
 * 扫描器**自身**的自检 —— 它得真的看得见那 41% 不在 core 下的判据。
 *
 * ## 为什么加这一段
 *
 * 第 63 轮发现:第一版只扫 `src/core/`,而**约四成的 spec 在别处**,
 * 于是 `src/data/petVows.spec.ts` 里那条「每只灵兽都有契语」被报成「没有判据在管」。
 *
 * **工具跑得通、输出格式对、报出来的缺口具体到表与维度名 —— 一切看起来都成立,
 * 只是它的视野少了一半。** 这类错误不会自己暴露:假的缺口看起来和真的缺口一模一样。
 *
 * ## 怎么守
 *
 * 用**基准点**:挑几条确认存在于 core 之外的判据标题(它们本身有自己的 spec 在跑),
 * 断言扫描结果里一定含它们。任何一个基准点消失,就说明扫描范围又缩回去了。
 *
 * 基准点的选法:那条标题必须**足够独特**(在别处不会出现),否则「命中」可能来自巧合。
 */
describe("覆盖审计 · 扫描器自检(基准点)", () => {
  /** 已知存在于 `src/core/` 之外的判据标题片段 → 它所在的 spec */
  const BENCHMARKS: readonly { fragment: string; file: string }[] = [
    // src/data/petVows.spec.ts —— 第 63 轮正是漏了这条
    { fragment: "每只灵兽都有契语", file: "src/data/petVows.spec.ts" },
  ];

  it("基准点都在扫描结果里 —— 扫描范围没有缩回 src/core", () => {
    const titles = specTitles();
    const all = [...titles.values()].flat();
    expect(all.length, "一条标题都没扫到").toBeGreaterThan(1000);

    for (const { fragment, file } of BENCHMARKS) {
      expect(
        all.some((t) => t.includes(fragment)),
        `扫描结果里找不到「${fragment}」—— 它本来在 ${file} 里,` +
          `说明扫描范围缩回了 src/core 之下`,
      ).toBe(true);
    }
  });

  it("扫描真的覆盖了 core 之外的目录", () => {
    const titles = specTitles();
    const paths = [...titles.keys()];
    const outsideCore = paths.filter((p) => !p.startsWith("src/core/"));
    expect(outsideCore.length, "一个 core 之外的 spec 都没扫到 —— 只扫了单目录").toBeGreaterThan(
      100,
    );
    // 防空转:core 自己也得扫到
    expect(paths.filter((p) => p.startsWith("src/core/")).length).toBeGreaterThan(200);
  });

  /**
   * 排除规则本身要有判据守着 —— 但**不能写成「结果里没有 src/tp」**:
   * `src/tp` 平时并不存在,那条断言恒真(空转)。
   *
   * 改成查真正会出现的形状:每一条被扫到的路径都必须是 `src/` 下的真实文件,
   * 且不落在 `node_modules` / `tp` 这类该排除的目录里。这条可以被违反 ——
   * 一旦扫描器哪天漏了排除规则、把 `src/tp` 或依赖目录扫进来,它就会红。
   */
  it("扫到的每条路径都干净:在 src/ 下、指得着、不含被排除的目录", () => {
    const paths = [...specTitles().keys()];
    expect(paths.length, "一条路径都没扫到").toBeGreaterThan(500);
    const dirty = paths.filter(
      (p) =>
        !p.startsWith("src/") ||
        !p.endsWith(".spec.ts") ||
        p.includes("node_modules") ||
        p.split("/").includes("tp"),
    );
    expect(dirty, "扫到了不该扫的路径:" + dirty.join("、")).toEqual([]);
  });
});
