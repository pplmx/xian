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
 * 基线(2026-10-28 实测,本机 + 无头 chromium,后期档):全 17 视图 ~60fps、
 * 最差帧 17ms、零长帧;背包首批 40 张卡 DOM 632,坊市寄卖 + 贡器各续一批
 * 峰值 1003,其余页面 193–592。
 * 预算见 BUDGET,曾有过更糟的读数时任它红。
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { lateSlices, showcaseSlices, seedSave } from "./lib/saveFixture.mjs";
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
   * 背包按首批 40 张卡渲染;篇幅仍要滚得到,但 DOM 不许跟着 300 件一起翻几倍。
   * 坊市量的是「寄卖横条 + 贡器弹窗都续开一批」后的峰值:120 件全铺实测 1630,
   * 两窗各 40 件起、各续到 80 件为 1006,故 1100 只拦整包回潮。
   */
  maxDomByView: { inventory: 700, market: 1100 },
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
 * 选择器都走稳定的 data-* 落点,不拿人话文本当机器判据。
 */
async function expandBatch(page, itemSelector, moreSelector) {
  try {
    const items = page.locator(itemSelector);
    const more = page.locator(moreSelector).first();
    const before = await items.count();
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
    return { before, promised, after, ok: after === before + promised };
  } catch (error) {
    return { before: 0, promised: 0, after: 0, ok: false, reason: String(error) };
  }
}

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
    if (bigbag > 0 && (view.name === "inventory" || view.name === "market")) {
      // 造 bigbag 件装备进背包,把「几百件装备的列表重渲染」逼出来 —— 这才是
      // 这类放置游戏 jank 的真实来源(小包 2-3 件量不出列表成本)。
      const templates = ["w_chensha", "b_xingluo", "a_zhenhong", "a_luoxiao"];
      const items = Array.from({ length: bigbag }, (_, i) => ({
        uid: `big_${i}`,
        templateId: templates[i % templates.length],
        quality: ["mortal", "spirit", "earth", "heaven"][i % 4],
        // 后期档主境界是 14;贡器候选也逼到整包都有资格,不能只量空弹窗。
        tier: 14,
        level: 0,
        affixes: [
          { id: "bs3", roll: 1 },
          { id: "low2", roll: 1 },
        ],
      }));
      slices = { ...slices, inventory: { ...slices.inventory, items } };
    }
    await seedSave(context, slices);
    const page = await context.newPage();
    const errors = [];
    watchPageErrors(page, errors);
    page.on("crash", () => errors.push("RENDERER_CRASH"));
    const url = base + (noSeed ? "" : `#${view.route}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.evaluate(SAMPLER);
    await page.waitForTimeout(secs * 1000);
    const data = await page.evaluate("window.__perfStop()");
    let batch = null;
    let marketBatches = null;
    let peakNodes = data.nodes;
    if (bigbag > 0 && view.name === "inventory") {
      batch = await expandBatch(page, "main button[data-uid]", 'main button[aria-label^="再看 "]');
    }
    if (bigbag > 0 && view.name === "market") {
      const consign = await expandBatch(
        page,
        "button[data-consign-uid]",
        'button[data-market-more="consign"]',
      );
      let candidates;
      try {
        const trigger = page.locator("[data-bounty-equip]").first();
        if ((await trigger.count()) === 0) throw new Error("没有贡器悬赏入口");
        await trigger.click({ timeout: 3000 });
        await page.waitForTimeout(120);
        candidates = await expandBatch(
          page,
          "button[data-equip-candidate]",
          'button[data-market-more="equip"]',
        );
      } catch (error) {
        candidates = {
          before: 0,
          promised: 0,
          after: 0,
          ok: false,
          reason: String(error),
        };
      }
      peakNodes = await page.evaluate(() => document.querySelectorAll("*").length);
      marketBatches = { consign, candidates };
    }
    record = {
      name: view.name,
      route: view.route,
      ...data,
      nodes: data.nodes,
      peakNodes,
      batch,
      marketBatches,
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
  if (r.marketBatches?.consign) checks.push(["寄卖续开", r.marketBatches.consign]);
  if (r.marketBatches?.candidates) checks.push(["贡器续开", r.marketBatches.candidates]);
  return checks;
}

for (const r of results) {
  const checks = r.crashed ? [] : batchChecks(r);
  const batchText = checks.map(([label, b]) => `${label}=${b.before}→${b.after}`).join(" ");
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
  else if (
    gate &&
    BUDGET.maxDomByView[r.name] &&
    (r.peakNodes ?? r.nodes) > BUDGET.maxDomByView[r.name]
  )
    failures.push(
      `${r.name}: DOM ${r.peakNodes ?? r.nodes} > ${BUDGET.maxDomByView[r.name]} —— 长列表是否又整批进首帧了`,
    );
  else if (gate && checks.some(([, b]) => !b.ok)) {
    const [label, bad] = checks.find(([, b]) => !b.ok);
    failures.push(
      `${r.name}: ${label}批次未兑现(承诺 +${bad.promised},实际 ${bad.before}→${bad.after};${bad.reason ?? "无异常"})`,
    );
  }
}

console.log(
  `\n判据:最差帧 ≤ ${BUDGET.maxFrameMs}ms · 长帧 ≤ ${BUDGET.longFramesMax} · 背包 DOM ≤ ${BUDGET.maxDomByView.inventory} · 坊市峰值 DOM ≤ ${BUDGET.maxDomByView.market} · 无崩溃/异常`,
);
if (failures.length > 0) {
  console.log(`✗ 有 ${failures.length} 处超限:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`✓ 全部 ${results.length} 个视图在预算内`);
}
