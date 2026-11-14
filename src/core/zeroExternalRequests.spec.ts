/**
 * 「不发任何外部请求」这句承诺，该有一条判据在构建产物上核它。
 *
 * ## 由来（第 200 轮，接着上一轮「没有判据守着的承诺」查）
 *
 * 隐私弹窗里写着:
 *
 * ```text
 * 游戏玩法完全在本机运行,不与任何服务器通信,存档不上传。
 * 页面不加载任何外部脚本、不发任何外部请求。
 * ```
 *
 * 这是一条**可机械验证**的强承诺 —— 它不在注释里，不在设计文档里，
 * 而是对一个真实玩家说的。而它此前的判据只有两条:
 *
 * ```text
 * core/swRegistration.spec    守 Service Worker 的注册条件（Electron / Capacitor 不接管）
 * core/electronSecurity.spec  守 Electron 那一侧的请求白名单
 * ```
 *
 * 两条都只管**壳**，没有一条核 **web 版构建产物本身**。而承诺是对所有平台说的。
 *
 * ## 这条判据守什么
 *
 * 在 `dist/` 的 JS 产物里扫 `fetch(` / `XMLHttpRequest` / `sendBeacon` /
 * `new WebSocket` 的目标是不是站外地址。允许的:
 *
 * ```text
 * 相对路径 / 同源           `fetch("/api/x")` —— 本仓没有,但形状上不算外域
 * data: / blob:             本地数据
 * 注释与文档链接            `href="https://github.com/…"` 不是请求
 * ```
 *
 * 不允许的:任何 `fetch("https://…")` 这种**把请求发到站外**的写法。
 *
 * ## 前提:得先有构建产物
 *
 * 没有 `dist/` 时这条判据**跳过并明确说明** —— 不静默通过。
 * `bun run build` 之后它才真正生效。
 *
 * ## 故障注入
 *
 * 往 `src/main.ts` 末尾加 `fetch("https://telemetry.example.com/x")` →
 * 前两条同时红（一条说「有网络调用」，一条说「有站外主机」）。
 * 加 `new WebSocket("wss://evil.example.com/x")` → 第一条红（认得出 WebSocket）。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/**
 * 源码里真的会发请求的地方（`fetch(` / `sendBeacon(` / `new WebSocket(` / `XMLHttpRequest`）。
 *
 * 注释里提到这些词不算 —— 本仓 `main.ts` 就有整整一段注释在说
 * 「SW 接管导航后 fetch() 会失败」，那是在解释为什么**不**注册。
 */
function networkCalls(src: string): { file: string; kind: string; line: string }[] {
  const out: { file: string; kind: string; line: string }[] = [];
  for (const line of src.split("\n")) {
    for (const m of line.matchAll(
      /\b(fetch|sendBeacon)\s*\(|new\s+(WebSocket|EventSource)\s*\(|XMLHttpRequest\s*\(/g,
    )) {
      out.push({
        file: "",
        kind: m[1] ?? m[2] ?? "XMLHttpRequest",
        line: line.trim().slice(0, 90),
      });
    }
  }
  return out;
}

describe("零外域请求 · 在源码上核（不依赖构建产物）", () => {
  it("全程只有一处网络调用，而且它是注册 Service Worker（同源）", () => {
    /*
     * ## 为什么改成扫源码，而不是扫 dist
     *
     * 第一版扫 `dist/assets/*.js`。而 `verify` 的顺序是:
     *
     * ```text
     * clean-dist  →  check  →  test  →  test:report  →  vp build  →  …
     * ```
     *
     * **跑 test 时 dist 刚被清空** —— 那条判据在 verify 链路里永远走「没有产物，跳过」，
     * 什么都没核。写完当天做故障注入才发现（往产物里塞一个 fetch 能红，
     * 但那是因为我手动 build 过；verify 里根本没有产物）。
     *
     * 源码扫法不依赖构建顺序，且覆盖更直接:构建产物是从源码来的。
     *
     * ## 那一处为什么允许
     *
     * `main.ts` 里 `navigator.serviceWorker.register(BASE_URL + "sw.js")` —— 同源文件，
     * 不是外域请求。它在 PWA 里是**离线可用**的前提（见 `core/swRegistration.spec`）。
     */
    const calls: { file: string; kind: string; line: string }[] = [];
    let scanned = 0;
    for (const f of walkFiles("src", isSourceFile)) {
      scanned += 1;
      const src = stripComments(readSource(f));
      for (const c of networkCalls(src))
        calls.push({ ...c, file: f.replace(/^.*\/src\//, "src/") });
    }
    expect(scanned, "一个源文件都没扫到 —— 判据空转").toBeGreaterThan(100);

    const nonSw = calls.filter((c) => !/serviceWorker\.register/.test(c.line));
    expect(
      nonSw,
      "隐私弹窗写着「不发任何外部请求」，而源码里有这些网络调用:" +
        nonSw.map((c) => `${c.file} ${c.kind}: ${c.line}`).join(" / "),
    ).toEqual([]);
  });

  it("源码里没有任何写死的外部主机", () => {
    /*
     * 判那件事:源码不许把一个站外主机写成请求目标。
     *
     * 允许的形态:
     *   · 文档链接（`href="https://github.com/…"`）—— 那是给人点的，不是程序发的
     *   · 注释（已剥）
     *   · `www.w3.org` 这类 XML 命名空间（`createElementNS`），它不产生任何请求
     */
    const bad: string[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      for (const m of src.matchAll(
        /(?:fetch|sendBeacon|new\s+WebSocket|new\s+EventSource)\s*\(\s*["'`]((?:https?:)?\/\/[^"'`]{4,120})["'`]/g,
      )) {
        bad.push(`${f.replace(/^.*\/src\//, "src/")}: ${m[1]}`);
      }
    }
    expect(bad, "有请求直接打到站外地址:" + bad.join(" / ")).toEqual([]);
  });

  it("判据自己认得出网络调用（地基）", () => {
    expect(networkCalls('fetch("/api/x");').length, "认不出 fetch").toBe(1);
    expect(networkCalls("navigator.sendBeacon(u, d);").length, "认不出 sendBeacon").toBe(1);
    expect(networkCalls("new WebSocket(u);").length, "认不出 WebSocket").toBe(1);
    expect(networkCalls("new XMLHttpRequest();").length, "认不出 XMLHttpRequest").toBe(1);
    // 普通函数名不该误伤
    expect(networkCalls("prefetch(x); // softFetch(").length, "把 prefetch 当成了 fetch").toBe(0);
  });
});
