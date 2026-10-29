/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 运行时回归门 —— 每个游戏视图上采几秒帧间隔,量 jank 有没有回来。
 *
 * 与 first-paint(冷启动:字节/FCP/字体)互补:那条管「第一屏多快」,
 * 这条管「玩起来卡不卡」—— 放置游戏的心跳每秒改一堆响应式状态,视图若
 * 在数据增长或内容变多时开始整块重渲染,帧间隔会拉长。这是此前唯一没有门
 * 的性能维度。
 *
 * 用法(需已 bun run build,playwright chromium 已装):
 *   bun scripts/perf-profile.mjs               # 全视图,后期档(神人境)
 *   bun scripts/perf-profile.mjs --seconds 4   # 每视图采 4 秒(默认 3)
 *   bun scripts/perf-profile.mjs --view home   # 只量一个视图
 *   bun scripts/perf-profile.mjs --showcase    # 换真仙(仙界)档
 *   bun scripts/perf-profile.mjs --noseed      # 无档(欢迎页)
 *   bun scripts/perf-profile.mjs --no-gate     # 只报数字,不判红(人工排查用)
 *
 * 量法讲究
 * --------
 * · 复用 390×844 移动视口 + 后期档(神人境 + 成套装备),把终局的重路径逼出来;
 * · 每视图独立 context、独立存档,路由直接写进载入 URL(哈希路由);
 * · 在页内跑一段 rAF 采样,量「相邻两帧的间隔」:>50ms 的那一拍就是卡顿
 *   (浏览器一个任务 >50ms 即 Long Task)。headless 无 vsync 会以 ~60fps 节流,
 *   与真机同口径,足够当回归判据。
 *
 * 判据(见 BUDGET):单视图不得有长帧(>50ms)超过上限、最差帧不超过上限、
 * 不得崩溃、不得有未处理的页面异常或应用自己的 console.error(同一把尺子,见 lib/pageErrors.mjs)。CI 机器比本机核多但单核弱,故上限按
 * 「本机读数留出数倍余量」定 —— 红的是「成倍长回去」那类回归,不是机器抖动。
 *
 * 基线(2026-10-29 实测,本机 + 无头 chromium,后期档):全 17 视图 ~60fps、
 * 最差帧 17ms、零长帧;300 件背包逐页翻到底峰值 643,1000 件仍为 643;
 * 全 45 件法宝逐批翻到末页再回翻峰值 401;54 张丹方同窗峰值 609;同包点开武器槽、
 * 部位候选逐页到底再回翻峰值 955;词条转移候选逐页到底峰值 913;坊市寄卖 + 贡器
 * 各翻到末页峰值 900;全收集九册共 809 条逐册翻到末页再回翻,峰值 1074;
 * 全习得三册功法逐门翻到末页,峰值 533。预算见 BUDGET,曾有过更糟的读数时任它红。
 * 天界道痕满卷 60 则按 12 则一批、最多留 24 则,逐批到末页再回翻,峰值 362。
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import {
  FULL_MARKS_COUNT,
  lateSlices,
  makeFullMarks,
  showcaseSlices,
  seedSave,
} from "./lib/saveFixture.mjs";
import { watchPageErrors } from "./lib/pageErrors.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const extOf = (p) => p.slice(p.lastIndexOf("."));

const args = process.argv.slice(2);
const si = args.indexOf("--seconds");
const parsedSecs = si >= 0 ? Number(args[si + 1] ?? 3) : 3;
const secs = Number.isFinite(parsedSecs) && parsedSecs > 0 ? parsedSecs : 3;
const vi = args.indexOf("--view");
const only = vi >= 0 ? args[vi + 1] : undefined;
const fixture = args.includes("--showcase") ? "showcase" : "late";
const noSeed = args.includes("--noseed");
const gate = !args.includes("--no-gate");
/** 背包视图按真实规模量:玩家攒几百件装备时,列表重渲染才是 jank 的真实来源。
 * 默认 300 件(远大于在线能攒的典型规模,仍 60fps);--bigbag 0 退回小包。 */
const bi = args.indexOf("--bigbag");
const bigbag = Number(
  ((bi >= 0 ? args[bi + 1] : undefined) ?? process.env.PERF_BIGBAG ?? 300) || 0,
);

/**
 * 判据上限。定法:先量出真实读数(全视图 max 17ms / 零长帧),再按「无头浏览器
 * 机型/负载差异留出数倍余量」定上限 —— 拦的是「成倍长回去」,不是机器抖动。
 * 改过会显著影响渲染量的代码后,这两个数要跟着重校(连同 docs/development.md 的表)。
 */
const BUDGET = {
  /** 单视图最差帧间隔上限:ms —— 无头 ~60fps 基准是 ~16-17ms,留到 5 倍 */
  maxFrameMs: Number(process.env.PERF_MAX_FRAME_MS ?? 100),
  /** 单视图 >50ms 长帧数量上限 */
  longFramesMax: Number(process.env.PERF_LONG_FRAMES ?? 2),
  /**
   * 背包一次只留 32 张卡,可前后逐批翻完 300 件;80 张一窗实测 1048,故不设两批。
   * 法宝全册 45 张密卡按 6+6 滑窗,全流程峰值 401;丹方 54 张同窗,峰值 609。
   * 词条转移 299 件候选按 12+12 滑窗,逐批开完峰值 913。四条密清单单独守 1100,
   * 不松动背包首屏预算。
   * 坊市是短横条/弹窗行,每窗最多 64 条;寄卖与贡器都逐页翻到末页再回翻一批。
   * 收藏每册每窗最多 48 枚,九册都翻到末页再回翻;809 条整页全铺实测 1326 DOM。
   * 修行页三册功法每窗最多 24 部,全习得 66 部逐门翻完;单门整册铺开也会随内容增长,
   * 故单独守住 700 DOM。
   * 天界道痕满卷 60 则每窗最多 24 则,全流程峰值 362;celestial 也守住 700 DOM。
   * 1100 拦的是窗口上限失效、点击越多 DOM 越长的回潮。
   */
  maxDomByView: {
    cultivation: 700,
    inventory: 700,
    market: 1100,
    collection: 1100,
    celestial: 700,
  },
};

