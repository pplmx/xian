/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 离线自检 —— 「断网还能重开」这句承诺,真的兑现了吗
 *
 * 为什么单起一个脚本:layout-check 跑在 `file://` 上,而 Service Worker 只认
 * 安全上下文(https 或 localhost),两件事没法在同一个页面里量。故这里起一个
 * 本地静态服务(dist 的临时副本),在那里量 SW 的浏览器级行为。
 *
 * 量的六件事(全部只认结果,不认实现):
 *   一 首次联网访问后,SW 真的接管了页面(controller 非空)—— 没接管就没有离线;
 *   二 缓存里**同时**有导航页与带 hash 的产物;activate 时旧版本缓存被清掉
 *      (CACHE_VERSION 改了却忘了清,玩家离线回退就会落到老页面);
 *   三 **断网重载**仍能起得来(离线可重开 —— 这是玩家在飞机/地铁上唯一的指望);
 *   四 **首访即断网**:只访问一次、不刷新,关掉再断网打开也得起得来 ——
 *      "刷新过好几次"的页面早被缓存喂饱了,量不出真实事故(见第四节);
 *   五 **子路径部署**:Pages 那条入口在 `/xian/`,根路径下绿不代表它绿(见第五节);
 *   六 **发版接管**:导航请求走 network-first,线上改了 index.html 之后,
 *      再次访问必须看到新那份(否则玩家被永久钉在旧版本上)。
 *
 * 要求 **安装成功才激活**:sw.js 的 install 先预缓存导航壳(scope 根 + index.html),
 * 拿不到就不 skipWaiting —— 这样"装好了、缓存却是空的"这种半吊子状态不存在。
 *
 * 用法:
 *   bun run build
 *   bunx playwright install chromium
 *   bun scripts/offline-check.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { watchPageErrors } from "./lib/pageErrors.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html 不存在 —— 先跑 `bun run build`(自检量的是构建产物)");
  process.exit(1);
}

/**
 * SW 的缓存版本号 —— 从**构建产物**读,不从源码读。
 *
 * 源码里那串是 `xuanshu-v2-__CACHE_VERSION_SUFFIX__`,后缀由构建期按产物清单
 * 派生(vite.config.ts 的 sw-precache-manifest 插件)。若照着源码读,判据手里
 * 拿到的会是带占位符的版本,而浏览器里建起来的是填好后的 —— 断言"缓存分片
 * 已建立"当场假红。判据要读的是玩家真正会加载的那份。
 */
const CACHE_VERSION = /CACHE_VERSION\s*=\s*["']([^"']+)["']/.exec(
  readFileSync(join(ROOT, "dist/sw.js"), "utf8"),
)?.[1];
if (!CACHE_VERSION) {
  console.error("从 dist/sw.js 里读不到 CACHE_VERSION —— 先跑一次构建再量离线");
  process.exit(1);
}
if (/__CACHE_VERSION_SUFFIX__/.test(CACHE_VERSION)) {
  console.error(
    `dist/sw.js 里的缓存版本仍是占位符(${CACHE_VERSION})—— 构建期的 sw-precache-manifest 插件没跑成`,
  );
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

/**
 * 起一个够用的静态服务:根路径回 index.html,带扩展名的 404 就直接 404。
 *
 * @param dir  要服务的目录(通常是 dist 的副本)
 * @param prefix 部署前缀(默认空 = 站点在 `/`)。GitHub Pages 那条入口在 `/xian/`,
 *   子路径部署时 base 是 `./`,SW 的 scope、产物地址、导航壳全部相对解析 ——
 *   根路径下绿不代表子路径下绿,故这里要能服务一个前缀(`--prefix /xian/`)。
 */
function serve(dir, prefix = "") {
  const p = prefix.replace(/\/+$/, "");
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    // 子路径模式:请求不在前缀下 → 404(真实静态托管就是这样)
    if (p && !(url === p || url.startsWith(`${p}/`))) {
      res.writeHead(404).end("not found");
      return;
    }
    const rel = p ? url.slice(p.length) || "/" : url;
    const target = join(dir, rel === "/" ? "index.html" : rel);
    if (!target.startsWith(dir) || !existsSync(target) || statSync(target).isDirectory()) {
      if (extname(rel)) {
        res.writeHead(404).end("not found");
        return;
      }
      // 无扩展名的都是应用内路由:一律回站点根的 index.html(hash 路由下也是它)
      const home = join(dir, "index.html");
      if (!existsSync(home)) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(readFileSync(home));
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
    res.end(readFileSync(target));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const failures = [];
const pass = [];

// 用 dist 的副本:第四件事要改 index.html,不能动真产物
const work = mkdtempSync(join(tmpdir(), "offline-check-"));
cpSync(DIST, work, { recursive: true });

const server = await serve(work);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const pageErrors = [];
watchPageErrors(page, pageErrors);

/** 应用真的起来了 —— 认「启封入山」这扇门,不认某个 div 存不存在 */
async function booted() {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const door = /启封入山/.test(text);
    return { door, blank: text.trim().length === 0, swError: /离线且无缓存副本/.test(text) };
  });
}

// ---- 一 首次联网访问:SW 接管 + 缓存落盘 ----
// 先在同一个 origin 上种一份"老版本缓存",看 activate 会不会把它清掉
await page.goto(`${base}/privacy.html`, { waitUntil: "load" });
await page.evaluate(async () => {
  const c = await caches.open("xuanshu-v0-stale");
  await c.put("/stale-marker", new Response("old"));
});

await page.goto(`${base}/`, { waitUntil: "load" });
const controlled = await page
  .evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  })
  .catch(() => false);

