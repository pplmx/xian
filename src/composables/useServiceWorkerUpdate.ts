/**
 * Service Worker 新版本检测 —— 发现「旧版在跑、新版本已就绪」时,把应用权交还调用方。
 *
 * 本作 public/sw.js 已带 install 即 skipWaiting + activate 即 clientsClaim;这里只做两件事:
 *   · 监听 `registration.updatefound` → `installing.statechange`,在**更新**(非首次安装)
 *     就绪时触发 onUpdate —— 弹不弹「重载」交给调用方;
 *   · 暴露 `reload()`:向等待中的 SW 补一次 SKIP_WAITING 通知后 `location.reload()`。
 *
 * 为什么认 `navigator.serviceWorker.controller`:页面由 SW 接管(即至少跑过一次 SW)后它
 * 才非空。「首次安装」时它为空 —— 玩家看到的本就是最新版,不该弹「重新加载」;只有
 * 旧版在跑、新脚本装上,才算一次真正的更新提示。
 *
 * ## 为什么还要认「这一版我是不是已经处理过」
 *
 * 「页面由 SW 接管」只说明**装过**一个 worker,不说明装上的这个**比正在跑的那个新**。
 * 线上发版靠 CDN 分发,边缘是最终一致的:同一时刻不同边缘可能还各有新旧两份 sw.js。
 * 于是浏览器这边的 `update()` 会在两个版本之间来回翻 —— v3 → v2 → v3 ——
 * 每一次翻动都让一个"新"worker 装到 installed,按老口径每次都算一次「有新版」。
 *
 * 玩家看到的就是**点了刷新,过一会又弹**,而且刷多少次都停不下来(实测:
 * CDN 两边缘交替时逐轮提示 `- 弹 弹 弹 弹 弹 弹 弹`,永不收敛)。
 *
 * 两个闸一起收:
 *   一 **比版本**:新 worker 自报的版本(见重写下方 `versionOf`)不比正在跑的那份新,
 *      就不提示。翻回旧版时 `versionOf(installing) < versionOf(controller)`,直接放过;
 *   二 **记账**:提示过一次的那一版记在本机(localStorage),同一版不再提示第二次。
 *      这一条挡的是「版本号相同但字节不同」——比如两个边缘各自构建出的同一发版。
 *
 * 版本号怎么拿到:SW 脚本每次 `activate` 后能读到自己的 `CACHE_VERSION`,但页面侧读不到
 * 另一个 worker 的变量。故用握手:向目标 worker `postMessage({type:"XUANSHU_SW_VERSION"})`,
 * 它用 `MessageChannel` 回一个自己的版本串。`public/sw.js` 里那条监听就是为此加的 ——
 * 此前 `reload()` 已经在发 `SKIP_WAITING`,而 SW 侧**根本没有 message 监听**,
 * 那条消息一直没人收(见本文件旧注释里那句"补一次 SKIP_WAITING 通知")。
 */

/** 握手消息类型 —— 页面问、SW 答,两处字面量必须一致(sw.js 是纯 JS,共享不了常量) */
const SW_VERSION_QUERY = "XUANSHU_SW_VERSION";

/** 提示过的版本记账键 —— 与存档分片(`xuanshu.` 前缀)同一命名空间 */
export const SEEN_VERSION_KEY = "xuanshu.swSeenVersion";

/**
 * 问一个 worker 自己的缓存版本号。
 *
 * 拿不到就返回 `null`(老 SW 没那条监听、握手超时、通道被打断),调用方按"判不出来"处理 ——
 * **判不出来时不提示**:宁可漏一次提示(玩家下次打开照样会更新),也不要因为判不出来就
 * 无限刷一条关不掉的横幅。
 */