function startServer() {
  return new Promise((res) => {
    const server = createServer((req, r) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = url === "/" ? "index.html" : url.replace(/^\/+/, "");
      if (rel.includes("..")) return r.writeHead(400).end("bad");
      try {
        const body = readFileSync(join(DIST, rel));
        r.writeHead(200, { "content-type": MIME[extOf(rel)] ?? "application/octet-stream" });
        r.end(body);
      } catch {
        r.writeHead(404).end("nf");
      }
    });
    server.listen(0, "127.0.0.1", () => res(server));
  });
}

/** 游戏各视图(欢迎/建号页需无档,默认档下会被路由重定向,故不列入) */
const VIEWS = [
  { route: "/", name: "home" },
  { route: "/cultivation", name: "cultivation" },
  { route: "/adventure", name: "adventure" },
  { route: "/inventory", name: "inventory" },
  { route: "/character", name: "character" },
  { route: "/codex", name: "codex" },
  { route: "/souls", name: "souls" },
  { route: "/titles", name: "titles" },
  { route: "/settings", name: "settings" },
  { route: "/build", name: "build" },
  { route: "/collection", name: "collection" },
  { route: "/legacy", name: "legacy" },
  { route: "/dongfu", name: "dongfu" },
  { route: "/world", name: "world" },
  { route: "/celestial", name: "celestial" },
  { route: "/market", name: "market" },
  { route: "/apprentice", name: "apprentice" },
];

/** 页内采样器:记录相邻帧间隔,`__perfStop()` 时汇总。IIFE 用 void 包裹,
 *  让 `evaluate(SAMPLER)` 立即返回(不被未 resolve 的 Promise 卡住)。 */
const SAMPLER = `
  void (() => {
    let resolveFn;
    window.__perf = new Promise((r) => { resolveFn = r; });
    const frames = [];
    let last = performance.now();
    let raf;
    function step(now) {
      frames.push(now - last);
      last = now;
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    window.__perfStop = () => {
      cancelAnimationFrame(raf);
      const n = frames.length;
      const s = [...frames].sort((a, b) => a - b);
      const p = (q) => s[Math.min(n - 1, Math.floor(q * n))];
      const long = frames.filter((f) => f > 50).length;
      resolveFn({
        frames: n,
        max: Math.round(p(1)),
        p95: Math.round(p(0.95)),
        median: Math.round(p(0.5)),
        over50ms: long,
        nodes: document.querySelectorAll('*').length,
      });
      return window.__perf;
    };
  })();
`;

/**
 * 点一次「再看 N 件」,核对按钮承诺与 DOM 实际新增完全相等。
 * 窗口到顶后「再看」会滑掉上一批:件数不变,但首批条目必须换人,
 * 否则就是把按钮点成了空转。
 * 选择器都走稳定的 data-* 落点,不拿人话文本当机器判据。
 */
const ITEM_FINGERPRINT_ATTRS = [
  "data-uid",
  "data-consign-uid",
  "data-equip-candidate",
  "data-slot-candidate",
  "data-artifact-row",
  "data-recipe-row",
  "data-affix-candidate",
  "data-gongfa-row",
  "data-mark-row",
  "data-codex-id",
];

async function visibleFingerprints(items) {
  return items.evaluateAll(
    (nodes, keys) =>
      nodes.map((el) => {
        for (const key of keys) {
          const value = el.getAttribute(key);
          if (value) return `${key}:${value}`;
        }
        return el.outerHTML;
      }),
    ITEM_FINGERPRINT_ATTRS,
  );
}

async function activeFingerprint(page) {
  return page.evaluate((keys) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return null;
    for (const key of keys) {
      const value = el.getAttribute(key);
      if (value) return `${key}:${value}`;
    }
    return null;
  }, ITEM_FINGERPRINT_ATTRS);
}

async function expandBatch(page, itemSelector, moreSelector) {
  try {
    const items = page.locator(itemSelector);
    const more = page.locator(moreSelector).first();
    const before = await items.count();
    const beforeItems = await visibleFingerprints(items);
    const beforeFirst = beforeItems[0] ?? "";
    const beforeSet = new Set(beforeItems);
    if ((await more.count()) === 0) throw new Error(`续开按钮不存在:${moreSelector}`);
    const promised = Number(
      (await more.getAttribute("data-promised")) ??
        /再看\s*(\d+)\s*件/.exec((await more.getAttribute("aria-label")) ?? "")?.[1],
    );
    if (!Number.isFinite(promised) || promised <= 0)
      throw new Error(`续开按钮没有报件数:${moreSelector}`);
    await more.click({ timeout: 3000 });
    await page.waitForTimeout(120);
    const after = await items.count();
    const afterItems = await visibleFingerprints(items);
    const afterFirst = afterItems[0] ?? "";
    const newVisible = afterItems.filter((fingerprint) => !beforeSet.has(fingerprint)).length;
    const focused = await activeFingerprint(page);
    const focusMoved = focused !== null && !beforeSet.has(focused);
    const appended = after === before + promised && newVisible === promised;
    const slid = afterFirst !== beforeFirst && newVisible === promised;
    const reason =
      !appended && !slid
        ? "续开没有兑现承诺件数"
        : !focusMoved
          ? "焦点没有落到新露出条目"
          : undefined;
    return {
      before,
      promised,
      after,
      newVisible,
      focused,
      focusMoved,
      mode: appended ? "append" : slid ? "slide" : "broken",
      ok: (appended || slid) && focusMoved,
      reason,
    };
  } catch (error) {
    return {
      before: 0,
      promised: 0,
      after: 0,
      newVisible: 0,
      mode: "broken",
      ok: false,
      reason: String(error),
    };
  }
}

