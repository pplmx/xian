/**
 * 玄枢录 Service Worker —— 离线缓存(见 RIL TASK-157 / DEC-033)
 *
 * 策略(对内容哈希资产绝对安全):
 *  · install 时**预缓存导航壳**(index.html + BASE_URL):离线能不能重开,只取决于
 *    这一条 —— 见下方「为什么必须在 install 里预缓存」
 *  · 导航请求(= index.html,hash 路由下所有导航都落在它身上)走 network-first:
 *    在线永远拿最新发版,离线才回退缓存 —— 发版不会卡在旧页面上
 *  · /assets/* 是 vite 内容哈希命名的产物,不同构建永不重名,故 cache-first
 *    不存在"缓存错了版本"的可能
 *  · manifest / 图标 / 音频等 public/ 稳定文件 cache-first,离线下照样出声出图
 *  · 外部跨域请求一律不干预(本站现在不发外部请求,这条是防线)
 *  · core 逻辑全部打在 web/app 窗口侧,这里只管能退化的缓存层
 *
 * 【为什么必须在 install 里预缓存】此前只有 network-first 的"顺手 put":
 * 页面被 SW 接管 ≠ 这次导航经过了它(首访尤其如此),于是「装好了、缓存里却没有
 * index.html」。玩家关掉页面再断网打开,就落到 503「离线且无缓存副本」——
 * 而 docs/deployment.md 承诺的正是「首次在线打开后,断网重开也能进游戏」。
 * 预缓存把这条承诺变成强制的、与时序无关的一步:install 不成功就不激活。
 *
 * 【发版提醒】改了需要换缓存内容的策略(如资产路径规则、导航回退行为、预缓存清单)时,
 * 务必同步 bump CACHE_VERSION —— 否则 activate 不会触发旧缓存清理,玩家
 * 离线回退仍会落到老页面。这是唯一需要人工记得的版本号,别在别处另设。
 */

/**
 * 缓存版本号 —— 改了预缓存清单 / 导航回退策略就 bump 一次。
 *
 * v2:install 里预缓存导航壳(此前只靠导航请求顺手 put,首访后断网必落 503)。
 * 老缓存里没有导航页,只有换版本号才能让 activate 把它清掉、逼着重新预缓存。
 */
const CACHE_VERSION = "xuanshu-v2";

/**
 * 这一版要预缓存的产物清单 —— 构建期由插件 `xuanshu:sw-precache-manifest`
 * (见 vite.config.ts)把 `assets/*.js|css` 的 JSON 数组填进来。
 *
 * 为什么必须是构建期注入:产物名带内容哈希,手写清单一次构建就过期。
 * 为什么是字符串而不是直接写数组字面量:开发态这个文件不经过构建(dev 也不注册
 * SW,见 main.ts),占位符原样留着也不会让脚本一加载就抛 ReferenceError ——
 * 解析失败就当作空清单。
 */
const PRECACHE_MANIFEST = "__PRECACHE_MANIFEST__";

/**
 * 解析产物清单。
 *
 * 构建期插件把占位符**连同引号**替换成 JSON 数组字面量(`["assets/…js", …]`),
 * 于是构建产物里它是一个真数组;开发态没人替换,它还是一段字符串 —— 两种形态
 * 都得认。旧写法只 `JSON.parse(PRECACHE_MANIFEST)`:构建后它已是数组,
 * `JSON.parse(array)` 先被转成 `"a,b,c"` 那样的字符串再解析失败 → 清单恒为空
 * → 首访断网仍然白屏(离线门抓到的那次)。
 */
function precacheList() {
  if (Array.isArray(PRECACHE_MANIFEST)) {
    return PRECACHE_MANIFEST.filter((v) => typeof v === "string");
  }
  if (typeof PRECACHE_MANIFEST !== "string") return [];
  try {
    const parsed = JSON.parse(PRECACHE_MANIFEST);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 导航壳的地址。`self.registration.scope` 就是 `BASE_URL`(GitHub Pages 上部署在
 * `/xian/` 子路径,根路径 `/` 会 404)—— 故**不能**写死 `/index.html`。
 */
const SHELL = [self.registration.scope, new URL("index.html", self.registration.scope).href];

/**
 * 从 index.html 里抽出它引到的同源资源(启动即要的那批 JS/CSS)。
 *
 * 为什么还留这一手:构建期清单(PRECACHE_MANIFEST)覆盖不到的情况也得能起来 ——
 * 比如清单注入失败、或将来引入不经 bundle 的 public/ 脚本。两批取并集。
 */
function assetUrlsOf(html, baseUrl) {
  const out = [];
  // src= / href= 两种写法,只认同源相对路径(./ 或 /),跳过外链与 data:
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(?:[a-z]+:|\/\/|#)/i.test(raw)) continue;
    try {
      out.push(new URL(raw, baseUrl).href);
    } catch {
      /* 解析不了的地址跳过:不是资源引用 */
    }
  }
  return [...new Set(out)];
}

/** 并发地取一批地址写进缓存;单个失败不拖垮整次安装(联网时 cache-first 会补) */
async function precacheInto(cache, urls) {
  let stored = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok && res.type === "basic") {
          await cache.put(url, res);
          stored += 1;
        }
      } catch {
        /* 这一枚没拿到:交给调用方判"够不够用" */
      }
    }),
  );
  return stored;
}