function versionOf(worker: ServiceWorker | null, timeoutMs = 1200): Promise<string | null> {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // 超时兜底:worker 可能正在 activate、也可能根本没装那条监听
    const timer = setTimeout(() => done(null), timeoutMs);
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event: MessageEvent) => {
        clearTimeout(timer);
        const data = (event.data ?? {}) as { type?: string; version?: unknown };
        done(
          data.type === SW_VERSION_QUERY && typeof data.version === "string" && data.version
            ? data.version
            : null,
        );
        channel.port1.close();
      };
      worker.postMessage({ type: SW_VERSION_QUERY }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

/**
 * 装上的这一版,值不值得提示。
 *
 * ## 判据是「不同」,不是「更大」
 *
 * 版本形如 `xuanshu-v2-<7 位 36 进制短哈希>`(见 vite.config.ts 的 sw-precache-manifest),
 * 前缀是手写的「缓存策略世代」、后缀是产物清单派生的短哈希 —— 两者都不是数字,
 * 语义上**没有「谁更大」**,拿字典序当新旧是在编一个不存在的次序。
 *
 * 实测踩过这一个:按字典序比时,CDN 两边缘交替(AAA / BBB)会让 `BBB < AAA` 的那一轮
 * 被判成"不是新版"而放过、`AAA > BBB` 的那一轮被判成"新版"而弹;**而同一对版本
 * 反复出现在两个方向**,于是提示永远跟着边缘走,刷新多少次都停不下来。
 *
 * 真正该问的是:**它和正在跑的那版是不是同一个**。不同 → 值得提示一次(本机记过就不再提);
 * 相同 → 那是同一发版在两台边缘上的两份,或 CDN 翻回来了,不打扰。
 *
 * `current` 判不出来时按"不同"处理:页面已经在 SW 接管之下(调用方已判过 controller 非空),
 * 装上一个读不出版本的新 worker,提示一次是合理的;记账那一层会挡住后续重复。
 */
export function shouldPrompt(installed: string | null, running: string | null): boolean {
  if (!installed) return false; // 判不出来就不提示:宁可漏一次,也不刷一条关不掉的横幅
  if (!running) return true;
  return installed !== running;
}

export interface ServiceWorkerUpdateHandle {
  /** 有新版本且已就绪,提示应用(由调用方决定怎么亮) */
  reload(): void;
  /**
   * 「稍后」—— 记下这一版已经提示过,别在下次 `update()` 撞上同一版时又亮。
   *
   * 与 `reload()` 的区别:后者接受更新(记账 + 重载),前者**只是不再打扰**。
   * 两者都要记账,但记账的时机不同 —— `reload()` 记在重载之前(内存里的状态活不过
   * 重载),`defer()` 记在当下就够。
   */
  defer(): void;
  /** 停止监听(不再触发 onUpdate 与 reload) */
  stop(): void;
}

/**
 * 监听指定 registration 的新版本。onUpdate 在新版本就绪时调用一次。
 */
export function useServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
  onUpdate?: () => void,
): ServiceWorkerUpdateHandle {
  let stopped = false;
  /**
   * 已经提示过 / 已经处理过的那一版。写在这一个 ref 里而不是只写 localStorage:
   * 页面侧可能在握手途中被 reload 打断,内存里这一份至少能挡住本页的重复提示。
   */
  let seenThisSession: string | null = null;

  const handleInstallerState = (installing: ServiceWorker): void => {
    if (installing.state !== "installed") return;
    if (stopped) return;
    // 首次安装(controller 为空)无更新可提示;仅更新时常驻提示
    if (!navigator.serviceWorker.controller) return;
    /*
     * 装好之后先问清「它是哪一版、比我手上这版新吗」,再决定弹不弹。
     *
     * 这一步是异步的(要等握手),而 `statechange` 之后 worker 已经就绪 ——
     * 期间若又来了新的 updatefound,`stopped` 与 `seenThisSession` 两道闸仍会挡住。
     */
    void (async () => {
      const [installedVersion, runningVersion] = await Promise.all([
        versionOf(installing),
        versionOf(navigator.serviceWorker.controller),
      ]);
      if (stopped) return;
      /*
       * 判不出装上的那一版 → 不提示。
       *
       * 宁可漏一次(玩家下次打开会自然更新),也不要把一条关不掉的横幅刷出来:
       * 判不出来的情形恰恰是"这版 SW 还没装上手势消息监听"(老 SW),而老 SW
       * 正是 CDN 还没换干净时会反复回到的那一份。
       */
      if (!installedVersion) return;
      /*
       * 和正在跑的是同一版 → 不提示。
       *
       * 这一条正是「点过刷新之后又弹」的直接原因:CDN 两边缘交替时,`update()` 会在
       * 两份之间来回翻,装上后"版本相同"的那几轮本来就不该算新版。
       */
      if (!shouldPrompt(installedVersion, runningVersion)) return;
      // 同一版只提示一次:本机记过就不再打扰(换页、重开、刷新后仍记得)
      if (seenThisSession === installedVersion) return;
      if (readSeenVersion() === installedVersion) return;
      seenThisSession = installedVersion;
      /*
       * 记账写在这里、而不是只写在 `reload()`/`defer()` 里。
       *
       * 原先只在玩家**动手**时落盘,意味着:提示亮起 → 玩家先不理会(正在打一场、
       * 正在读一段剧情)→ 换个页面或重开一次,`seenThisSession` 随页面一起没了,
       * 同一版又弹一遍。玩家体感就是「过一会又弹出来」,而它其实一次都没被记住。
       *
       * 语义也更准:这一句的时机正是「我已经告诉过玩家这一版了」。
       */
      writeSeenVersion(installedVersion);
      onUpdate?.();
    })();
  };

  /**
   * `installing` 那一枚的 statechange 监听:每来一个新 worker 挂一条,装好(installed)
   * 或作废(redundant)之后就摘掉 —— 否则每检测到一次更新都在那一枚 worker 上多留一条,
   * 而 worker 对象会活到页面重载。stop() 时再把当前那条一并摘掉。
   *
   * 摘的是**监听本身**(worker.removeEventListener),不是「调一次 handler」——
   * 后者在 installing 这种非终态上手是空的,监听照样挂着(实测:同一个 updatefound
   * 派发两次就叠成两条)。
   */
  let detachInstaller: { worker: ServiceWorker; handler: () => void } | null = null;

  const detach = (): void => {
    if (!detachInstaller) return;
    detachInstaller.worker.removeEventListener("statechange", detachInstaller.handler);
    detachInstaller = null;
  };

  const onUpdateFound = (): void => {
    const installing = registration.installing;
    if (!installing) return;
    detach();
    const onState = (): void => {
      handleInstallerState(installing);
      if (installing.state === "installed" || installing.state === "redundant") detach();
    };
    installing.addEventListener("statechange", onState);
    detachInstaller = { worker: installing, handler: onState };
  };

  registration.addEventListener("updatefound", onUpdateFound);

  // updatefound 只在后台检测发现新脚本时派发;注册完成后主动要求检测一次,
  // 免得更新恰好发生在注册那一下被漏掉。
  void registration.update().catch(() => {
    /* 检测失败不算事故:下次导航仍会查 */
  });

  return {
    reload() {
      /*
       * 记账在 reload **之前** —— 重载后这份内存状态就没了,只有落盘的这份能记住
       * 「这一版已经处理过」。不记的话,重载后 `update()` 又撞上同一份(或 CDN 另一
       * 边缘那一份),提示立刻回来:这正是"点过刷新之后过一会又弹"的第二条路径。
       */
      if (seenThisSession) writeSeenVersion(seenThisSession);
      // 对 waiting/installing 再补一次通知,容错皮带 —— 没有监听方则消息被忽略,不影响重载。
      const waiting = registration.waiting ?? registration.installing ?? null;
      try {
        waiting?.postMessage({ type: "SKIP_WAITING" });
      } catch {
        /* 通知失败也照常重载:reload 拉到的总是最新页面 */
      }
      location.reload();
    },
    /**
     * 「稍后」:把这一版记进本机,然后什么都不做 —— 不重载、不摘监听。
     * 真发了下一版时 `handleInstallerState` 会拿到一个更大的版本号,照样回调。
     */
    defer() {
      if (seenThisSession) writeSeenVersion(seenThisSession);
    },
    /**
     * 停监听:标志只是「不再回调」,挂在 registration 上的那条监听得真摘掉 ——
     * registration 活到页面卸载,不摘就跟着活到最后(App 卸载后它仍会解构闭包)。
     */
    stop() {
      stopped = true;
      registration.removeEventListener("updatefound", onUpdateFound);
      detach();
    },
  };
}

/** 读「提示过的版本」—— 存储不可用(隐私模式 / 配额满)时当作没记过 */
function readSeenVersion(): string | null {
  try {
    return globalThis.localStorage?.getItem(SEEN_VERSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeSeenVersion(version: string): void {
  try {
    globalThis.localStorage?.setItem(SEEN_VERSION_KEY, version);
  } catch {
    /* 存不下就只靠 seenThisSession 挡本页:不因为记不住就让提示反复刷 */
  }
}