/** 从末页回翻一批:件数不必变,但承诺的新露件数必须兑现且窗口首件必须换人。 */
async function rewindBatch(
  page,
  itemSelector,
  previousSelector,
  stateSelector = null,
  startAttribute = null,
) {
  try {
    const items = page.locator(itemSelector);
    const previous = page.locator(previousSelector).first();
    const before = await items.count();
    if (before === 0) throw new Error("回翻前清单为空");
    if ((await previous.count()) === 0) throw new Error(`前翻按钮不存在:${previousSelector}`);
    const startBeforeRaw =
      stateSelector && startAttribute
        ? await page.locator(stateSelector).first().getAttribute(startAttribute)
        : null;
    const startBefore = startBeforeRaw === null ? Number.NaN : Number(startBeforeRaw);
    const beforeItems = await visibleFingerprints(items);
    const beforeFirst = beforeItems[0] ?? "";
    const beforeSet = new Set(beforeItems);
    const promised = Number(
      /前一批\s*(\d+)\s*[件张顶只条部则]/.exec(
        (await previous.getAttribute("aria-label")) ?? "",
      )?.[1] ?? 0,
    );
    if (!Number.isFinite(promised) || promised <= 0)
      throw new Error(`前翻按钮没有报件数:${previousSelector}`);
    await previous.click({ timeout: 3000 });
    await page.waitForTimeout(120);
    const after = await items.count();
    const afterItems = await visibleFingerprints(items);
    const afterFirst = afterItems[0] ?? "";
    const newVisible = afterItems.filter((fingerprint) => !beforeSet.has(fingerprint)).length;
    const startAfterRaw =
      stateSelector && startAttribute
        ? await page.locator(stateSelector).first().getAttribute(startAttribute)
        : null;
    const startAfter = startAfterRaw === null ? Number.NaN : Number(startAfterRaw);
    const state = stateSelector
      ? await page
          .locator(stateSelector)
          .first()
          .evaluate((el) => ({ ...el.dataset }))
      : null;
    const revealedAsPromised = newVisible === promised;
    const startMovedBack = startAfter < startBefore;
    const reason =
      afterFirst === beforeFirst
        ? "回翻没有换页"
        : !revealedAsPromised
          ? `回翻只新露 ${newVisible} 件,承诺 ${promised} 件`
          : !Number.isFinite(startBefore) || !Number.isFinite(startAfter)
            ? "回翻缺少窗口起点"
            : !startMovedBack
              ? `回翻起点未前移:${startBefore} -> ${startAfter}`
              : undefined;
    return {
      promised,
      before,
      after,
      newVisible,
      startBefore,
      startAfter,
      state,
      ok: reason === undefined,
      reason,
    };
  } catch (error) {
    return {
      promised: 0,
      before: 0,
      after: 0,
      newVisible: 0,
      startBefore: Number.NaN,
      startAfter: Number.NaN,
      ok: false,
      reason: String(error),
    };
  }
}

