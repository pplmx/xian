/**
 * Service Worker 新版本检测 —— useServiceWorkerUpdate 的状态机契约。
 *
 * 这里钉的是纯逻辑部分(registration/installing 的监听流转、controller 门、
 * reload 的消息补发),不真跑 SW:registration/installing 用消息捕获的假体,
 * navigator.serviceWorker.controller 与 location.reload 走 stub。
 * 真浏览器的 SW 生命周期(updatefound 是否派发、skipWaiting 是否生效)由
 * public/sw.js 的实现与浏览器保证,不在本 spec 的钉子范围内。
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";

/** 假 installing worker:可手动推 state,捕获 statechange 监听(可摘) */
function makeInstalling() {
  const listeners: Array<() => void> = [];
  const worker = {
    state: "installing" as ServiceWorkerState,
    addEventListener(type: string, fn: () => void) {
      if (type === "statechange") listeners.push(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      if (type !== "statechange") return;
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    postMessage: vi.fn(),
  };
  return {
    worker,
    /** 当前挂着的 statechange 监听数 —— 「装好就摘」与「stop 要摘」两条判据靠它 */
    listenerCount: () => listeners.length,
    setState(s: ServiceWorkerState) {
      worker.state = s;
      for (const fn of listeners.slice()) fn();
    },
  };
}

/** 假 registration:捕获 updatefound 监听(可摘),记下 update() 调用 */
function makeRegistration(installing: ReturnType<typeof makeInstalling> | null) {
  const updateFoundListeners: Array<() => void> = [];
  const registration = {
    installing: installing?.worker ?? null,
    waiting: null as ServiceWorker | null,
    addEventListener(type: string, fn: () => void) {
      if (type === "updatefound") updateFoundListeners.push(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      if (type !== "updatefound") return;
      const i = updateFoundListeners.indexOf(fn);
      if (i >= 0) updateFoundListeners.splice(i, 1);
    },
    update: vi.fn(() => Promise.resolve()),
  };
  return {
    registration,
    /** 当前挂着的 updatefound 监听数 —— stop 有没有真摘掉,看这个 */
    listenerCount: () => updateFoundListeners.length,
    found: () => {
      for (const fn of updateFoundListeners.slice()) fn();
    },
  };
}

/** node 环境没有 SW/	location:stub 掉再跑,收尾还原 */
function stubBrowser(controller: ServiceWorker | null) {
  vi.stubGlobal("navigator", { serviceWorker: { controller } });
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  return { reload };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useServiceWorkerUpdate · 首次安装不提示", () => {
  it("controller 为空(页面没被 SW 接管过):installed 也不调 onUpdate", () => {
    stubBrowser(null);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installing");
    installing.setState("installed");
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("useServiceWorkerUpdate · 更新提示", () => {
  it("controller 非空 + 新脚本装到 installed:onUpdate 恰好一次", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installed");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("state 中间态(installing)不触发;首次 installed 触发一次", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installing");
    expect(onUpdate).not.toHaveBeenCalled();
    installing.setState("installed");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    /*
     * 重复派发 installed 不再重复提示:终态(installed / redundant)一到就把
     * statechange 监听摘掉,第二下根本没有监听可派发。
     * 此前只置一个「不再回调」的标志做不到这一点 —— 提示会连着亮两次。
     */
    installing.setState("installed");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("stop() 之后才装好的新版本:不再提示", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    const handle = useServiceWorkerUpdate(
      registration as unknown as ServiceWorkerRegistration,
      onUpdate,
    );
    found();
    handle.stop();
    installing.setState("installed");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("stop() 之后再来的 updatefound:同样不提示", () => {
    stubBrowser({} as ServiceWorker);
    const first = makeInstalling();
    const second = makeInstalling();
    const registration = makeRegistration(first);
    const onUpdate = vi.fn();
    const handle = useServiceWorkerUpdate(
      registration.registration as unknown as ServiceWorkerRegistration,
      onUpdate,
    );
    registration.found();
    handle.stop();
    // 第二个 installing:换掉 registration.installing 再派发一次 updatefound
    (registration.registration as { installing: unknown }).installing = second.worker;
    registration.found();
    second.setState("installed");
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("useServiceWorkerUpdate · 监听要真摘掉", () => {
  /*
   * stop() 原先只置一个 stopped 标志:挂在 registration 上的 updatefound 监听照样活着,
   * 而 registration 活到页面卸载 —— App 卸载之后它仍抓着闭包(含 ui store 的那条
   * 回调链)。标志能挡住「不再提示」,挡不住「监听还在」;两件事分开判。
   */
  it("stop() 摘掉 updatefound 监听 —— 不只是置一个不再回调的标志", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, listenerCount } = makeRegistration(installing);
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    expect(listenerCount(), "装上之后要挂着一条").toBe(1);
    handle.stop();
    expect(listenerCount(), "stop 之后要真摘掉").toBe(0);
  });

  it("stop() 也摘掉 installing 上那条 statechange", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    found();
    expect(installing.listenerCount(), "updatefound 之后在那一枚上挂一条").toBe(1);
    handle.stop();
    expect(installing.listenerCount(), "stop 之后 worker 上不留监听").toBe(0);
  });

  it("装好(installed)就摘 —— 同一个 worker 不重复挂、也不残留", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    found(); // 同一个 updatefound 派发两次:第二条不该把第一条留下
    expect(installing.listenerCount(), "重复派发不该叠加监听").toBe(1);
    installing.setState("installed");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(installing.listenerCount(), "装好之后那条自己摘掉").toBe(0);
  });

  it("redundant(装失败/被顶掉)同样摘掉 —— 不会再有 installed", () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    found();
    installing.setState("redundant");
    expect(installing.listenerCount()).toBe(0);
  });
});

describe("useServiceWorkerUpdate · reload()", () => {
  it("waiting 在:补发 SKIP_WAITING 后重载", () => {
    const { reload } = stubBrowser({} as ServiceWorker);
    const { registration } = makeRegistration(null);
    const waiting = { postMessage: vi.fn() };
    registration.waiting = waiting as unknown as ServiceWorker;
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    handle.reload();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("waiting 空、installing 在:对 installing 补发", () => {
    const { reload } = stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration } = makeRegistration(installing);
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    handle.reload();
    expect(installing.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("两者皆空(更新早已接完):不 postMessage,照常重载", () => {
    const { reload } = stubBrowser(null);
    const { registration } = makeRegistration(null);
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    expect(() => handle.reload()).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("postMessage 抛错(目标 worker 已被顶掉):重载不受影响", () => {
    const { reload } = stubBrowser({} as ServiceWorker);
    const { registration } = makeRegistration(null);
    const waiting = {
      postMessage: vi.fn(() => {
        throw new DOMException("No active worker");
      }),
    };
    registration.waiting = waiting as unknown as ServiceWorker;
    const handle = useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    handle.reload();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("useServiceWorkerUpdate · 检测容错", () => {
  it("registration.update() 拒绝:吞掉,不向外抛未处理拒绝", async () => {
    stubBrowser(null);
    const { registration } = makeRegistration(null);
    registration.update = vi.fn(() => Promise.reject(new Error("离线")));
    expect(() =>
      useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration),
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("注册完成后主动要求检测一次(update 被调)", () => {
    stubBrowser(null);
    const { registration } = makeRegistration(null);
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });
});
