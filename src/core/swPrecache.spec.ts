/**
 * Service Worker 预缓存契约 —— 「首访后断网还能重开」靠什么兑现
 *
 * 由来(真事故,offline-check 抓到):首访的玩家 —— 第一次打开、玩一会儿、关掉标签页、
 * 地铁里再打开 —— 会看到浏览器默认的断网页(或 SW 的 503 兜底页)。根因有三层,
 * 每一层单独看都"没毛病":
 *
 *   ① SW 在 `window.load` 之后才注册(props 见 main.ts),于是**第一次导航**与
 *      整棵模块图都没经过它 —— cache-first 一条都没落下;
 *   ② 路由是懒加载的,`WelcomeView-*.js` 这类分片**不在 index.html 里**,
 *      "安装时解析 HTML 拿资源"拿不到它们;
 *   ③ 旧的判据只数缓存条数(`>= 3`),而首访时静态产物早就落了十几条 ——
 *      唯一缺的偏偏是决定生死的 index.html。判据绿着,玩家白屏。
 *
 * 现在 sw.js 在 install 里:预缓存导航壳 + 由构建期插件注入的 JS/CSS 清单,
 * 并**拿不到就不激活**(宁可下次导航再试,也不把半吊子缓存留在玩家设备上)。
 * 这条判据钉住这三件事的源码形态 —— 它们一旦被"简化"掉,离线门要跑五分钟才发现。
 *
 * 为什么不直接跑 offline-check:那要构建 + chromium,一轮数分钟,进不了 pre-commit。
 * 这里量的是**策略是否还在**(静态可数);真实浏览器行为由 offline-check 兜底。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(__dirname, "../..");
const SW = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");
const VITE = readFileSync(resolve(ROOT, "vite.config.ts"), "utf8");
const OFFLINE = readFileSync(resolve(ROOT, "scripts/offline-check.mjs"), "utf8");

describe("Service Worker · 首访即断网也要能重开", () => {
  it("install 里有预缓存动作 —— 不是只在 fetch 时顺手 put", () => {
    // 顺手 put 的前提是"这次导航经过了 SW",而首访恰恰不经过。
    // 判据:install 监听器里必须出现 cache.put / precacheInto(而不是只 skipWaiting)。
    const install = /addEventListener\(\s*["']install["'][\s\S]*?\n\}\);/.exec(SW)?.[0] ?? "";
    expect(install, "sw.js 里找不到 install 监听器").toBeTruthy();
    expect(
      /cache\.put\s*\(|precacheInto\s*\(/.test(install),
      "install 必须预缓存导航壳与启动产物 —— 只 skipWaiting 的话首访断网必白屏",
    ).toBe(true);
  });

  it("预缓存清单由构建期注入 —— 手写哈希清单必然过期", () => {
    // 产物名带内容哈希,任何硬编码的 assets/xxx-<hash>.js 下一次构建就是 404。
    expect(SW, "sw.js 要保留清单占位符").toContain("__PRECACHE_MANIFEST__");
    // 两种形态都要认:构建后是真数组,开发态是字符串(见 precacheList 的注释)
    expect(SW, "构建后清单已是数组,JSON.parse(数组) 会恒空").toMatch(
      /Array\.isArray\(\s*PRECACHE_MANIFEST\s*\)/,
    );
    // 插件必须在构建期把 assets/*.js|css 填进去
    expect(VITE, "vite.config 要注册 xuanshu:sw-precache-manifest 插件").toContain(
      "xuanshu:sw-precache-manifest",
    );
    expect(VITE, "清单范围是 assets 下的 js/css").toMatch(/assets\\\/\.\*\\\.\(\?:js\|css\)/);
    // 替换必须连引号一起换 —— 只换内层会拼出 "["assets/…"]" 这种非法 JS
    expect(VITE, "占位符要连引号一起替换").toContain(`'"__PRECACHE_MANIFEST__"'`);
  });

  it("壳拿不到就不激活 —— 不把半吊子缓存留在玩家设备上", () => {
    // 装好了却发现缓存里没导航页,是最坏的一种"看起来成功":
    // 玩家此后每次断网都落 503,而 SW 已接管,连联网重试都轮不到。
    expect(SW, "两个壳地址都失败时要 throw").toMatch(
      /shellStored === 0\)\s*throw|if\s*\(stored === 0\)\s*throw/,
    );
    expect(SW, "启动产物一件没拿到时也要 throw").toMatch(/assetStored === 0\)\s*\{?\s*throw/);
  });

  it("导航回退认壳,不认某一个地址 —— 带查询串/换写法也得命中", () => {
    // 旧实现只 cache.match(request):`/?from=pwa` 或 `index.html` 与缓存键不同,
    // 同一个页面被判"无缓存副本"。回退链要一路退到导航壳。
    expect(SW).toContain("matchShell");
    expect(SW).toContain("ignoreSearch: true");
    // 壳地址来自 registration.scope —— GitHub Pages 部署在子路径,写死 / 必 404
    expect(SW, "壳地址要按 scope 拼,不能写死根路径").toMatch(
      /self\.registration\.scope[\s\S]{0,120}index\.html/,
    );
  });

  it("离线门量的是首访路径,不是「刷新过好几次」的页面", () => {
    // 刷新会把这次导航喂给 SW,缓存顺带被填满 —— 那是事故里不存在的步骤。
    expect(OFFLINE, "要有独立 context 的首访断网一节").toContain("首访即断网");
    expect(OFFLINE, "首访那一轮不许刷新").toMatch(/不刷新/);
    // 判据认导航壳在不在缓存里,不认条数(条数是会骗人的代理指标)
    expect(OFFLINE, "要有「导航壳已进缓存」这条判据").toContain("导航壳已进缓存");
  });

  it("子路径部署也要量 —— Pages 在 /xian/,根路径绿不等于它绿", () => {
    // 部署矩阵里两条网页入口:Cloudflare 在站点根,Pages 在 /xian/ 子路径。
    // 本仓栽过两次「本地永远绿、只有 CI 才执行到的路径」,而子路径恰恰是那种：
    // 预缓存清单若按绝对 /assets/… 拼、导航回退写死 /,在 /xian/ 下就是一堆 404。
    expect(OFFLINE, "offline-check 要覆盖子路径").toContain("子路径部署");
    expect(OFFLINE, "子路径那节要断网并认入口").toMatch(/\/xian\//);
    // SW 侧:壳地址必须从 registration.scope 推(scope 就是 BASE_URL 解析后的前缀)
    expect(SW).toMatch(/self\.registration\.scope/);
  });
});

/**
 * 缓存版本号必须**随产物变化**,不能靠人记得改。
 *
 * 原先 public/sw.js 里是手写的 `CACHE_VERSION = "xuanshu-v2"`,注释写着
 * 「改了预缓存清单/导航回退就 bump 一次」—— 而发版流程里没有任何一步提醒它。
 * 忘 bump 的后果不是"缓存旧一点":activate 不清理旧分片,玩家的离线回退
 * 会一直落到老页面,他们看到的是"更新了但没变"。
 *
 * 现在是「前缀手写 + 后缀由构建期按产物清单派生」:
 * 内容变了版本必变,内容没变就不白清一次缓存。下面三条钉住这套机制。
 */