/** 一直点到这一份清单的末页,每一拍都记 DOM 峰值 —— 只点一次会把「还能继续长」漏掉。 */
async function expandAllBatches(
  page,
  itemSelector,
  moreSelector,
  expectedTotal = null,
  rewindSpec = null,
) {
  const steps = [];
  let peakNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  let seen = null;
  try {
    if (expectedTotal) {
      const total = Number(
        await page.locator(expectedTotal.selector).first().getAttribute(expectedTotal.attribute),
      );
      if (total !== expectedTotal.count) {
        throw new Error(
          `夹具只装进 ${total} 件,承诺 ${expectedTotal.count} 件 —— 无效模板或被容量截短`,
        );
      }
      seen = new Set(await visibleFingerprints(page.locator(itemSelector)));
    }
    while ((await page.locator(moreSelector).count()) > 0) {
      if (steps.length >= 100) throw new Error("续开超过 100 批,疑似按钮不收敛");
      const step = await expandBatch(page, itemSelector, moreSelector);
      steps.push(step);
      peakNodes = Math.max(
        peakNodes,
        await page.evaluate(() => document.querySelectorAll("*").length),
      );
      if (!step.ok) throw new Error(step.reason ?? `批次异常:${JSON.stringify(step)}`);
      if (seen) {
        const fresh = (await visibleFingerprints(page.locator(itemSelector))).filter(
          (fingerprint) => !seen.has(fingerprint),
        );
        if (fresh.length !== step.promised) {
          throw new Error(
            `续开跨批重复:承诺 +${step.promised},全程首次可见 ${fresh.length} —— 有旧条目被反复翻出`,
          );
        }
        for (const fingerprint of fresh) seen.add(fingerprint);
      }
    }
    const singleWindow =
      steps.length === 0 &&
      seen !== null &&
      expectedTotal !== null &&
      seen.size === expectedTotal.count;
    if (steps.length === 0 && !singleWindow) {
      throw new Error(`没有可续开的批次:${moreSelector}`);
    }
    if (seen && seen.size !== expectedTotal.count) {
      throw new Error(
        `清单只可达 ${seen.size}/${expectedTotal.count} 件 —— 续开按钮提前消失或漏页`,
      );
    }
    let rewind = null;
    if (rewindSpec) {
      const start = Number(
        await page
          .locator(rewindSpec.startSelector)
          .first()
          .getAttribute(rewindSpec.startAttribute),
      );
      if (start > 0) {
        rewind = await rewindBatch(
          page,
          itemSelector,
          rewindSpec.previousSelector,
          rewindSpec.startSelector,
          rewindSpec.startAttribute,
        );
        if (!rewind.ok) throw new Error(rewind.reason ?? `回翻未换页:${JSON.stringify(rewind)}`);
      }
    }
    const finalNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    return {
      before: steps[0]?.before ?? seen?.size ?? 0,
      after: steps.at(-1)?.after ?? seen?.size ?? 0,
      promised: steps.reduce((sum, step) => sum + step.promised, 0),
      steps: steps.length,
      slides: steps.filter((step) => step.mode === "slide").length,
      singleWindow,
      peakNodes,
      finalNodes,
      rewind,
      ok: true,
    };
  } catch (error) {
    const finalNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    return {
      before: steps[0]?.before ?? 0,
      after: steps.at(-1)?.after ?? 0,
      promised: steps.reduce((sum, step) => sum + step.promised, 0),
      steps: steps.length,
      slides: steps.filter((step) => step.mode === "slide").length,
      peakNodes,
      finalNodes,
      rewind: null,
      ok: false,
      reason: String(error),
    };
  }
}

/**
 * 规模夹具住在 TypeScript 内容层,由 Vite 自己解析 `@/data` 别名。
 * 只有本轮真要量收藏或大背包时才起一次内存中的 SSR 加载器,不让其它视图为它买单。
 */
async function loadBenchModules(needsCollection, needsBigBag, needsArtifacts, needsRecipes) {
  if (!needsCollection && !needsBigBag && !needsArtifacts && !needsRecipes) {
    return {
      fullCollectionSlices: null,
      fullArtifactSlices: null,
      fullArtifactCount: 0,
      fullRecipeSlices: null,
      fullRecipeCount: 0,
      makeBigBagItems: null,
      makeAffixTransferBag: null,
    };
  }
  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  try {
    const collection = needsCollection
      ? await vite.ssrLoadModule("/scripts/lib/fullCollectionFixture.ts")
      : null;
    const bag = needsBigBag ? await vite.ssrLoadModule("/scripts/lib/bigBagFixture.ts") : null;
    const artifacts = needsArtifacts
      ? await vite.ssrLoadModule("/scripts/lib/fullArtifactFixture.ts")
      : null;
    const recipes = needsRecipes
      ? await vite.ssrLoadModule("/scripts/lib/fullRecipeFixture.ts")
      : null;
    return {
      fullCollectionSlices: collection?.fullCollectionSlices ?? null,
      fullArtifactSlices: artifacts?.fullArtifactSlices ?? null,
      fullArtifactCount: artifacts?.FULL_ARTIFACT_COUNT ?? 0,
      fullRecipeSlices: recipes?.fullRecipeSlices ?? null,
      fullRecipeCount: recipes?.FULL_RECIPE_COUNT ?? 0,
      makeBigBagItems: bag?.makeBigBagItems ?? null,
      makeAffixTransferBag: bag?.makeAffixTransferBag ?? null,
    };
  } finally {
    await vite.close();
  }
}

