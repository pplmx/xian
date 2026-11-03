/**
 * 单写者 —— 同一份存档只允许一个页面往里写。
 *
 * 由来:全仓此前没有任何多标签协调。两个页面各自 `engine.start()`,各自按
 * `SAVE_FLUSH_MS` 把同一批 `xuanshu.*` 分片写回 localStorage —— 后落盘的覆盖先落盘的。
 * 典型场景:桌面浏览器又开了一个标签页、Electron 双击启动出两个窗、PWA 与浏览器页并存。
 * 闲置那一页的心跳照跑,每几秒把**它自己的旧状态**盖回前台那页的进度,双方都没有提示。
 *
 * 判据用 Web Locks(`navigator.locks`):浏览器在页面卸载/崩溃时自动释放,不存在
 * 需要清理的残留锁。规则只有一条 —— **先到的那页是写者,后来的只读**:
 *   · 写者持有锁直到页面卸载,心跳、落盘、导入导出都照常;
 *   · 第二页拿到 null 就立刻交还(不排队),把自己标成 `saveReader`,由启动流程
 *     跳过引擎、在存储层拦掉写入,并告诉玩家「已在另一处打开」。
 *
 * 为什么不做「写者走了就自动接管」:接管页手里是打开那一刻的旧状态,直接开写会把
 * 写者最后保存的进度盖掉。要接管必须先重载成最新档,那是一条独立的交互决策,
 * 留给玩家重开页面即可 —— 只读提示里会说清楚。
 *
 * 老内核没有 LockManager 时**保持原状**(fail-open):退回「谁写谁覆盖」,而不是
 * 让游戏起不来。这里只降级一个已存在的问题,不引入新的启动失败点。
 */
import { ref } from "vue";
import { blockSaveWrites } from "@/utils/storage";

/** 本页是不是只读的后来者 —— 启动流程据此跳过引擎与写盘 */
export const saveReader = ref(false);

/** 锁名:一个字符串域,与存档前缀同源,便于在 DevTools 里认出来 */
export const SAVE_WRITER_LOCK = "xuanshu.save-writer";

/** 只用到 request / query 两个方法;抽出来是为了在用例里换掉实现 */
export type LockLike = {
  request: (
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
  query?: () => Promise<{ held?: { name?: string }[]; pending?: { name?: string }[] }>;
};

/** 探测超时:拿不到结论时按写者处理(fail-open),不让启动卡在锁上 */
const PROBE_TIMEOUT_MS = 500;

function defaultLocks(): LockLike | undefined {
  try {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    return locks && typeof locks.request === "function"
      ? (locks as unknown as LockLike)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 认领写者席位。返回 true 表示本页可以写档;false 表示已有页面在写,本页只读。
 *
 * 调用点必须在**任何存档写入之前**(main.ts 的启动序列最前面):preflightScan /
 * prepareLocalSave 都会改盘,只读页不该跑它。
 */
export async function acquireSaveWriterRole(locks = defaultLocks()): Promise<boolean> {
  if (!locks) {
    // 没有 Web Locks:维持「谁写谁覆盖」的旧行为,不把玩家挡在门外
    saveReader.value = false;
    return true;
  }

  let settle: (writer: boolean) => void = () => undefined;
  const probed = new Promise<boolean>((resolve) => {
    settle = resolve;
  });

  void locks.request(SAVE_WRITER_LOCK, { ifAvailable: true }, (lock) => {
    const got = lock !== null && lock !== undefined;
    if (got) {
      settle(true);
      // 拿到就持有到页面卸载(浏览器负责释放),回调永不 resolve
      return new Promise<void>(() => undefined);
    }
    /*
     * 拿不到:这一页永远只读 —— 但**已经答过「可写」时还要把它改回来**。
     *
     * 超时那条路会在 500ms 后按 fail-open 答 true,而浏览器完全可能更晚才
     * 回这个回调(锁服务被别的页面占着、主线程忙)。若这里只是 settle(false),
     * 那个 promise 早已被 race 丢掉,没有人会再看 —— 本页于是带着「我是写者」
     * 的身份去跑 prepareLocalSave 与心跳,两个页面各写各的,后写的盖掉先写的。
     *
     * 故这里直接把结论改回只读,并封住后续写入(与 main.ts 在启动序列里
     * 走的那条只读路径同一个收尾)。
     */
    settle(false);
    if (!saveReader.value) {
      saveReader.value = true;
      blockSaveWrites();
    }
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), PROBE_TIMEOUT_MS);
  });
  const writer = await Promise.race([probed, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  /*
   * 结论只在两条路里二选一,不再有第三条修修补补的分支:
   *   · 回调先到 → writer 就是它给的结论(拿到 true / 没拿到 false);
   *   · 超时先到 → writer 是 fail-open 的 true,而 saveReader 保持 false。
   * 回调**晚于**超时的情况由上面那个 got=false 分支兜住(它会自己把本页翻成
   * 只读并封写)—— 那才是这条判据真正要防的竞态。
   */
  saveReader.value = !writer;
  return writer;
}

/**
 * 写者席位是不是已经空出来了(另一处关掉了)。
 *
 * 只给界面用:只读页据此把提示从「已在另一处打开」换成「另一处已关闭,刷新即可继续」。
 * 回答不了的时候一律答 `false` —— 宁可不提示,也不要让玩家以为刷新就能写、刷新完还是只读。
 */
export async function saveWriterFree(locks = defaultLocks()): Promise<boolean> {
  if (!locks || typeof locks.query !== "function") return false;
  try {
    const state = await locks.query();
    const live = [...(state.held ?? []), ...(state.pending ?? [])];
    return !live.some((l) => l.name === SAVE_WRITER_LOCK);
  } catch {
    return false;
  }
}