describe("缓存版本 · 由产物派生,不靠人记得", () => {
  const SW_SRC = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");
  const VITE = readFileSync(resolve(ROOT, "vite.config.ts"), "utf8");

  it("源码里留占位符,后缀由插件填 —— 手写整串就退回了人肉记忆", () => {
    // 源码必须含占位符:若哪天有人把它"改回可读的 v3",派生机制就悄悄失效了
    expect(SW_SRC, "sw.js 的 CACHE_VERSION 必须留 __CACHE_VERSION_SUFFIX__ 占位").toContain(
      "__CACHE_VERSION_SUFFIX__",
    );
    // 插件必须真的替换它
    expect(VITE, "构建插件没替换版本占位符").toContain("__CACHE_VERSION_SUFFIX__");
    // 而且要用全量替换:注释里也写了这个占位符,replace 只换第一处就会写错地方
    expect(
      VITE,
      "必须用 replaceAll —— 注释里也有同一个占位符,replace(字符串) 只换第一处",
    ).toContain('replaceAll("__CACHE_VERSION_SUFFIX__", stamp)');
    expect(VITE, "清单注入同样是全量替换").toContain(
      "replaceAll('\"__PRECACHE_MANIFEST__\"', json)",
    );
  });

  it("离线门从构建产物读版本,不从源码读 —— 否则拿到的是带占位符的那串", () => {
    const CHECK = readFileSync(resolve(ROOT, "scripts/offline-check.mjs"), "utf8");
    expect(
      CHECK,
      "offline-check 读的是 dist/sw.js(玩家真正加载的那份),不是 public/sw.js",
    ).toContain('join(ROOT, "dist/sw.js")');
    expect(CHECK, "还从源码读版本 —— 断言会与浏览器里建起来的对不上").not.toContain(
      'join(ROOT, "public/sw.js")',
    );
    // 占位符没被替换时要当场说清楚,别等到断言"缓存分片已建立"假红
    expect(CHECK, "占位符残留要单独报错").toContain("__CACHE_VERSION_SUFFIX__");
  });

  it("版本后缀源自产物清单短哈希 —— 内容变则版本变", () => {
    // 判据不重跑构建(那要十几秒),只钉住派生方式:哈希输入必须是 cream 清单本身
    expect(VITE, "哈希要基于产物清单").toContain("files.join(");
    expect(VITE, "要有 FNV 派生").toContain("0x01000193");
    expect(VITE, "后缀要拼进版本").toContain("toString(36)");
    // 实测留档(写在这里,免得下次又要重新验一遍):
    //   同内容两次构建 → xuanshu-v2-0c60xtc(相同)
    //   改一行界面文案 → xuanshu-v2-0f36199(变了)
  });
});
