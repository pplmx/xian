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
 * 基线(2026-11-01 实测,本机 + 无头 chromium,后期档):全 17 视图 ~60fps、
 * 最差帧 17ms、零长帧;300 件背包逐页翻到底峰值 675,此前 1000 件加压为 682;
 * 全 45 件法宝逐批翻到末页再回翻峰值 667;54 张丹方同窗峰值 725;同包点开武器槽、
 * 部位候选逐页到底再回翻峰值 984;词条转移候选逐页到底峰值 978;坊市寄卖 + 贡器
 * 各翻到末页峰值 917;全收集九册共 809 条逐册翻到末页再回翻,峰值 715;
 * 全习得三册功法逐门翻到末页,峰值 533。预算见 BUDGET,曾有过更糟的读数时任它红。
 * 天界道痕满卷 60 则按 12 则一批、最多留 24 则,逐批到末页再回翻,峰值 364。
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
   * **交互段**最差帧上限(ms) —— 与静置段分开定。
   *
   * 静置 100ms 那条拦的是「页面自己不动时别卡」。交互段必然更贵:它包含首次把一个
   * 册页的内容渲染出来(法宝 45 条长账、词条转移候选等),那一拍的浏览器侧布局与
   * 合成不归应用代码管。实测(背包页最重的四种交互,跑三遍):
   *
   *   静置段          恒 17ms   0 长帧
   *   交互段(背包)   100 / 117 / 267ms,2 / 2 / 8 帧 >50ms
   *   交互段(其余 16 视图) ≤ 34ms,0 长帧
   *
   * 3 遍摆动这么大是因为它取决于那一次是否赶上一次完整重排。故这条只拦**量级回潮**
   * (比如某个册页又变回整册直铺,或翻批一次渲染几百条),300ms 是实测最差值 267ms
   * 的约 1.1 倍、常见值的十倍以上 —— 松,但它守的东西本来是「别成倍长回去」。
   */
  interactiveMaxFrameMs: Number(process.env.PERF_INTERACTIVE_MAX_FRAME_MS ?? 300),
  /**
   * 背包一次只留 32 张卡,可前后逐批翻完 300 件;80 张一窗实测 1048,故不设两批。
   * 法宝全册 45 条长账按 6+6 滑窗,全流程峰值 667;丹方 54 张同窗,峰值 611。
   * 词条转移 299 件候选按 12+12 滑窗,逐批开完峰值 948。四条密清单单独守 1100,
   * 不松动背包首屏预算。
   * 坊市是短横条/弹窗行,每窗最多 64 条;寄卖与贡器都逐页翻到末页再回翻一批。
   * 收藏每册每窗最多 48 枚,九册都翻到末页再回翻,全流程峰值 715 DOM。
   * 修行页三册功法每窗最多 24 部,全习得 66 部逐门翻完;单门整册铺开也会随内容增长,
   * 故单独守住 700 DOM。
   * 天界道痕满卷 60 则每窗最多 24 则,全流程峰值 362;celestial 也守住 700 DOM。
   * 背包首帧与候选弹窗分开算:首帧含 32 张卡和整页账,守 800;弹窗叠在整页之上,
   * 与部位候选自己的 1100 上限共用一档。这样不会把「整页 + 浮层」误算成首帧回潮。
   * 1100 拦的是窗口上限失效、点击越多 DOM 越长的回潮。
   */
  maxDomByView: {
    cultivation: 700,
    inventory: 800,
    market: 1100,
    collection: 1100,
    celestial: 700,
  },
  /** 点开弹窗、续开长清单后的总 DOM；只有会叠浮层的背包另给一档。 */
  maxInteractiveDomByView: {
    cultivation: 700,
    inventory: 1100,
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

/**
 * 页内采样器:记录相邻帧间隔,`__perfStop()` 时汇总。
 *
 * ## 为什么要在「静置采样结束」之后还能接着记
 *
 * 这套门原先的采样器在**交互开始前**就停了:第 2500ms 起采几秒 → `__perfStop()` →
 * 然后才是批量展开、切页签、开弹窗。于是「点开 300 件装备的弹窗卡不卡」这件事
 * **从来没被量过** —— 而那恰恰是玩家最容易感觉到 jank 的时刻(静置时页面本来就
 * 不太动,帧率必然好看)。
 *
 * 现在 `__perfStop()` 只是把**静置段**结出来,采样器继续跑;交互跑完再调
 * `__perfStopInteractive()`,单独返回**交互段**的统计。两段分开报、分开判:
 *   · 静置段守「页面自己不动时别卡」;
 *   · 交互段守「点了之后别卡」。
 * 混成一段会让交互那几拍的尖峰淹没在几百帧静置里,看不出是哪一段坏的。
 *
 * IIFE 用 void 包裹,让 `evaluate(SAMPLER)` 立即返回(不被未 resolve 的 Promise 卡住)。
 */
const SAMPLER = `
  void (() => {
    let resolveFn;
    window.__perf = new Promise((r) => { resolveFn = r; });
    const frames = [];
    let last = performance.now();
    let raf;
    /** 交互段起点:__perfStop() 那一刻的帧数,之后记的都算交互 */
    let interactiveFrom = null;
    function step(now) {
      frames.push(now - last);
      last = now;
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    const summarize = (slice) => {
      const n = slice.length;
      if (n === 0) return { frames: 0, max: 0, p95: 0, median: 0, over50ms: 0 };
      const s = [...slice].sort((a, b) => a - b);
      const p = (q) => s[Math.min(n - 1, Math.floor(q * n))];
      return {
        frames: n,
        max: Math.round(p(1)),
        p95: Math.round(p(0.95)),
        median: Math.round(p(0.5)),
        over50ms: slice.filter((f) => f > 50).length,
      };
    };
    window.__perfStop = () => {
      /*
       * 只结「静置段」:交互还没开始,故到此为止的帧全是静置帧。
       * 采样器**不取消** —— 后面交互那几拍还要接着记。
       */
      interactiveFrom = frames.length;
      const out = { ...summarize(frames), nodes: document.querySelectorAll("body *").length };
      resolveFn(out);
      return window.__perf;
    };
    /** 交互段统计(由交互流程跑完后调用) */
    window.__perfStopInteractive = () => {
      cancelAnimationFrame(raf);
      if (interactiveFrom === null) return summarize(frames);
      return summarize(frames.slice(interactiveFrom));
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
  /*
   * 数 body *:预算问的是**页面上**有多少节点。head 里那些 modulepreload /
   * 字体 link 是构建产物,数量随 chunk 拆分变 —— 实测一次重构让它们多出一条,
   * 修行页峰值就从 700 跳到 701,而界面一个节点都没多。
   */
  let peakNodes = await page.evaluate(() => document.querySelectorAll("body *").length);
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
        await page.evaluate(() => document.querySelectorAll("body *").length),
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
    const finalNodes = await page.evaluate(() => document.querySelectorAll("body *").length);
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
    const finalNodes = await page.evaluate(() => document.querySelectorAll("body *").length);
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

/**
 * 载入 `src/core/perfBudget.ts`(纯函数判定)。
 *
 * 为什么不直接 `import`:`perfBudget.ts` 是 TypeScript 且带 `@/` 别名,Node 侧
 * 解析不了。仓里既有做法是借一个 vite 实例 `ssrLoadModule`,这里照做 —— 但必须是
 * **独立的一次**并提前载入并保存结果:`loadBenchModules` 自己会 `vite.close()`,
 * 而判定要等到所有视图跑完之后才发生。
 */
const viteForJudge = await createViteServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
let judgePerf;
try {
  ({ judgePerf } = await viteForJudge.ssrLoadModule("/src/core/perfBudget.ts"));
} finally {
  await viteForJudge.close();
}
if (typeof judgePerf !== "function") throw new Error("judgePerf 没载入 —— 判定会静默失效");

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
        // 1000 件背包会形成 31 批；固定回翻 20 次到不了首批,big_0 自然不在窗口里。
        // 一直点回首批,给一个远高于当前规模的上限只为防死循环。
        for (let i = 0; i < 100; i += 1) {
          const previous = page.locator("[data-inventory-prev]").first();
          if ((await previous.count()) === 0) break;
          await previous.click({ timeout: 3000 });
          await page.waitForTimeout(20);
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
      const sellTab = page.getByRole("tab", { name: /售出/ });
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
        const bountyTab = page.getByRole("tab", { name: /悬赏/ });
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
        await page.evaluate(() => document.querySelectorAll("body *").length),
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
        await page.evaluate(() => document.querySelectorAll("body *").length),
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
        await page.evaluate(() => document.querySelectorAll("body *").length),
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
            .locator(`[data-collection-category="${category}"]`)
            .first()
            .getAttribute("data-collection-total"),
        );
        const traySelector = `[data-collection-category-body="${category}"]`;
        collectionBatches.push({
          key: category,
          ...(await expandAllBatches(
            page,
            `${traySelector} button[data-codex-entry="${category}"]`,
            `${traySelector} button[data-collection-more="${category}"]`,
            {
              selector: traySelector,
              attribute: "data-collection-total",
              count: categoryTotal,
            },
            {
              startSelector: traySelector,
              startAttribute: "data-collection-start",
              previousSelector: `${traySelector} button[data-collection-prev="${category}"]`,
            },
          )),
        });
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
        await page.evaluate(() => document.querySelectorAll("body *").length),
      );
    }
    /*
     * 交互段统计 —— 静置采样结束后采样器仍在记,这里把它结出来。
     * 取不到就留 null(该视图没有交互流程,或页面已换文档),不硬编一个假读数。
     */
    let interactive = null;
    try {
      interactive = await page.evaluate("window.__perfStopInteractive?.() ?? null");
    } catch {
      interactive = null;
    }
    record = {
      name: view.name,
      route: view.route,
      ...data,
      interactive,
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
  /** 交互段读数(该视图没有交互流程时为 null) */
  const inter = r.interactive;
  const interText = inter
    ? ` · 交互 ${inter.frames}帧 max=${inter.max}ms p95=${inter.p95}ms >50ms=${inter.over50ms}`
    : "";
  const state = r.crashed
    ? `✗ ${r.name} CRASHED: ${r.crashed}`
    : `✓ ${r.name.padEnd(11)} frames=${r.frames} max=${r.max}ms p95=${r.p95}ms med=${r.median}ms >50ms=${r.over50ms} dom=${r.nodes}${deepDom}${
        batchText ? ` ${batchText}` : ""
      }${interText}${r.errors.length ? ` errors=${r.errors.join("|").slice(0, 60)}` : ""}`;
  console.log(state);
  /*
   * 帧率判定(静置段 + 交互段)走 `core/perfBudget.judgePerf` 这个纯函数,不写在脚本里。
   *
   * 理由写在 perfBudget.ts 的文件头:判定埋在脚本里时,「它有没有生效」只能靠正则扫
   * 文本,而文本扫描认的是「这串字符在不在」而不是「它有没有生效」—— 实测两次故障注入
   * (条件前后加 `false && `、把 failures.push 换成注释)都照样绿。抽成纯函数后
   * 由 `perfBudget.spec` 用用例回答,不必猜脚本长什么样。
   *
   * 崩溃与页面异常由这个函数自己短路(一个崩掉的页面不该再报十条帧率)。
   */
  failures.push(
    ...judgePerf(
      {
        name: r.name,
        max: r.max,
        over50ms: r.over50ms,
        interactive: r.interactive,
        crashed: r.crashed,
        errors: r.errors,
      },
      BUDGET,
      gate,
    ),
  );
  if (r.crashed || r.errors.length) {
    /* 崩溃/异常已经由 judgePerf 记下并短路,后面的 DOM 与批次对账不必再看 */
  } else if (gate && r.slotCandidates?.peakNodes > 1100)
    failures.push(
      `${r.name}: 部位候选 DOM ${r.slotCandidates.peakNodes} > 1100 —— 候选表是否又整批进弹窗了`,
    );
  else if (gate && r.artifactBatches?.peakNodes > 1100)
    failures.push(
      `${r.name}: 法宝全册 DOM ${r.artifactBatches.peakNodes} > 1100 —— 长账是否又整册进页面了`,
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
  } else if (gate && BUDGET.maxDomByView[r.name] && r.nodes > BUDGET.maxDomByView[r.name]) {
    failures.push(
      `${r.name}: 首帧 DOM ${r.nodes} > ${BUDGET.maxDomByView[r.name]} —— 长列表是否又整批进首帧了`,
    );
  } else if (
    gate &&
    BUDGET.maxInteractiveDomByView[r.name] &&
    (r.peakNodes ?? r.nodes) > BUDGET.maxInteractiveDomByView[r.name]
  ) {
    failures.push(
      `${r.name}: 交互后 DOM ${r.peakNodes ?? r.nodes} > ${BUDGET.maxInteractiveDomByView[r.name]} —— 窗口上限是否失效了`,
    );
  } else if (gate && checks.some(([, b]) => !b.ok)) {
    const [label, bad] = checks.find(([, b]) => !b.ok);
    failures.push(
      `${r.name}: ${label}批次未兑现(承诺 +${bad.promised},实际 ${bad.before}→${bad.after};${bad.reason ?? "无异常"})`,
    );
  }
}

console.log(
  `\n判据:最差帧 ≤ ${BUDGET.maxFrameMs}ms · 长帧 ≤ ${BUDGET.longFramesMax} · 交互段最差帧 ≤ ${BUDGET.interactiveMaxFrameMs}ms · 修行功法 DOM ≤ ${BUDGET.maxInteractiveDomByView.cultivation} · 背包首帧 DOM ≤ ${BUDGET.maxDomByView.inventory} / 弹窗峰值 ≤ ${BUDGET.maxInteractiveDomByView.inventory} · 道痕满卷 DOM ≤ ${BUDGET.maxInteractiveDomByView.celestial} · 法宝全册峰值 DOM ≤ 1100 · 丹方全册峰值 DOM ≤ 1100 · 部位候选峰值 DOM ≤ 1100 · 词条转移峰值 DOM ≤ 1100 · 坊市峰值 DOM ≤ ${BUDGET.maxInteractiveDomByView.market} · 收藏峰值 DOM ≤ ${BUDGET.maxInteractiveDomByView.collection} · 无崩溃/异常`,
);
if (failures.length > 0) {
  console.log(`✗ 有 ${failures.length} 处超限:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`✓ 全部 ${results.length} 个视图在预算内`);
}