// 首次加载时 SW 刚接管,页面本身可能还没被控制;刷新一次就该是它了
if (!controlled) await page.reload({ waitUntil: "load" });
const afterReloadControlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
if (!afterReloadControlled) {
  failures.push("SW 没能接管页面(navigator.serviceWorker.controller 为空)—— 没接管就没有离线");
} else {
  pass.push("SW 已接管页面");
}

/**
 * 等缓存真被填上 —— **最多重试几轮**,而不是量一次就下结论。
 *
 * 为什么:SW 的"接管"与"这一轮导航是否已经走了它"之间有个窄窗口 —— 首次加载尤其如此。
 * 实测(CI 上更明显)出现过 "controller 非空、缓存却是 0 条" 的形态:那一轮资源没经过 SW,
 * 于是什么都没落下。判断"离线能不能用"不该取决于这个时序 ——
 * 判据不变(缓存里必须有导航页与带 hash 的产物),只是不再拿运气当判据
 * (与"坏档启动提示只活两秒多 → 轮询到它出现为止"同一条做法)。
 *
 * **判据从"条数够"改成"导航壳在里头"**:条数是个会骗人的代理指标 —— 首访时
 * 静态产物已经落了十几条,唯独导航页(index.html)没有(这次导航没经过 SW),
 * 旧判据 `filled >= 3` 照样绿,而玩家关掉页面再断网打开就是 503
 * 「离线且无缓存副本」。见下面第二节的三,那里量的正是这条真实路径。
 */
let cachesNow = await page.evaluate(() => caches.keys());
for (let attempt = 0; attempt < 4; attempt += 1) {
  const filled = await page.evaluate(async (name) => {
    if (!(await caches.keys()).includes(name)) return 0;
    const c = await caches.open(name);
    return (await c.keys()).length;
  }, CACHE_VERSION);
  if (filled >= 3) {
    // 快路径:第一轮就量够了,直接 break —— 此时不能沿用循环外的旧快照,
    // 那是在 SW 异步接管/填充/清理完成前抓的,会自己变红(缓存其实健康)。
    cachesNow = await page.evaluate(() => caches.keys());
    break;
  }
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(600);
  cachesNow = await page.evaluate(() => caches.keys());
}

if (!cachesNow.includes(CACHE_VERSION))
  failures.push(`缓存里没有 ${CACHE_VERSION}(现为:${cachesNow.join("、") || "空"})`);
else pass.push(`缓存分片 ${CACHE_VERSION} 已建立`);
if (cachesNow.includes("xuanshu-v0-stale")) {
  failures.push(
    "activate 没有清理旧版本缓存(xuanshu-v0-stale 还在)—— 改 CACHE_VERSION 也甩不掉老页面",
  );
} else {
  pass.push("旧版本缓存已被 activate 清掉");
}

const cachedCount = await page.evaluate(async (name) => {
  const c = await caches.open(name);
  return (await c.keys()).length;
}, CACHE_VERSION);
if (cachedCount < 3)
  failures.push(`缓存里只有 ${cachedCount} 条(导航页 + 静态产物至少该有几条)—— 离线必然缺件`);
else pass.push(`缓存里已备下 ${cachedCount} 份资源`);

