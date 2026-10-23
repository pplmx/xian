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
});
