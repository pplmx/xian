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
 *
 * ## 全部八条,一张表看清「谁能认识谁」
 *
 * | 依赖方向 | 形态 | 为什么 |
 * | --- | --- | --- |
 * | `core → store` | 名单 `STATEFUL_CORE` | 逻辑层不该背着状态,但存量要能复核 |
 * | `core` 用例需要 Pinia 的文件数 | 上限,只许减 | 测纯函数不该先建一整套 Pinia |
 * | import store 的处数 | 不超过基线 | 名单没变时,防单个模块内部越挂越多 |
 * | `utils → core / stores` | 禁止 | 最底层只认自己与标准库 |
 * | `utils` 内部 | 只认自己与标准库 | 同上 |
 * | `data` / `core` / `ui` / `stores` / `composables` → `views` / `components` | 禁止 | 底下五层一旦认识"长什么样",改个组件名就让数值模块跟着崩 |
 * | `components → views` | 禁止 | 组件是可复用件,`views` 是装配好的整页;一旦反向依赖就搬不走 |
 * | `ui → store` | 名单 `WITH_STORES` | `ui` 是**编排层**,允许依赖 store;但要点名,否则半年后没人说得清那二十个里哪些该拆 |
 *
 * **能禁止的禁止,不能禁止的登记**(三、八两行是登记)。两种形态的目的相同:
 * 让某个模块开始认识它本来不该认识的东西这件事**必须显式发生**,而不是悄悄长出来。
 *
 * ## 名单为什么停在 48,而不是 78
 *
 * `core` 有 168 个模块,48 个在名单里(29%)。剩下 120 个是纯逻辑。
 *
 * 让这个数字没有继续涨的,是**端口抽象** —— `core/notify.ts` 把「说一句话」从
 * 「直接 `useUiStore().toast(...)`」改成「core 声明该说什么,上层决定怎么说」:
 *
 *   · 30 个 core 模块通过 `notify()` 发提示,**没有一个 import ui store**;
 *   · 实测 `grep useUiStore src/core/*.ts` 只剩注释里那几处,零实际调用;
 *   · 于是这 30 个模块不必因为一句提示就进名单。
 *
 * 同形的还有 `core/uiPort`(突破面板的数据出口)。**遇到「只是想说一句话 / 只想
 * 读一个界面数」的依赖,先找端口,别再往名单里加名字** —— 名单每加一个,
 * 那个模块就从"能测"变成"要先建 Pinia"。
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
  "fortuneChain.ts",
  "forge.ts",
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
// 155 → 158:坊市(market)与悬赏板(bounty)、收徒(apprentice)是新持久化 store,各自的
// sanitize 必须接进开机链路(storeResilience 的「sanitize 必须接进开机链路」判定);
// storeResilience 与本基线对新增持久化 store 天然相抵,每 +1 都是新增系统的正当代价。
// 158 → 159:reincarnation.ts 接上收徒的转世凝缘(resetForRebirth),同属新系统的转世接线代价。
const CORE_STORE_SITES = 159;
/**
 * core 用例里需要 Pinia 的文件数基线(只许减)—— 「core 逻辑绑在 Pinia 上」的硬读数
 *
 * 109 → 110:explorationExpiry.spec 要复现「际遇压着时到点却不收尾」那个死结,
 * 而它只能从 tickExploration 这一层量(会话、待处理事件、到点判定三者都在 store 上)。
 * 这是被测量对象本身就要 Pinia,不是把逻辑往 Pinia 上搬 —— 与 market/bounty 那几笔
 * 新增持久化 store 的代价同一类。抬高要在注释里写清理由(见本文件既有做法)。
 *
 * 110 → 111:suppressCurve.spec 量的是「开局玩家几时够得上镇压资格」——
 * 那条曲线的自变量是**真实玩家的战斗快照**(buildPlayerSnap 直接读 store:
 * 属性、功法、装备三处都在 Pinia 上)。它测的正是「玩家身上那套东西」,
 * 换一个手工拼的快照就不是开局玩家了,判据会失去它唯一的意义。
 * 同属「被测量对象本身就要 Pinia」。
 */