/**
 * 导航壳必须在缓存里 —— 这条比"条数够"要紧得多。
 *
 * 条数是个会骗人的代理指标:首访时静态产物已经落了十几条,唯独导航页
 * (index.html / scope 根)没有。旧判据 `cachedCount >= 3` 照样绿,而玩家
 * 关掉页面再断网打开就是 503「离线且无缓存副本」—— 这正是 offline-check
 * 自己抓到过的那次红(靠重试碰运气才躲过),也是 docs/deployment.md 承诺
 * 「首次在线打开后,断网重开也能进游戏」的兑现点。
 * 现在 sw.js 在 install 里预缓存导航壳,判据在这里认它:认地址,不认条数。
 */
const shellCached = await page.evaluate(
  async ({ name, scope }) => {
    if (!(await caches.keys()).includes(name)) return { root: false, index: false, paths: [] };
    const c = await caches.open(name);
    const paths = (await c.keys()).map((r) => new URL(r.url).pathname);
    return {
      root: paths.includes(new URL(scope).pathname),
      index: paths.includes(new URL("index.html", scope).pathname),
      paths,
    };
  },
  { name: CACHE_VERSION, scope: `${base}/` },
);
if (!shellCached.root && !shellCached.index)
  failures.push(
    `缓存里没有导航壳(找过 ${base}/ 与 ${base}/index.html,实际 ${shellCached.paths.slice(0, 5).join("、") || "空"})—— ` +
      "首次在线访问后断网重开必落 503",
  );
else pass.push("导航壳已进缓存(离线重开只靠它)");

