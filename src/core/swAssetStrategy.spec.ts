/**
 * Service Worker 的两条路由：导航 network-first，其余 cache-first。
 *
 * ## 由来（第 219 轮，查「断网仍可修行」这句承诺的边界）
 *
 * 隐私弹窗承诺「断网仍可修行」。而 `public/audio/` 下有 544KB 采样、`assets/` 下有
 * 2.1MB 字体 —— 它们**不在预缓存清单里**（`vite.config.ts` 写明这是有意的:
 * 让安装变快，真正决定「能不能起得来」的是 JS/CSS）。
 *
 * 于是「离线时有没有声音」取决于另一条路由:
 *
 * ```js
 * if (req.mode === "navigate") { event.respondWith(networkFirst(req)); return; }
 * event.respondWith(cacheFirst(req));
 * ```
 *
 * 音频、字体、图标都落到 `cacheFirst` —— **玩过一局之后再断网，它们还在缓存里**。
 * 这条设计是对的，注释也写清了（`public/sw.js` 第 11 行）。
 *
 * ## 但它没有判据
 *
 * `core/swPrecache.spec` 有 10 条判据，都在守**预缓存清单**
 * （哪些文件进、版本号怎么算、安装时怎么批量取）。而 `fetch` 这两条路由
 * **一条都没有**。
 *
 * 若有人把 `event.respondWith(cacheFirst(req))` 改成直接 `return`（「让浏览器自己处理」），
 * 离线时音频与字体会全部 404 —— 而 10 条判据都不会红。
 *
 * ## 这条判据守什么
 *
 * ① 导航走 `networkFirst`;
 * ② 其余走 `cacheFirst`（不是直接 return、也不是 network-first）;
 * ③ 跨域请求被挡在前面（那条注释写着「本站不发外部请求，这条是防线」）。
 *
 * ## 故障注入
 *
 * 把 `event.respondWith(cacheFirst(req))` 换成直接 `return` → 第三条红。
 * 删掉 `if (url.origin !== self.location.origin) return;` → 第四条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const SW = "public/sw.js";

describe("Service Worker · 两条路由", () => {
  it("判据的前提还在 —— 那个 fetch 监听与两条策略函数", () => {
    const src = stripComments(readSource(SW));
    expect(src, "找不到 fetch 监听").toContain('addEventListener("fetch"');
    expect(src, "找不到 networkFirst").toContain("function networkFirst");
    expect(src, "找不到 cacheFirst").toContain("function cacheFirst");
  });

  it("导航走 network-first —— 新页面优先，断网才落缓存", () => {
    const src = stripComments(readSource(SW));
    const at = src.indexOf('addEventListener("fetch"');
    expect(at, "找不到 fetch 监听").toBeGreaterThan(-1);
    const end = src.indexOf("});", at);
    const body = src.slice(at, end);
    expect(
      /mode\s*===\s*"navigate"[\s\S]{0,120}?networkFirst\(/.test(body),
      "导航请求没有走 networkFirst —— 玩家断网重开会一直看到旧页面",
    ).toBe(true);
  });

  it("其余走 cache-first —— 音频与字体离线要靠它", () => {
    const src = stripComments(readSource(SW));
    const at = src.indexOf('addEventListener("fetch"');
    const end = src.indexOf("});", at);
    const body = src.slice(at, end);
    expect(
      /respondWith\(cacheFirst\(/.test(body),
      "非导航请求没有走 cacheFirst —— 而 544KB 音频与 2.1MB 字体**不在预缓存清单里**" +
        "（那是有意的取舍，见 vite.config 与 sw.js 的注释），它们离线能不能用全靠这一条。" +
        "把这里改成直接 return，离线时音频与字体会全部 404，而 swPrecache 那 10 条判据都不会红",
    ).toBe(true);
  });

  it("跨域请求被挡在前面 —— 「本站不发外部请求」的最后一道", () => {
    const src = stripComments(readSource(SW));
    const at = src.indexOf('addEventListener("fetch"');
    const end = src.indexOf("});", at);
    const body = src.slice(at, end);
    expect(
      /origin\s*!==\s*self\.location\.origin[\s\S]{0,80}?return/.test(body),
      "fetch 没有挡跨域 —— 它该是「本站不发外部请求」的最后一道防线",
    ).toBe(true);
  });
});