const CORE_PINIA_SPECS = 111;

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

  it("底层不认识视图层 —— data/core/ui/stores/composables 都不许 import views 或 components", () => {
    /*
     * 本仓的取向是「data 是数据、core 是逻辑、stores 是状态、views 只做薄接线」。
     * 上面几条守的是 core↔store 那一对;**这一条守更底的一刀**:
     *
     *   底下的五层一旦有人 import 了 `@/views/**` 或 `@/components/**`,
     *   那条依赖就倒过来了 —— 逻辑层开始认识"长什么样",而组件是会被改名的。
     *   症状不是编译错,是改个组件名就让一个数值模块跟着崩。
     *
     * 实测(2026-11-09)五层**全部零违规**,但此前没有判据守着这个事实 ——
     * 它靠的是大家自觉,而自觉不是判据。
     */
    const LAYERS = [
      ["data", resolve(__dirname, "../data")],
      ["core", CORE],
      ["ui", resolve(__dirname, "../ui")],
      ["stores", resolve(__dirname, "../stores")],
      ["composables", resolve(__dirname, "../composables")],
    ] as const;
    const offenders: string[] = [];
    let scanned = 0;
    for (const [label, dir] of LAYERS) {
      for (const f of sources(dir)) {
        scanned += 1;
        if (/from\s+"@\/(views|components)\//.test(f.text)) offenders.push(`${label}/${f.name}`);
      }
    }
    // 防空转:一层都没扫到时,下面的空集不算数
    expect(scanned, "一个源文件都没扫到 —— 目录名或扩展名过滤写错了").toBeGreaterThan(100);
    expect(
      offenders,
      "这些底层模块 import 了视图层 —— 依赖倒过来了:" + offenders.join("、"),
    ).toEqual([]);
  });

  it("ui 依赖 store 的模块 = 点名名单 —— 这一层本来就是编排", () => {
    /*
     * `ui` 层**允许**依赖 store —— 它是编排层(见 `ui/qualityPeakStores` 的文件头:
     * 「去哪个 store 取什么」属于这一层,折算法才留在 core)。
     *
     * 但没有名单的话,这个「允许」会变成「谁都能随手 import 一个」:今天是六个模块,
     * 半年后可能二十个,而没人说得清那二十个里哪些本该拆出去。故用与
     * `STATEFUL_CORE` 同一套办法 —— **点名清单**,增删都要显式改这里。
     *
     * 迁移方向:能只做"读 → 算 → 返回文本"的,把读 state 那段挪进 store 的 action,
     * `ui` 只留纯函数(见 `itemText` / `eventText` 的写法)。
     */
    const UI = resolve(__dirname, "../ui");
    const WITH_STORES = [
      "codex.ts",
      "enemyLore.ts",
      "eventText.ts",
      "itemText.ts",
      "qualityPeakStores.ts",
      "useNextStep.ts",
    ];
    const actual = sources(UI)
      .filter((f) => /from\s+"@\/stores\//.test(f.text))
      .map((f) => f.name)
      .sort();
    const expected = [...WITH_STORES].sort();
    const added = actual.filter((n) => !expected.includes(n));
    const removed = expected.filter((n) => !actual.includes(n));
    expect(
      added,
      "这些 ui 模块新开始 import store —— 先想清楚它是编排还是该留在纯函数里," +
        "确认要留就把名字加进 WITH_STORES:" +
        added.join("、"),
    ).toEqual([]);
    expect(
      removed,
      "这些 ui 模块不再 import store 了 —— 从 WITH_STORES 里划掉:" + removed.join("、"),
    ).toEqual([]);
    expect(actual.length, "一个 ui 模块都没扫到?").toBeGreaterThan(0);
  });

  it("组件不认识页面 —— components 不许 import views", () => {
    /*
     * 上一条守的是「底层 → 视图」这一刀。这条守相邻的一刀:**组件 → 页面**。
     *
     * `components` 是**可复用件**,`views` 是**装配好的整页**。组件一旦 import 了
     * 某个 view,它就只能在这个页面体系里用了 —— 想复用要先把那个 view 拖过来,
     * 而 view 又会牵进路由、导航、整页状态。症状是「这个组件挺通用,但搬不走」。
     *
     * 实测(2026-11-09)零违规,但此前没有判据。
     */
    const files: { name: string; text: string }[] = [];
    const collect = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collect(full);
        else if (entry.name.endsWith(".vue")) {
          files.push({
            name: full.slice(resolve(__dirname, "..").length + 1).replace(/\\/g, "/"),
            text: readFileSync(full, "utf8"),
          });
        }
      }
    };
    collect(resolve(__dirname, "../components"));
    // 防空转:一个组件都没扫到时,下面的空集不算数
    expect(files.length, "一个 .vue 都没扫到 —— 目录或扩展名写错了").toBeGreaterThan(80);
    const bad = files.filter((f) => /from\s+"@\/views\//.test(f.text));
    expect(
      bad.map((f) => f.name),
      "这些组件 import 了页面 —— 它从此搬不走",
    ).toEqual([]);
  });
});