const {
  fullCollectionSlices,
  fullArtifactSlices,
  fullArtifactCount,
  fullRecipeSlices,
  fullRecipeCount,
  makeBigBagItems,
  makeAffixTransferBag,
} = await loadBenchModules(
  !noSeed && (!only || only === "collection" || only === "cultivation"),
  !noSeed && bigbag > 0 && (!only || only === "inventory" || only === "market"),
  !noSeed && (!only || only === "inventory"),
  !noSeed && (!only || only === "inventory"),
);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});
const results = [];
const failures = [];
for (const view of VIEWS) {
  if (only && view.name !== only) continue;
  let record = null;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let slices = (fixture === "showcase" ? showcaseSlices : lateSlices)("light");
    let affixTransferFixture = null;
    if (view.name === "collection") {
      if (!fullCollectionSlices) throw new Error("全收集夹具未载入");
      slices = { ...slices, ...fullCollectionSlices() };
    }
    if (view.name === "cultivation") {
      if (!fullCollectionSlices) throw new Error("全习得功法夹具未载入");
      slices = { ...slices, cultivation: fullCollectionSlices().cultivation };
    }
    if (view.name === "celestial") {
      slices = {
        ...slices,
        endgame: {
          ...slices.endgame,
          marks: makeFullMarks(),
          endgameTutorialSeen: true,
          resourceDialogSeen: true,
        },
      };
    }
    if (view.name === "inventory") {
      if (!fullArtifactSlices || !fullRecipeSlices) throw new Error("全册夹具未载入");
      const artifacts = fullArtifactSlices();
      const recipes = fullRecipeSlices();
      slices = {
        ...slices,
        lore: { ...slices.lore, ...recipes.lore },
        resources: { ...slices.resources, ...recipes.resources },
        inventory: {
          ...slices.inventory,
          artifacts: artifacts.inventory.artifacts,
          equippedArtifacts: artifacts.inventory.equippedArtifacts,
        },
      };
    }
    if (bigbag > 0 && (view.name === "inventory" || view.name === "market")) {
      // 造 bigbag 件装备进背包,把「几百件装备的列表重渲染」逼出来 —— 这才是
      // 这类放置游戏 jank 的真实来源(小包 2-3 件量不出列表成本)。
      if (view.name === "inventory") {
        if (!makeAffixTransferBag) throw new Error("转移候选夹具未载入");
        affixTransferFixture = makeAffixTransferBag(bigbag);
        slices = {
          ...slices,
          inventory: {
            ...slices.inventory,
            items: affixTransferFixture.items,
            equipped: { [affixTransferFixture.sourceSlot]: affixTransferFixture.sourceUid },
          },
        };
      } else {
        if (!makeBigBagItems) throw new Error("大背包夹具未载入");
        const items = makeBigBagItems(bigbag);
        slices = { ...slices, inventory: { ...slices.inventory, items } };
      }
    }
    await seedSave(context, slices);
    const page = await context.newPage();
    const errors = [];
    watchPageErrors(page, errors);
    page.on("crash", () => errors.push("RENDERER_CRASH"));
    const url = base + (noSeed ? "" : `#${view.route}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    if (view.name === "collection") {
      const collectionTab = page.getByRole("tab", { name: "收藏" });
      if ((await collectionTab.count()) === 0) throw new Error("收藏页签不存在");
      await collectionTab.click({ timeout: 3000 });
      await page.waitForTimeout(350);
    }
    if (view.name === "celestial") {
      const marksTab = page.getByRole("tab", { name: "道痕" });
      if ((await marksTab.count()) === 0) throw new Error("天界道痕页签不存在");
      await marksTab.click({ timeout: 3000 });
      await page.waitForTimeout(350);
    }
    await page.evaluate(SAMPLER);
    await page.waitForTimeout(secs * 1000);
    const data = await page.evaluate("window.__perfStop()");
    let batch = null;
    let artifactBatches = null;
    let recipeBatches = null;
    let slotCandidates = null;
    let affixTransfer = null;
    let marketBatches = null;
    let collectionBatches = null;
    let gongfaBatches = null;
    let marksBatches = null;
    let peakNodes = data.nodes;
    if (bigbag > 0 && view.name === "inventory") {
      batch = await expandAllBatches(
        page,
        "main button[data-uid]",
        'main button[aria-label^="再看 "]',
        {
          selector: "[data-inventory-total]",
          attribute: "data-inventory-total",
          count: bigbag,
        },
        {
          startSelector: "[data-inventory-start]",
          startAttribute: "data-inventory-start",
          previousSelector: "[data-inventory-prev]",
        },
      );
      peakNodes = Math.max(peakNodes, batch.peakNodes);
      try {
        const artifactTab = page.getByRole("tab", { name: /法\s*宝/ }).first();
        if ((await artifactTab.count()) === 0) throw new Error("法宝页签不存在");
        await artifactTab.click({ timeout: 3000 });
        await page.waitForTimeout(120);
        artifactBatches = await expandAllBatches(
          page,
          "[data-artifact-row]",
          "button[data-artifact-more]",
          {
            selector: "[data-artifact-total]",
            attribute: "data-artifact-total",
            count: fullArtifactCount,
          },
          {
            startSelector: "[data-artifact-total]",
            startAttribute: "data-artifact-start",
            previousSelector: "button[data-artifact-prev]",
          },
        );
      } catch (error) {
        artifactBatches = {
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: String(error),
        };
      }
      try {
        const recipeTab = page.getByRole("tab", { name: /丹/ }).first();
        if ((await recipeTab.count()) === 0) throw new Error("丹药页签不存在");
        await recipeTab.click({ timeout: 3000 });
        await page.waitForTimeout(120);
        const brewing = page.locator("main button", { hasText: /开炉炼丹/ }).first();
        if ((await brewing.count()) === 0) throw new Error("开炉炼丹入口不存在");
        await brewing.click({ timeout: 3000 });
        await page
          .locator("[data-recipe-total]")
          .first()
          .waitFor({ state: "visible", timeout: 3000 });
        recipeBatches = await expandAllBatches(
          page,
          "[data-recipe-row]",
          "button[data-recipe-more]",
          {
            selector: "[data-recipe-total]",
            attribute: "data-recipe-total",
            count: fullRecipeCount,
          },
          {
            startSelector: "[data-recipe-total]",
            startAttribute: "data-recipe-start",
            previousSelector: "button[data-recipe-prev]",
          },
        );
        await page.keyboard.press("Escape");
        await page
          .locator("[data-recipe-total]")
          .first()
          .waitFor({ state: "detached", timeout: 3000 });
      } catch (error) {
        await page.keyboard.press("Escape").catch(() => {});
        recipeBatches = {
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: String(error),
        };
      }
      const equipTab = page.getByRole("tab", { name: /装\s*备/ }).first();
      if ((await equipTab.count()) === 0) throw new Error("装备页签不存在");
      await equipTab.click({ timeout: 3000 });
      await page.waitForTimeout(120);
      try {
        if (!affixTransferFixture) throw new Error("转移候选夹具未带进当前视图");
        for (let i = 0; i < 20; i += 1) {
          const previous = page.locator("[data-inventory-prev]").first();
          if ((await previous.count()) === 0) break;
          await previous.click({ timeout: 3000 });
        }
        const sourceCard = page.locator(
          `main button[data-uid="${affixTransferFixture.sourceUid}"]`,
        );
        await sourceCard.waitFor({ state: "visible", timeout: 3000 });
        await sourceCard.click({ timeout: 3000 });
        await page
          .getByRole("button", { name: /词条转移 · 移至别件/ })
          .first()
          .click({ timeout: 3000 });
        await page
          .getByRole("button", { name: affixTransferFixture.affixName, exact: true })
          .first()
          .click({ timeout: 3000 });
        await page
          .locator("[data-affix-candidate-total]")
          .first()
          .waitFor({ state: "visible", timeout: 3000 });
        const total = Number(
          await page
            .locator("[data-affix-candidate-total]")
            .first()
            .getAttribute("data-affix-candidate-total"),
        );
        if (total !== affixTransferFixture.candidateCount) {
          throw new Error(
            `转移夹具只装进 ${total} 件候选,承诺 ${affixTransferFixture.candidateCount} 件`,
          );
        }
        affixTransfer = await expandAllBatches(
          page,
          "[data-affix-candidate]",
          "button[data-affix-candidate-more]",
          {
            selector: "[data-affix-candidate-total]",
            attribute: "data-affix-candidate-total",
            count: affixTransferFixture.candidateCount,
          },
          {
            startSelector: "[data-affix-candidate-total]",
            startAttribute: "data-affix-candidate-start",
            previousSelector: "button[data-affix-candidate-prev]",
          },
        );
        await page.keyboard.press("Escape");
      } catch (error) {
        await page.keyboard.press("Escape").catch(() => {});
        const pageState = await page
          .evaluate((uid) => ({
            hash: location.hash,
            tabs: [...document.querySelectorAll("[role=tab]")].map((el) =>
              (el.textContent || "").trim(),
            ),
            inventoryTotal:
              document
                .querySelector("[data-inventory-total]")
                ?.getAttribute("data-inventory-total") ?? null,
            cards: [...document.querySelectorAll("main button[data-uid]")]
              .slice(0, 16)
              .map((el) => el.getAttribute("data-uid")),
            sourceCards: document.querySelectorAll(`main button[data-uid="${String(uid)}"]`).length,
          }))
          .catch(() => null);
        affixTransfer = {
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: `${String(error)}${pageState ? `; 当前 ${JSON.stringify(pageState)}` : ""}`,
        };
      }
      await page
        .locator("[data-affix-candidate-total]")
        .first()
        .waitFor({ state: "detached", timeout: 3000 })
        .catch(() => {});
      try {
        const trigger = page.locator('[data-equip-slot="weapon"]').first();
        if ((await trigger.count()) === 0) throw new Error("没有武器槽入口");
        await trigger.click({ timeout: 3000 });
        await page.waitForTimeout(120);
        const total = Number(
          await page
            .locator("[data-slot-candidate-total]")
            .first()
            .getAttribute("data-slot-candidate-total"),
        );
        if (!Number.isFinite(total) || total <= 0) throw new Error("部位候选没有报总数");
        slotCandidates = await expandAllBatches(
          page,
          "[data-slot-candidate]",
          "button[data-slot-candidate-more]",
          {
            selector: "[data-slot-candidate-total]",
            attribute: "data-slot-candidate-total",
            count: total,
          },
          {
            startSelector: "[data-slot-candidate-total]",
            startAttribute: "data-slot-candidate-start",
            previousSelector: "button[data-slot-candidate-prev]",
          },
        );
      } catch (error) {
        slotCandidates = {
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: String(error),
        };
      }
    }
    if (bigbag > 0 && view.name === "market") {
      const sellTab = page.getByRole("tab", { name: "售出", exact: true });
      if ((await sellTab.count()) === 0) throw new Error("坊市没有「售出」页签");
      await sellTab.click();
      await page.waitForTimeout(120);
      const consign = await expandAllBatches(
        page,
        "button[data-consign-uid]",
        'button[data-market-more="consign"]',
        {
          selector: "[data-market-consign-total]",
          attribute: "data-market-consign-total",
          count: bigbag,
        },
        {
          startSelector: "[data-market-consign-start]",
          startAttribute: "data-market-consign-start",
          previousSelector: '[data-market-prev="consign"]',
        },
      );
      let candidates;
      try {
        const bountyTab = page.getByRole("tab", { name: "悬赏", exact: true });
        if ((await bountyTab.count()) === 0) throw new Error("坊市没有「悬赏」页签");
        await bountyTab.click();
        await page.waitForTimeout(120);
        const trigger = page.locator("[data-bounty-equip]").first();
        if ((await trigger.count()) === 0) throw new Error("没有贡器悬赏入口");
        await trigger.click({ timeout: 3000 });
        await page.waitForTimeout(120);
        candidates = await expandAllBatches(
          page,
          "button[data-equip-candidate]",
          'button[data-market-more="equip"]',
          {
            selector: "[data-market-candidate-total]",
            attribute: "data-market-candidate-total",
            count: bigbag,
          },
          {
            startSelector: "[data-market-candidate-start]",
            startAttribute: "data-market-candidate-start",
            previousSelector: '[data-market-prev="equip"]',
          },
        );
      } catch (error) {
        candidates = {
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: String(error),
        };
      }
      peakNodes = Math.max(
        peakNodes,
        consign.peakNodes ?? 0,
        candidates.peakNodes ?? 0,
        await page.evaluate(() => document.querySelectorAll("*").length),
      );
      marketBatches = { consign, candidates };
    }
    if (view.name === "cultivation") {
      gongfaBatches = [];
      for (const [key, label] of [
        ["main", "主修"],
        ["sub", "辅修"],
        ["secret", "秘术"],
      ]) {
        await page.locator(`[data-gongfa-cat="${key}"]`).click({ timeout: 3000 });
        await page.waitForTimeout(120);
        const total = Number(
          await page.locator("[data-gongfa-total]").first().getAttribute("data-gongfa-total"),
        );
        if (!Number.isFinite(total) || total <= 12) {
          throw new Error(`${label}册没有形成多批清单(${total})`);
        }
        gongfaBatches.push({
          key,
          label,
          ...(await expandAllBatches(
            page,
            "[data-gongfa-row]",
            "button[data-gongfa-more]",
            {
              selector: "[data-gongfa-total]",
              attribute: "data-gongfa-total",
              count: total,
            },
            {
              startSelector: "[data-gongfa-total]",
              startAttribute: "data-gongfa-start",
              previousSelector: "button[data-gongfa-prev]",
            },
          )),
        });
      }
      peakNodes = Math.max(
        peakNodes,
        ...gongfaBatches.map((batch) => batch.peakNodes ?? 0),
        await page.evaluate(() => document.querySelectorAll("*").length),
      );
    }
    if (view.name === "celestial") {
      marksBatches = await expandAllBatches(
        page,
        "[data-mark-row]",
        "button[data-marks-more]",
        {
          selector: "[data-marks-total]",
          attribute: "data-marks-total",
          count: FULL_MARKS_COUNT,
        },
        {
          startSelector: "[data-marks-total]",
          startAttribute: "data-marks-start",
          previousSelector: "button[data-marks-prev]",
        },
      );
      peakNodes = Math.max(
        peakNodes,
        marksBatches.peakNodes ?? 0,
        await page.evaluate(() => document.querySelectorAll("*").length),
      );
    }
    if (view.name === "collection") {
      const categories = await page
        .locator("button[data-collection-category-toggle]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-collection-category-toggle")).filter(Boolean),
        );
      collectionBatches = [];
      for (const category of categories) {
        const toggle = page.locator(`button[data-collection-category-toggle="${category}"]`);
        if ((await toggle.getAttribute("aria-expanded")) !== "true") {
          await toggle.click({ timeout: 3000 });
          await page.waitForTimeout(120);
        }
        const categoryTotal = Number(
          await page
            .locator(`section[data-collection-category="${category}"]`)
            .first()
            .getAttribute("data-collection-total"),
        );
        collectionBatches.push({
          key: category,
          ...(await expandAllBatches(
            page,
            `button[data-codex-entry="${category}"]`,
            `button[data-collection-more="${category}"]`,
            {
              selector: `section[data-collection-category="${category}"]`,
              attribute: "data-collection-total",
              count: categoryTotal,
            },
            {
              startSelector: `section[data-collection-category="${category}"]`,
              startAttribute: "data-collection-start",
              previousSelector: `button[data-collection-prev="${category}"]`,
            },
          )),
        });
        await toggle.click({ timeout: 3000 });
        await page.waitForTimeout(80);
      }
      if (collectionBatches.length === 0) {
        collectionBatches.push({
          key: "all",
          before: 0,
          promised: 0,
          after: 0,
          steps: 0,
          slides: 0,
          peakNodes: 0,
          ok: false,
          reason: "全收集夹具没有触发任何续开按钮",
        });
      }
      peakNodes = Math.max(
        peakNodes,
        ...collectionBatches.map((batch) => batch.peakNodes ?? 0),
        await page.evaluate(() => document.querySelectorAll("*").length),
      );
    }
    record = {
      name: view.name,
      route: view.route,
      ...data,
      nodes: data.nodes,
      peakNodes,
      batch,
      artifactBatches,
      recipeBatches,
      slotCandidates,
      affixTransfer,
      marketBatches,
      collectionBatches,
      gongfaBatches,
      marksBatches,
      errors,
    };
    await context.close();
  } catch (err) {
    record = { name: view.name, route: view.route, crashed: String(err).slice(0, 160) };
  }
  results.push(record);
}
await browser.close();
server.close();

// ---- 报告 ----
function batchChecks(r) {
  const checks = [];
  if (r.batch) checks.push(["续开", r.batch]);
  if (r.artifactBatches) checks.push(["法宝续开", r.artifactBatches]);
  if (r.recipeBatches) checks.push(["丹方续开", r.recipeBatches]);
  if (r.slotCandidates) checks.push(["部位候选续开", r.slotCandidates]);
  if (r.affixTransfer) checks.push(["词条转移续开", r.affixTransfer]);
  for (const batch of r.gongfaBatches ?? []) checks.push([`功法/${batch.label}续开`, batch]);
  if (r.marksBatches) checks.push(["道痕续开", r.marksBatches]);
  if (r.marketBatches?.consign) checks.push(["寄卖续开", r.marketBatches.consign]);
  if (r.marketBatches?.candidates) checks.push(["贡器续开", r.marketBatches.candidates]);
  for (const batch of r.collectionBatches ?? []) checks.push([`收藏/${batch.key}续开`, batch]);
  return checks;
}

for (const r of results) {
  const checks = r.crashed ? [] : batchChecks(r);
  const batchText = checks
    .map(
      ([label, b]) =>
        `${label}=${b.before}→${b.after}${
          b.singleWindow ? "(单窗)" : b.steps > 1 ? `(${b.steps}批/滑${b.slides})` : ""
        }${b.finalNodes && b.finalNodes !== b.peakNodes ? ` 收=${b.finalNodes}` : ""}${
          (["法宝续开", "丹方续开", "部位候选续开", "词条转移续开"].includes(label) ||
            label.startsWith("功法/") ||
            label === "道痕续开") &&
          b.peakNodes
            ? ` peak=${b.peakNodes}`
            : ""
        }`,
    )
    .join(" ");
  const deepDom = (r.peakNodes ?? r.nodes) !== r.nodes ? ` peak=${r.peakNodes}` : "";
  const state = r.crashed
    ? `✗ ${r.name} CRASHED: ${r.crashed}`
    : `✓ ${r.name.padEnd(11)} frames=${r.frames} max=${r.max}ms p95=${r.p95}ms med=${r.median}ms >50ms=${r.over50ms} dom=${r.nodes}${deepDom}${
        batchText ? ` ${batchText}` : ""
      }${r.errors.length ? ` errors=${r.errors.join("|").slice(0, 60)}` : ""}`;
  console.log(state);
  if (r.crashed) failures.push(`${r.name}: 崩溃 (${r.crashed})`);
  else if (r.errors.length) failures.push(`${r.name}: 页面异常 (${r.errors[0].slice(0, 80)})`);
  else if (gate && r.max > BUDGET.maxFrameMs)
    failures.push(`${r.name}: 最差帧 ${r.max}ms > ${BUDGET.maxFrameMs}ms`);
  else if (gate && r.over50ms > BUDGET.longFramesMax)
    failures.push(`${r.name}: ${r.over50ms} 帧 >50ms 长帧 > ${BUDGET.longFramesMax}`);
  else if (gate && r.slotCandidates?.peakNodes > 1100)
    failures.push(
      `${r.name}: 部位候选 DOM ${r.slotCandidates.peakNodes} > 1100 —— 候选表是否又整批进弹窗了`,
    );
  else if (gate && r.artifactBatches?.peakNodes > 1100)
    failures.push(
      `${r.name}: 法宝全册 DOM ${r.artifactBatches.peakNodes} > 1100 —— 密卡是否又整册进页面了`,
    );
  else if (gate && r.recipeBatches?.peakNodes > 1100)
    failures.push(
      `${r.name}: 丹方全册 DOM ${r.recipeBatches.peakNodes} > 1100 —— 方子是否又整册进弹窗了`,
    );
  else if (gate && r.affixTransfer?.peakNodes > 1100)
    failures.push(
      `${r.name}: 词条转移候选 DOM ${r.affixTransfer.peakNodes} > 1100 —— 整包候选是否又铺进小滚动框了`,
    );
  else if (
    gate &&
    r.marksBatches?.peakNodes > (BUDGET.maxDomByView[r.name] ?? Number.POSITIVE_INFINITY)
  ) {
    failures.push(
      `${r.name}: 道痕满卷 DOM ${r.marksBatches.peakNodes} > ${BUDGET.maxDomByView[r.name]} —— 整卷履历是否又进了页面`,
    );
  } else if (
    gate &&
    r.gongfaBatches?.some(
      (batch) => batch.peakNodes > (BUDGET.maxDomByView[r.name] ?? Number.POSITIVE_INFINITY),
    )
  ) {
    const bad = r.gongfaBatches.find(
      (batch) => batch.peakNodes > (BUDGET.maxDomByView[r.name] ?? Number.POSITIVE_INFINITY),
    );
    failures.push(
      `${r.name}: 功法/${bad.label}册 DOM ${bad.peakNodes} > ${BUDGET.maxDomByView[r.name]} —— 整门书册是否又进了 DOM`,
    );
  } else if (
    gate &&
    BUDGET.maxDomByView[r.name] &&
    (r.peakNodes ?? r.nodes) > BUDGET.maxDomByView[r.name]
  ) {
    failures.push(
      `${r.name}: DOM ${r.peakNodes ?? r.nodes} > ${BUDGET.maxDomByView[r.name]} —— 长列表是否又整批进首帧了`,
    );
  } else if (gate && checks.some(([, b]) => !b.ok)) {
    const [label, bad] = checks.find(([, b]) => !b.ok);
    failures.push(
      `${r.name}: ${label}批次未兑现(承诺 +${bad.promised},实际 ${bad.before}→${bad.after};${bad.reason ?? "无异常"})`,
    );
  }
}

console.log(
  `\n判据:最差帧 ≤ ${BUDGET.maxFrameMs}ms · 长帧 ≤ ${BUDGET.longFramesMax} · 修行功法 DOM ≤ ${BUDGET.maxDomByView.cultivation} · 背包 DOM ≤ ${BUDGET.maxDomByView.inventory} · 道痕满卷 DOM ≤ ${BUDGET.maxDomByView.celestial} · 法宝全册峰值 DOM ≤ 1100 · 丹方全册峰值 DOM ≤ 1100 · 部位候选峰值 DOM ≤ 1100 · 词条转移峰值 DOM ≤ 1100 · 坊市峰值 DOM ≤ ${BUDGET.maxDomByView.market} · 收藏峰值 DOM ≤ ${BUDGET.maxDomByView.collection} · 无崩溃/异常`,
);
if (failures.length > 0) {
  console.log(`✗ 有 ${failures.length} 处超限:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`✓ 全部 ${results.length} 个视图在预算内`);
}
