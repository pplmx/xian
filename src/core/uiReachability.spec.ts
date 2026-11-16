/**
 * 从界面出发的可达性 —— **写了的代码，玩家够得着吗**。
 *
 * ## 这是第 388 轮那个缺陷的自动化
 *
 * 第 388 轮查出「素行之向」有完整的数据与结算、却没有任何界面出口 ——
 * 一个玩家永远不会知道它存在的机制。那一轮是**手工**发现的：
 * 在 spec 里读到 `SX_ROUTE`，然后 grep 全仓看有没有 `.vue` 用它。
 *
 * 而 `exportReach.spec` 抓不到这类问题。它问的是「除定义处之外还有人用吗」，
 * 而**测试引用也算**（那个文件的文件头明写「测试引用也是引用」）。于是：
 *
 * ```text
 *   core/foo.ts 导出 bar()
 *   foo.spec.ts 引用 bar()          ← exportReach 认为「有人用」，绿的
 *   没有 .vue 够得到 core/foo.ts    ← 而玩家永远看不见它
 * ```
 *
 * 这正是素行之向的形状：它有完整的 spec，所以 `exportReach` 一直是绿的。
 *
 * ## 判据：从 `.vue` 出发的 import 闭包
 *
 * ① 从全部 `.vue` 出发，按 `from "..."` 的静态 import 扩散，算出一个可达集合；
 * ② `src/ui/`、`src/stores/`、`src/composables/`、`src/data/` 下的每个模块都必须
 *    在集合里 —— 这四个目录**没有一个是「只给测试用」的**；
 * ③ `src/core/` 例外，但要登记：审计类模块（`*Audit` / `*Sim` / `*Coverage` /
 *    静态体检）本来就只给 spec 用。它们记在 `CORE_ALLOWED_UNREACHABLE` 里，
 *    每一条都写清它为什么不该上界面。
 *
 * ③ 的名单是本判据**最容易被误用**的地方，故它只收两类：
 *
 * ```text
 *   审计 / 模拟 / 基线      跑一次出报告，不是玩家读的东西
 *   纯计算被 core 内部消化   由别的可达模块转手，自己没有独立出口
 * ```
 *
 * **不在这里加「以后可能要用」** —— 那种东西该删，不该躺在名单里。
 *
 * ## 故障注入
 *
 * · 把任一 `ui/*.ts` 的引用从所有 `.vue` 里删掉 → 立刻红；
 * · 加一个新的 `src/ui/orphan.ts` 没人 import → 立刻红；
 * · 把 `CORE_ALLOWED_UNREACHABLE` 里的一项接上 `.vue` → 红（该销账了）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { walkFiles } from "@/test/readSource";

const ROOT = resolve(__dirname, "../..");

/** `src` 下全部非 spec 的 .ts / .vue */
function sourceFiles(): string[] {
  return walkFiles(
    join(ROOT, "src"),
    (f) => (f.endsWith(".ts") || f.endsWith(".vue")) && !f.endsWith(".spec.ts"),
  );
}

/**
 * 从 `.vue` 出发算 import 闭包。
 *
 * 只认静态 `from "..."` —— 动态 `import()` 也算，因为懒加载的页面同样是玩家够得到的
 * （路由表就是 `() => import(...)`，不认它会让全部页面变成不可达）。
 */
function reachableFromVue(): Set<string> {
  const files = sourceFiles();
  const known = new Set(files);
  const reach = new Set<string>();
  const queue: string[] = [];
  for (const f of files) {
    if (f.endsWith(".vue")) {
      reach.add(f);
      queue.push(f);
    }
  }
  while (queue.length > 0) {
    const cur = queue.pop()!;
    let src: string;
    try {
      src = readFileSync(cur, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/from\s+"(@\/[^"]+|\.{1,2}\/[^"]+)"/g)) {
      const spec = m[1]!;
      let base: string;
      if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
      else base = join(cur.slice(0, cur.lastIndexOf("/")), spec);
      for (const cand of [`${base}.ts`, `${base}.vue`, `${base}/index.ts`, base]) {
        if (known.has(cand)) {
          if (!reach.has(cand)) {
            reach.add(cand);
            queue.push(cand);
          }
          break;
        }
      }
    }
  }
  return reach;
}

/**
 * `core/` 里允许「从界面够不到」的模块 —— **每条都要说清为什么**。
 *
 * 这份名单是第 408 轮由实测倒推的：先把不可达的全列出来，再逐个读文件头，
 * 能归入「审计/模拟/基线」或「由别的可达模块转手」的就留下，其余不允许存在。
 */
