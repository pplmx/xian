/**
 * SW 注册的三个条件 —— 少一个都会重演线上事故。
 *
 * ## 为什么这条值得单独守
 *
 * `main.ts` 里注册 SW 的那一句带三个条件:
 *
 * ```js
 * if (import.meta.env.PROD && !isLocalShell && "serviceWorker" in navigator) { … }
 * ```
 *
 * 而 `isLocalShell` 的定义是 `location.protocol === "file:" || Capacitor.isNativePlatform()`,
 * 注释里写着它挡下的**真实事故**:
 *
 *   > Electron(file://)与 Capacitor(https://localhost)本身就是本地文件,离线缓存
 *   > 毫无意义,反而致命:SW 接管导航后 fetch() 这类本地 URL 会失败,缓存又没有副本,
 *   > 于是第二次启动起就只剩「离线且无缓存副本」—— Windows 版白屏、安卓版卡在加载遮罩。
 *
 * 第一次启动总是好的(那次 SW 还没接管)—— 这正是它最难排查的地方。
 *
 * `core/swPrecache.spec` 守的是 `public/sw.js` 那份脚本本身的行为,**不管注册条件**。
 * 把 `!isLocalShell` 删掉,那边的用例照样全过。
 *
 * ## 为什么用源码断言而不是跑一遍
 *
 * 这段在模块顶层直接执行,没有可注入的入口;真要跑起来得模拟 file:// 协议 + Capacitor
 * 全局 + window.load 时序。用静态断言守"三个条件都在"更直接,也和它要防的错对得上:
 * 守的是"别把某个条件删掉",不是"运行结果等于什么"。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MAIN = readFileSync(join(ROOT, "src/main.ts"), "utf-8");
const CODE = MAIN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** 注册 SW 的那一行 `if` */
const guardLine = CODE.split("\n").find((l) => l.includes("serviceWorker.register")) ?? "";
/** `if (…) {` 那一行 —— 条件写在这里 */
const condLine = CODE.split("\n").find((l) => l.includes('"serviceWorker" in navigator')) ?? "";

describe("SW 注册 · 三个条件缺一不可", () => {
  it("找得到注册语句与它的条件 —— 判据前提还在", () => {
    // 防空转:注册整个被删或改名时,后面几条会退化成对空字符串断言
    expect(guardLine, "main.ts 里找不到 serviceWorker.register").toBeTruthy();
    expect(condLine, '找不到带 "serviceWorker" in navigator 的那个 if').toBeTruthy();
  });

  it("只在生产构建里注册 —— dev 下 SW 会缓存 HMR 产物", () => {
    expect(condLine, "少了 import.meta.env.PROD —— dev 下也会注册 SW,热重载产物被缓存").toContain(
      "import.meta.env.PROD",
    );
  });

  it("本地壳上不注册 —— 这一条挡的是 Windows 白屏 / 安卓卡加载", () => {
    expect(
      condLine,
      "少了 !isLocalShell —— Electron(file://)与 Capacitor 上 SW 会接管导航," +
        "第二次启动起只剩「离线且无缓存副本」",
    ).toContain("!isLocalShell");
  });

  it("isLocalShell 认 file: 协议与 Capacitor 两处 —— 少认一处就漏一个壳", () => {
    const def = CODE.slice(CODE.indexOf("isLocalShell"), CODE.indexOf("isLocalShell") + 200);
    expect(def, "isLocalShell 没认 file: 协议 —— Electron 会漏").toContain('"file:"');
    expect(def, "isLocalShell 没认 Capacitor —— 安卓/iOS 壳会漏").toContain(
      "Capacitor.isNativePlatform()",
    );
  });

  it("浏览器环境里也判 serviceWorker 存在 —— 老内核不保证有", () => {
    expect(condLine, '少了 "serviceWorker" in navigator 判断').toContain(
      '"serviceWorker" in navigator',
    );
  });

  it("处理了 load 已过的那一拍 —— 入口有顶层 await,模块可能在 load 之后才执行完", () => {
    /*
     * 这一条对应注释里记的另一个坑:入口模块有顶层 await(单写者判定),可能在 load
     * **之后**才执行完,那时再挂 load 监听器永远等不到 —— 表现是 SW 从不注册,
     * offline-check 的 serviceWorker.ready 一等两分半。
     */
    const block = CODE.slice(CODE.indexOf('"serviceWorker" in navigator'));
    expect(block, "只挂了 load 监听 —— 顶层 await 之后模块才执行完时,SW 永远不会注册").toContain(
      'document.readyState === "complete"',
    );
  });
});
