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

  it("开发者工具只在未打包时挂 —— 装好的客户端里按 F12 就能改存档", () => {
    /*
     * `createAppMenu` 原先把「开发」子菜单**无条件**挂上,里面是:
     *   · 开发者工具(F12) —— 翻源码、改 localStorage 里的存档,窗口关掉什么都不留
     *   · 重新加载(Ctrl+R) —— 中途 reload 会丢掉尚未落盘的心跳数据
     *
     * 而沙箱那几项(`nodeIntegration: false` / `contextIsolation` / `sandbox`)是
     * 为了把边界收紧的 —— 一个 F12 就绕过去了,等于白设。
     *
     * 判据:那两项必须被 `if (!app.isPackaged)` 包住。用 isPackaged 而不是 NODE_ENV,
     * 因为前者由 Electron 按「是否在 asar / 安装目录里」判定,打包器改不了。
     */
    expect(MAIN, "开发者工具必须在 if (!app.isPackaged) 里").toMatch(
      /if\s*\(\s*!app\.isPackaged\s*\)\s*\{[\s\S]*?toggleDevTools\(\)[\s\S]*?\}/,
    );
    expect(MAIN, "重新加载同样只在未打包时可用").toMatch(
      /if\s*\(\s*!app\.isPackaged\s*\)\s*\{[\s\S]*?webContents\.reload\(\)/,
    );
    // 防空转:确认这两项子菜单真的还在(别哪天整段删了,判据还以为自己守住了东西)
    expect(MAIN, "「开发」菜单不见了 —— 这条判据在守个不存在的东西").toContain('label: "开发"');
  });

  it("配置落盘是原子的 —— 先写 .tmp 再 rename，不直接覆盖", () => {
    /*
     * `saveSettings` 原本直接 `writeFileSync(settingsPath, …)` 覆盖。
     * 覆盖写**不是原子**的:写到一半进程被杀(断电 / 强杀 / 崩),settings.json
     * 就留下半截 JSON;而 `loadSettings` 的 catch 会把它当成读不出来、
     * 静默退回默认值 —— 玩家的两个开关悄悄复位,没有任何提示。
     *
     * rename 在同一文件系统上是原子的:要么旧文件,要么完整的新文件,
     * 没有"半个文件"的中间态。临时文件必须与目标**同目录**才保证同一文件系统。
     */
    expect(MAIN, "配置写入先落到 .tmp").toMatch(/writeFileSync\(tmp,/);
    expect(MAIN, "再把 .tmp rename 到正式文件（同一文件系统上原子）").toMatch(
      /renameSync\(tmp,\s*settingsPath\)/,
    );
    expect(MAIN, "临时文件与目标同目录，否则 rename 可能跨文件系统").toMatch(
      /const tmp = `\$\{settingsPath\}\.tmp`/,
    );
    expect(MAIN, "写入失败要清掉半截临时文件").toMatch(/unlinkSync\(tmp\)/);
    // 防空转:这两个变量名真的在代码里(而不是被注释掉后剩下的字符串)
    expect(MAIN).toContain("const tmp =");
  });
});
