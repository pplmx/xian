/* oxlint-disable no-console -- 分层审计的产出是给人看的清单 */
/**
 * 分层审计 —— core 对 store 的依赖**只许收拢,不许扩散**
 *
 * 由来:本仓的取向是「core 是逻辑、stores 是状态、views 只做薄接线」。但 core 里
 * 有一批模块直接 import store(散在十几个 store 上),于是「测一个数值函数」要先建
 * 一整套 Pinia,「把这段逻辑搬去别处复用」也搬不动。
 *
 * **为什么不再用「文件数 / 处数」当唯一判据**:那两个数**能被搬位置绕过** —— 把读 store
 * 从叶子挪进一个本来就 import store 的 core 模块,数字就掉,而依赖还在同一层。
 * 真正要守的是**有哪几个 core 模块碰 store**,不是一个计数。故基线改成**名单**:
 *
 *   一 `STATEFUL_CORE` = 允许 import store 的 core 模块**点名清单**。当前集合必须与它
 *      **逐一相等** —— 新增一个(把纯模块拖下水)或遗留一个(迁走了却忘了从名单删)都红。
 *      搬位置救不了:把依赖挪进一个**不在名单里**的模块,当场就多一个名字。
 *   二 引用**处数**不超过基线(名单没变时,防止某个模块内部越挂越多)。
 *   三 `utils` 更底,不许 import core / stores。
 *
 * 迁移方向:让 core 只有纯逻辑 —— 「读 state → 调纯函数 → 写 state」的**编排**收进
 * store 的 action(见 `stores/player.ts` 的 `currentRegionEvent` / `rollRegionEvent`),
 * 或收进调用方边缘。迁走一个模块,就把它从这里**删一个**。
 *
 * 故障注入:在任一 core 模块加 `import { usePlayerStore } from "@/stores/player"` 且该模块
 * 不在名单里 —— 第一条红;在 src/utils 夹一句对 core/store 的 import —— 第四条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const CORE = resolve(__dirname);
const UTILS = resolve(__dirname, "../utils");

/** core 里「import 了某个 store」的一句话。只认这个别名路径,与全仓口径一致。 */
const STORE_IMPORT = /from\s+"@\/stores\/[A-Za-z]+"/g;

/**
 * 允许 import store 的 core 模块点名清单(只许减)。
 *
 * 目标是把这份名单收到 0;每把一摊编排收进 store / 挪到边缘,就删掉那一个名字。
 * 名字是**文件名**(含 `.ts`),与目录逐字对得上。
 */
const STATEFUL_CORE = new Set<string>([
  "breakthrough.ts",
  "buildingService.ts",
  "buildDetect.ts",
  "challenge.ts",
  "craftability.ts",
  "dailyChallenge.ts",
  "daoluService.ts",
  "divinationService.ts",
  "earlyGameService.ts",
  "endgameService.ts",
  "engine.ts",
  "engineCraft.ts",
  "eventEngine.ts",
  "expedition.ts",
  "exploration.ts",
  "firstStep.ts",
  "forge.ts",
  "fortuneChain.ts",
  "fortuneEcho.ts",
  "goal.ts",
  "gongfaService.ts",
  "herbMarketService.ts",
  "heritageForge.ts",
  "identity.ts",
  "identityService.ts",
  "lab.ts",
  "lifeTrialService.ts",
  "loadoutService.ts",
  "loot.ts",
  "loreService.ts",
  "mentorService.ts",
  "mortalWorldService.ts",
  "offline.ts",
  "pillService.ts",
  "playerSnap.ts",
  "progress.ts",
  "qiRepair.ts",
  "questProgress.ts",
  "reforge.ts",
  "regionRevival.ts",
  "reincarnation.ts",
  "resourceGuidance.ts",
  "samsaraService.ts",
  "save.ts",
  "secretRealm.ts",
  "smartKeep.ts",
  "soulService.ts",
  "suppress.ts",
  "veinService.ts",
  "weather.ts",
]);

/** core → store 的引用处数基线(只许减;名单没变时防止单个模块越挂越多) */
const CORE_STORE_SITES = 155;
/** core 用例里需要 Pinia 的文件数基线(只许减)—— 「core 逻辑绑在 Pinia 上」的硬读数 */
const CORE_PINIA_SPECS = 109;

function sources(dir: string): { name: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8") }));
}

describe("分层 · core 对 store 的依赖只许收拢", () => {
  const core = sources(CORE);
  const withStore = core
    .map((f) => ({ name: f.name, hits: f.text.match(STORE_IMPORT) ?? [] }))
    .filter((f) => f.hits.length > 0);
  const sites = withStore.reduce((n, f) => n + f.hits.length, 0);

  it("扫描到了 core 源码(防空转)", () => {
    expect(core.length).toBeGreaterThan(50);
  });

  it("import store 的 core 模块 = 点名名单(新增或遗留都要在这里显式改)", () => {
    const actual = withStore.map((f) => f.name).sort();
    const baseline = [...STATEFUL_CORE].sort();
    const added = actual.filter((n) => !STATEFUL_CORE.has(n));
    const leftover = baseline.filter((n) => !actual.includes(n));
    if (added.length > 0)
      console.log(`\n新增的 core → store 模块(把纯模块拖下水?):${added.join("、")}`);
    if (leftover.length > 0)
      console.log(
        `\n已迁走、该从名单删掉的:${leftover.join("、")}\n` +
          `  (那一个是好事 —— 从 STATEFUL_CORE 里删掉它)`,
      );
    expect(actual).toEqual(baseline);
  });

  it("import store 的处数不超过基线", () => {
    if (sites > CORE_STORE_SITES) {
      const per = new Map<string, number>();
      for (const f of withStore) {
        for (const hit of f.hits) {
          const store = hit.replace(/^.*@\/stores\//, "").replace(/"$/, "");
          per.set(store, (per.get(store) ?? 0) + 1);
        }
      }
      console.log(
        `\ncore → store 的引用分布(基线 ${CORE_STORE_SITES},现在 ${sites}):` +
          [...per.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `\n  ${k} ×${v}`)
            .join(""),
      );
    }
    expect(sites).toBeLessThanOrEqual(CORE_STORE_SITES);
  });

  it("core 用例需要 Pinia 的文件数不超过基线(只许减)", () => {
    const specs = readdirSync(CORE).filter(
      (f) => f.endsWith(".spec.ts") && f !== "layeringAudit.spec.ts",
    );
    const withPinia = specs.filter((f) =>
      readFileSync(join(CORE, f), "utf8").includes("setActivePinia"),
    );
    console.log(`\ncore 用例 ${specs.length} 个,其中 ${withPinia.length} 个要 Pinia`);
    expect(withPinia.length).toBeLessThanOrEqual(CORE_PINIA_SPECS);
  });

  it("utils 不依赖 core / stores —— 最底层只认自己与标准库", () => {
    const bad = sources(UTILS).filter((f) => /from\s+"@\/(core|stores)\//.test(f.text));
    expect(bad.map((f) => f.name)).toEqual([]);
  });
});
