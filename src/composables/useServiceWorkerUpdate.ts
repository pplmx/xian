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
 */
export interface ServiceWorkerUpdateHandle {
  /** 有新版本且已就绪,提示应用(由调用方决定怎么亮) */
  reload(): void;
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

  const handleInstallerState = (installing: ServiceWorker): void => {
    if (installing.state !== "installed") return;
    if (stopped) return;
    // 首次安装(controller 为空)无更新可提示;仅更新时常驻提示
    if (navigator.serviceWorker.controller) onUpdate?.();
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
