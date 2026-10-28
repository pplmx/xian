import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { Capacitor } from "@capacitor/core";
import App from "./App.vue";
import { router } from "./router";
import { blockSaveWrites, migrateLocalSchema, preflightScan } from "./utils/storage";
import { acquireSaveWriterRole } from "./core/singleWriter";
import { recordRuntimeDiagnostic, summarizeError } from "./core/diagnostics";
import { useUiStore } from "./stores/ui";
import { useDiagStore } from "./stores/diag";
import "./style.css";

/**
 * 单写者判定放在**所有存档写入之前**:下面的扫描与结构升级都会改盘。
 *
 * 同一份存档同时只该有一个写者 —— 两个页面各自跑心跳、各自节流落盘,后写的那份
 * 会把另一页的进度盖回去(判据与取舍见 core/singleWriter 的文件头)。
 * 后来的页面在这里就被切成只读:不扫描、不迁移、不写盘,界面上给一句明白话。
 */
const isSaveWriter = await acquireSaveWriterRole();
if (!isSaveWriter) blockSaveWrites();

// 启动前扫描损坏存档 + 结构升级,避免白屏(只读页不碰盘,连修复也不做)
const corrupted = isSaveWriter ? preflightScan() : [];
if (isSaveWriter) migrateLocalSchema();

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);
// 先建诊断 store，让它接上 core 的运行期异常端口；引擎随后才在 App 里启动。
useDiagStore();

/**
 * 异常留档 —— 诊断本身不许再抛,故整段包在 try 里。
 *
 * 从前这里只打一行 console.error 再 toast「出现异常,已记录」:手机上根本没有控制台,
 * 那句「已记录」是空话,玩家报问题时我们手上什么都没有。
 */
function noteError(info: string, err: unknown): void {
  recordRuntimeDiagnostic({ info, message: summarizeError(err), route: location.hash });
}

app.config.errorHandler = (err, _instance, info) => {
  console.error("[全局异常]", info, err);
  noteError(String(info), err);
  try {
    useUiStore().toast("出现异常,已记入留档(设置页可查)", "warn");
  } catch {
    // UI 尚未就绪时静默
  }
};

// 未处理的 Promise 拒绝从前完全静默:连 toast 都没有,玩家只会觉得「点了没反应」
window.addEventListener("unhandledrejection", (event) => {
  console.error("[未处理的 Promise]", event.reason);
  noteError("unhandledrejection", event.reason);
});

app.mount("#app");

if (corrupted.length > 0) {
  useUiStore().corruptedNotice = corrupted;
  useUiStore().toast("检测到部分存档数据异常,已跳过损坏内容,原档保留在本机", "warn");
}

// PWA 离线缓存:只在生产构建、且只在**真正的网页部署**上注册。
// dev 下 SW 会缓存 HMR 产物、干扰热重载;而 Electron(file://)与 Capacitor(https://localhost)
// 本身就是本地文件,离线缓存毫无意义,反而致命:SW 接管导航后 fetch() 这类本地 URL 会失败,
// 缓存又没有副本,于是第二次启动起就只剩「离线且无缓存副本」—— Windows 版白屏、
// 安卓版卡在加载遮罩(玩家反馈)。第一次启动总是好的,因为那次 SW 还没接管,最会误导排查。
// 注册失败静默 —— 有 SW 是增强(断网可重开),没有也不影响在线游玩。
const isLocalShell = location.protocol === "file:" || Capacitor.isNativePlatform();
if (import.meta.env.PROD && !isLocalShell && "serviceWorker" in navigator) {
  const registerSw = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 注册失败不打扰玩家:功能可降级,见 public/sw.js 注释 */
    });
  };
  /*
   * 不能只挂 load 监听。入口模块里有顶层 await(单写者判定),模块可能在 load
   * **之后**才执行完 —— 那一句监听器永远等不到,表现是 SW 从不注册、离线能力
   * 静默消失(offline-check 的 `serviceWorker.ready` 会一直挂着,一等两分半)。
   * 已经 complete 就直接注册,否则再挂一次性的监听。
   */
  if (document.readyState === "complete") registerSw();
  else window.addEventListener("load", registerSw, { once: true });
}