// ---- 二 断网重载:玩家在飞机/地铁上要的那一下 ----
await context.setOffline(true);
await page.reload({ waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(1500);
const off = await booted();
if (off.swError)
  failures.push("断网重载落到了 SW 的 503 兜底页(「离线且无缓存副本」)—— 缓存里缺导航页");
else if (!off.door || off.blank)
  failures.push("断网重载之后应用没起来(白屏/没出现入口)—— 离线可重开这句承诺没兑现");
else pass.push("断网重载:应用照常起得来");
await context.setOffline(false);

// ---- 三 发版接管:线上换了 index.html,玩家必须看到新的那份 ----
const stamp = Date.now();
const marker = `deploy-${stamp}`;
writeFileSync(
  join(work, "index.html"),
  readFileSync(join(work, "index.html"), "utf8").replace("</head>", `<!-- ${marker} --></head>`),
);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const gotNew = await page.evaluate((m) => document.documentElement.innerHTML.includes(m), marker);
if (!gotNew)
  failures.push(
    "线上换了 index.html,再次访问仍是旧页面 —— 导航请求没有走 network-first,玩家会被钉在旧版本",
  );
else pass.push("发版接管:导航请求拿到了新的 index.html");

if (pageErrors.length) failures.push(`离线自检页面异常:${[...new Set(pageErrors)].join(" | ")}`);

/**
 * ---- 四 首访即断网:玩家最常撞上的那条路径 ----
 *
 * 前三节都在"刷新过好几次"的页面上量 —— 那种页面早就被 SW 接管、缓存也被
 * 导航请求顺手填满了,量不出真实事故。真正的玩家路径是:**第一次打开,玩一会儿,
 * 关掉标签页,地铁里再打开**。这一节用一个干净 context 复刻它:只访问一次、
 * 不刷新,然后直接断网重开。
 *
 * 这条判据在修 sw.js(install 预缓存导航壳)之前是红的 —— 断网重开落在
 * 503「离线且无缓存副本」上,而部署文档写着"首次在线打开后,断网重开也能进游戏"。
 */
{
  const fresh = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p2 = await fresh.newPage();
  const errs2 = [];
  watchPageErrors(p2, errs2);
  await p2.goto(`${base}/`, { waitUntil: "load" });
  await p2.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 只等 SW 装完(install 里预缓存导航壳),**不刷新** —— 刷新会把这次导航喂给 SW,
  // 那正是首访场景里不存在的一步。
  const freshShell = await p2.evaluate(async (name) => {
    if (!(await caches.keys()).includes(name)) return false;
    const c = await caches.open(name);
    const paths = (await c.keys()).map((r) => new URL(r.url).pathname);
    return paths.includes("/") || paths.includes("/index.html");
  }, CACHE_VERSION);
  if (!freshShell)
    failures.push(
      "首访不刷新时导航壳就不在缓存里 —— 玩家关掉页面再断网打开必落 503(install 该预缓存它)",
    );
  await fresh.setOffline(true);
  await p2.reload({ waitUntil: "load" }).catch(() => {});
  await p2.waitForTimeout(1200);
  const off2 = await p2.evaluate(() => {
    const text = document.body?.innerText || "";
    return {
      door: /启封入山/.test(text),
      blank: text.trim().length === 0,
      swError: /离线且无缓存副本/.test(text),
    };
  });
  if (off2.swError)
    failures.push("首访之后直接断网重开落到了 503 兜底页 —— install 没预缓存导航壳");
  else if (!off2.door || off2.blank)
    failures.push("首访之后直接断网重开,应用没起来 —— 离线可重开只在「刷新过」的页面上成立");
  else pass.push("首访即断网:不刷新也能重开(install 预缓存导航壳)");
  if (errs2.length) failures.push(`首访断网那一轮页面异常:${[...new Set(errs2)].join(" | ")}`);
  await fresh.close();
}

/**
 * ---- 五 子路径部署:GitHub Pages 那条入口在 /xian/ ----
 *
 * 本仓的部署矩阵里有两条网页入口:Cloudflare 在站点根,Pages 在 `/xian/` 子路径。
 * `base: './'` 让产物按相对路径解析,SW 的 scope 也随之落在 `/xian/` —— 但根路径
 * 下绿不代表子路径下绿:预缓存清单若按绝对 `/assets/…` 拼、或导航回退写死 `/`,
 * 在子路径下就是一堆 404,而这正是本仓栽过两次的那类错(「本地永远绿、只有 CI 才
 * 执行到的路径」)。
 */
{
  const subDir = mkdtempSync(join(tmpdir(), "offline-check-sub-"));
  const siteRoot = join(subDir, "xian");
  cpSync(DIST, siteRoot, { recursive: true });
  const subServer = await serve(siteRoot, "/xian/");
  const subBase = `http://127.0.0.1:${subServer.address().port}/xian/`;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p3 = await ctx.newPage();
  const errs3 = [];
  watchPageErrors(p3, errs3);
  await p3.goto(subBase, { waitUntil: "load" });
  const swScope = await p3.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.scope ?? "";
  });
  if (!swScope.endsWith("/xian/"))
    failures.push(`子路径部署下 SW 的 scope 不对(${swScope || "空"})—— 应落在 /xian/`);
  const subShell = await p3.evaluate(async (name) => {
    if (!(await caches.keys()).includes(name)) return { ok: false, paths: [] };
    const c = await caches.open(name);
    const paths = (await c.keys()).map((r) => new URL(r.url).pathname);
    return { ok: paths.includes("/xian/") || paths.includes("/xian/index.html"), paths };
  }, CACHE_VERSION);
  if (!subShell.ok)
    failures.push(
      `子路径部署下导航壳不在缓存里(找过 /xian/ 与 /xian/index.html,实际 ${subShell.paths.slice(0, 5).join("、") || "空"})`,
    );
  // 首访即断网(不刷新)—— 子路径下同样要成立
  await ctx.setOffline(true);
  await p3.reload({ waitUntil: "load" }).catch(() => {});
  await p3.waitForTimeout(1200);
  const subText = await p3.evaluate(() => document.body?.innerText || "");
  if (/离线且无缓存副本/.test(subText))
    failures.push("子路径部署下首访断网落到 503 —— 预缓存清单/回退可能按根路径拼地址");
  else if (!/启封入山/.test(subText) || subText.trim().length === 0)
    failures.push("子路径部署下首访断网应用没起来 —— /xian/ 这条入口的离线承诺没兑现");
  else pass.push("子路径部署(/xian/):首访即断网也能重开");
  if (errs3.length) failures.push(`子路径那一轮页面异常:${[...new Set(errs3)].join(" | ")}`);
  await ctx.close();
  subServer.close();
}

await browser.close();
server.close();

console.log("\n离线自检(Service Worker · localhost)");
for (const p of pass) console.log(`✓ ${p}`);
if (failures.length === 0) {
  console.log(
    "✓ 断网可重开(首访即断网也算)、旧缓存会被清、发版能接管 —— " +
      "认结果不认实现(与联网时表现一致:不发任何外部请求)",
  );
} else {
  for (const f of failures) console.log(`✗ ${f}`);
  process.exitCode = 1;
}
