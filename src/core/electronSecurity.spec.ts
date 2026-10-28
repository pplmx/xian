/**
 * Electron 壳层安全 · 锁住「零外部请求」在桌面端也成立。
 *
 * 页面自检会把浏览器里的外域请求数成 0，但 Electron 主进程另有一层能力：
 * 它既能替所有响应改写 CORS，也能放开新窗口或主框架导航。原先那套 WebDAV
 * 响应头改写早已没有调用方，却仍在全局生效；这里把 URL 判据和主进程接线
 * 同时钉住，避免安全边界只活在一句注释里。
 */
import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REMOTE_REQUEST_URL_FILTERS,
  isAppEntryUrl,
  isExternalWebUrl,
  isRemoteRequestUrl,
} from "../utils/shellUrlPolicy";

const ROOT = resolve(__dirname, "../..");
const RAW_MAIN = readFileSync(resolve(ROOT, "electron/main.js"), "utf8");
const MAIN = RAW_MAIN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const PKG = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const ENTRY = "file:///opt/%E7%8E%84%E6%9E%A2%E5%BD%95/dist/index.html";

describe("Electron 导航边界", () => {
  it("只放行同一份本地入口，hash 路由不算离开应用", () => {
    expect(isAppEntryUrl(ENTRY, ENTRY)).toBe(true);
    expect(isAppEntryUrl(`${ENTRY}#/settings`, ENTRY)).toBe(true);

    expect(isAppEntryUrl(`${ENTRY}.evil`, ENTRY)).toBe(false);
    expect(isAppEntryUrl("file:///opt/%E7%8E%84%E6%9E%A2%E5%BD%95/dist/other.html", ENTRY)).toBe(
      false,
    );
    expect(isAppEntryUrl(`${ENTRY}?from=web`, ENTRY)).toBe(false);
    expect(isAppEntryUrl("https://github.com/pplmx/xian", ENTRY)).toBe(false);
    expect(isAppEntryUrl("not a url", ENTRY)).toBe(false);
  });

  it("只有 http(s) 能交给系统浏览器，脚本与本地协议一律拒绝", () => {
    expect(isExternalWebUrl("https://github.com/pplmx/xian")).toBe(true);
    expect(isExternalWebUrl("http://example.com/help")).toBe(true);
    expect(isExternalWebUrl("javascript:alert(1)")).toBe(false);
    expect(isExternalWebUrl("file:///C:/Windows/System32/calc.exe")).toBe(false);
    expect(isExternalWebUrl("data:text/html,hello")).toBe(false);
    expect(isExternalWebUrl("mailto:test@example.com")).toBe(false);
    expect(isExternalWebUrl("not a url")).toBe(false);
  });

  it("渲染器会话把全部请求过一遍判据，本地资源照常加载", () => {
    expect(REMOTE_REQUEST_URL_FILTERS).toEqual(["<all_urls>"]);
    expect(isRemoteRequestUrl("https://example.com/ping")).toBe(true);
    expect(isRemoteRequestUrl("http://127.0.0.1/")).toBe(true);
    expect(isRemoteRequestUrl("wss://example.com/socket")).toBe(true);
    expect(isRemoteRequestUrl("ftp://example.com/file")).toBe(true);
    expect(isRemoteRequestUrl("file:///opt/xian/dist/assets/app.js")).toBe(false);
    expect(isRemoteRequestUrl("blob:file:///local-id")).toBe(false);
    expect(isRemoteRequestUrl("data:image/png;base64,AAAA")).toBe(false);
  });
});

describe("Electron 主进程接线", () => {
  it("全局 CORS 改写与认证头剥离已经退场", () => {
    expect(MAIN, "所有响应都被改写 CORS 了?").not.toContain("onHeadersReceived");
    expect(MAIN, "又给任意远端响应开了 * 源?").not.toMatch(/access-control-allow-origin/i);
    expect(MAIN, "认证挑战又被悄悄剥掉了?").not.toMatch(/www-authenticate/i);
  });

  it("渲染器显式沙箱化，Node 与同源策略都不放松", () => {
    expect(MAIN).toMatch(/nodeIntegration:\s*false/);
    expect(MAIN).toMatch(/contextIsolation:\s*true/);
    expect(MAIN).toMatch(/sandbox:\s*true/);
    expect(MAIN).toMatch(/webSecurity:\s*true/);
    expect(MAIN).toMatch(/allowRunningInsecureContent:\s*false/);
  });

  it("新窗口一律不创建；外链只经 shell.openExternal 交给系统浏览器", () => {
    expect(MAIN).toContain("setWindowOpenHandler");
    expect(MAIN).toContain("isExternalWebUrl(url)");
    expect(MAIN).toContain("shell.openExternal(url)");
    expect(MAIN).toMatch(/action:\s*"deny"/);
  });

  it("主框架不能离开本地入口，HTTP/WS 请求在会话层直接取消", () => {
    expect(MAIN).toContain('on("will-navigate"');
    expect(MAIN).toContain("isAppEntryUrl(url, appEntryUrl)");
    expect(MAIN).toContain("event.preventDefault()");
    expect(MAIN).toContain("onBeforeRequest");
    expect(MAIN).toContain("REMOTE_REQUEST_URL_FILTERS");
    expect(MAIN).toContain("isRemoteRequestUrl(details.url)");
    expect(MAIN).toContain("cancel: true");
  });

  it("零消费的 preload / IPC 桥已经退场", () => {
    expect(existsSync(resolve(ROOT, "electron/preload.js")), "没有页面调用方的桥还留着").toBe(
      false,
    );
    expect(MAIN, "主进程还在暴露无人调用的 IPC").not.toMatch(/\bipcMain\b/);
    expect(MAIN, "BrowserWindow 又重新挂 preload 了").not.toMatch(/\bpreload\s*:/);
    expect(PKG.scripts["build:electron"], "构建脚本仍在产出无人加载的 preload").not.toContain(
      "electron/preload.js",
    );
  });

  it("单实例运行：再次启动只唤回已有窗口，避免并发写同一份存档", () => {
    expect(MAIN).toMatch(
      /if\s*\(!app\.requestSingleInstanceLock\(\)\)\s*\{\s*app\.quit\(\);\s*\}\s*else\s*\{/,
    );
    expect(MAIN).toContain('app.on("second-instance"');
    expect(MAIN).toContain("win.restore()");
    expect(MAIN).toContain("win.show()");
    expect(MAIN).toContain("win.focus()");
    expect(MAIN, "关闭后指针不清，macOS 再激活会拿到已销毁窗口").toMatch(
      /win\.on\("closed",\s*\(\)\s*=>\s*\{\s*win\s*=\s*null;/,
    );
  });
});