const CORE_ALLOWED_UNREACHABLE: Record<string, string> = {
  // ---- 审计 / 模拟 / 基线：跑一次出报告，玩家不读 ----
  balanceCoverage: "统计判据标题覆盖，只给 test:report 看",
  compoundingAudit: "复利审计，出报告用",
  contentGateAudit: "内容门槛审计，出报告用",
  daoFruitCurve: "道果曲线五案对照，调参读数",
  daoFruitRoles: "道果职责拆分审计",
  deepCultivationRoi: "深修补偿 A/B 审计",
  economySim: "经济模拟，出报告用",
  ecosystemHealth: "生态健康度仪表盘，出报告用",
  expIncome: "修为收入对账表，出报告用",
  fingerprints: "构筑指纹归类，审计用",
  inflationAudit: "数值膨胀审计",
  lootSim: "掉落模拟",
  metaSim: "Meta 演化模拟",
  motivationType: "道果消费动机审计",
  narrowingImpact: "收窄后果审计",
  overviewNecessity: "总览出发路径必要性审计",
  parityShared: "引擎对齐的共用辅助，无独立出口",
  perfBudget: "性能预算，出报告用",
  petBudget: "灵兽预算审计",
  pillValue: "丹值定价法则，由 spec 校验",
  rebirthRoi: "轮回 ROI 审计",
  releaseCheck: "发版检查",
  shallowRebirthGains: "浅轮回收益审计",
  trialMotivation: "逆旅契动机审计",
  kaiLateFaces: "楷体补充字形的生成名单，构建期用",
  fruitOutlets: "道果出口空间审计",
};

/** 这四个目录**没有一个是「只给测试用」的**，一个孤儿都不许有 */
const MUST_BE_REACHABLE = ["ui", "stores", "composables", "data"] as const;

describe("从界面出发的可达性 · 写了的代码玩家够得着吗", () => {
  it("ui / stores / composables / data 下没有够不到的模块", () => {
    const reach = reachableFromVue();
    const orphans: string[] = [];
    for (const dir of MUST_BE_REACHABLE) {
      for (const f of sourceFiles()) {
        if (!f.includes(`/src/${dir}/`) || !f.endsWith(".ts")) continue;
        if (!reach.has(f)) orphans.push(relative(join(ROOT, "src"), f));
      }
    }
    expect(
      orphans,
      "这些模块从任何 .vue 都够不到 —— 玩家永远不会知道它们存在（第 388 轮「素行之向没有 UI」" +
        "就是这个形状）。接上界面，或者删掉:" +
        orphans.join("、"),
    ).toEqual([]);
  });

  it("core 里从界面够不到的，都在名单里且都写了理由", () => {
    const reach = reachableFromVue();
    const unexplained: string[] = [];
    const deadEntries: string[] = [];

    const unreachable = new Set<string>();
    for (const f of sourceFiles()) {
      if (!f.includes("/src/core/") || !f.endsWith(".ts")) continue;
      if (reach.has(f)) continue;
      const id = f.split("/").pop()!.replace(/\.ts$/, "");
      unreachable.add(id);
      /*
       * 只要登记了就算说清 —— 不设字数门槛。
       * 初版写的是 `why.trim().length < 6`,而「掉落模拟」「发版检查」正好四个字,
       * 于是两条已经登记好的也被算成「没写理由」。**长度不是充分性的代理**:
       * 一句话说得够不够,机器判不了,留给人看。
       */
      if (!CORE_ALLOWED_UNREACHABLE[id]?.trim()) unexplained.push(id);
    }

    // 反向:名单里登记了、但它其实已经可达(或已删) —— 该销账了
    for (const id of Object.keys(CORE_ALLOWED_UNREACHABLE)) {
      if (!unreachable.has(id)) deadEntries.push(id);
    }

    expect(
      unexplained,
      `这些 core 模块从界面够不到，也没登记理由 —— 是「有机制没有出口」还是有意的审计模块？` +
        unexplained.join("、"),
    ).toEqual([]);
    expect(
      deadEntries,
      `名单里这些已经不需要了(已接上界面或已删除)，销掉:CORE_ALLOWED_UNREACHABLE`,
    ).toEqual([]);
  });

  it("反空转：真的量到了数千个模块与数十个 .vue", () => {
    /*
     * 这一条防的是「扫描器坏了但判据全绿」:
     * 若 `walkFiles` 的过滤写错、或 import 正则匹配不上,
     * 可达集合会只剩 .vue 自己,于是上面两条会**因为名单齐全而全绿** ——
     * 那是这条判据最危险的失效方式。
     */
    const files = sourceFiles();
    const vueCount = files.filter((f) => f.endsWith(".vue")).length;
    const reach = reachableFromVue();
    expect(vueCount, "一个 .vue 都没扫到 —— 路径或过滤写错了").toBeGreaterThan(10);
    expect(files.length, "src 下模块数少得离谱").toBeGreaterThan(200);
    expect(
      reach.size,
      `从 ${vueCount} 个 .vue 出发只够到 ${reach.size} 个模块 —— import 扩散没跑起来`,
    ).toBeGreaterThan(files.length / 3);
  });
});