self.addEventListener("install", (event) => {
  // 先预缓存导航壳与启动要的产物,就位后立刻接管,不等旧页签全部关闭
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // 两个壳地址都存:`scope/` 与 `scope/index.html` 在静态托管上是同一份页面,
      // 但缓存键不同,离线时按哪个地址重开都得命中。
      // 逐个容错(其中一个 404 不该拖垮整次安装),但**两个都没拿到就失败** ——
      // 留着一次"装好了、缓存里却没导航页"的安装,等于把 503 存进玩家设备。
      let shellHtml = null;
      let shellStored = 0;
      for (const url of SHELL) {
        try {
          const res = await fetch(url, { cache: "reload" });
          if (res.ok && res.type === "basic") {
            const text = await res.clone().text();
            await cache.put(url, res);
            shellHtml ??= { text, url };
            shellStored += 1;
          }
        } catch {
          /* 这一枚没拿到:下面统一判"一个都没拿到" */
        }
      }
      if (shellStored === 0) throw new Error("sw: 导航壳预缓存失败,本次安装不生效(下次导航再试)");

      /**
       * 启动产物:**必须**预缓存的那一批。
       *
       * 路由是懒加载的,`WelcomeView-*.js` 这类分片根本不在 index.html 里 ——
       * 靠"解析 HTML 拿资源"拿不到它们,而首访时它们也从未经过 SW(注册发生在
       * `window.load` 之后)。于是"缓存里只有一个 HTML"成了首访常态:断网重开时
       * HTML 出来了、JS 全 404、白屏。这就是本节存在的理由。
       *
       * 范围:**JS + CSS 全部**(1.8MB JS / 128KB CSS,压缩后约 573KB)。
       * 字体(2.1MB)与音频(544KB)刻意不进:它们走 cache-first,联网逛到即补,
       * 且不影响"能不能起得来"。安装包再大一点会让首次安装明显变慢,收益不成比例。
       */
      const assets = new Set();
      if (shellHtml) for (const u of assetUrlsOf(shellHtml.text, shellHtml.url)) assets.add(u);
      for (const rel of precacheList()) {
        try {
          assets.add(new URL(rel, self.registration.scope).href);
        } catch {
          /* 清单里混进非法路径:跳过 */
        }
      }
      const assetStored = await precacheInto(cache, [...assets]);
      // 壳在、产物一件没拿到 = 离线打开必白屏。宁可这次不激活(下次导航再试),
      // 也不要把"看起来装好了、其实用不了"的缓存留在玩家设备上。
      if (assets.size > 0 && assetStored === 0) {
        throw new Error("sw: 启动产物一件都没预缓存成功,本次安装不生效(下次导航再试)");
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * 导航页的离线回退:先按原样找,找不到再退到导航壳。
 *
 * 旧版只 `cache.match(request)`:玩家用的地址可能带查询串(如 `/?from=pwa`)或
 * 是 `index.html` 而缓存里只存了另一个 —— 一模一样的页面却判"无缓存副本"。
 * 回退顺序:原请求 → 忽略查询串 → `scope/` → `scope/index.html`。
 */
async function matchShell(cache, request) {
  return (
    (await cache.match(request)) ??
    (await cache.match(request, { ignoreSearch: true })) ??
    (await cache.match(SHELL[0])) ??
    (await cache.match(SHELL[1]))
  );
}

/** 在线取最新,失败才回退缓存(导航页专用) */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") {
      await cache.put(request, fresh.clone());
      return fresh;
    }
    // 在线但拿到错误页(发版中 / 静态托管 5xx / 代理抖动):不要把它当"最新版"甩给玩家。
    // 这时离线的价值恰恰是兜住你手上那份好用的缓存 —— 回退到已缓存的 index.html。
    const cached = await matchShell(cache, request);
    return cached ?? fresh;
  } catch {
    const cached = await matchShell(cache, request);
    return cached ?? new Response("离线且无缓存副本", { status: 503 });
  }
}

/** 缓存优先,未命中才请求并落缓存(带 hash 的产物 / 稳定公共文件) */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 只管自己源上的:跨域让浏览器默认处理(本站不发外部请求,这条是防线)
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
