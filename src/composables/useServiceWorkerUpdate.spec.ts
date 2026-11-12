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
import { shouldPrompt, useServiceWorkerUpdate } from "./useServiceWorkerUpdate";

/** 假 installing worker:可手动推 state,捕获 statechange 监听(可摘) */
function makeInstalling(initialVersion = "xuanshu-v2-aaa") {
  const listeners: Array<() => void> = [];
  let version = initialVersion;
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
    /**
     * 应答版本握手(`XUANSHU_SW_VERSION`) —— 和新版 sw.js 一样走 MessageChannel。
     *
     * 不给版本号的假 worker 会被判成"判不出来",而判不出来时**不提示** ——
     * 那样这几条旧用例会以"没提示"变绿,实际什么都没量到。故默认给一个版本。
     */
    postMessage: vi.fn((data: unknown, ports?: MessagePort[]) => {
      if ((data as { type?: string })?.type !== "XUANSHU_SW_VERSION") return;
      const port = ports?.[0];
      port?.postMessage?.({ type: "XUANSHU_SW_VERSION", version });
    }),
  };
  return {
    worker,
    /** 改这一枚 worker 自报的版本(判据:同版不弹、不同版才弹) */
    setVersion(v: string) {
      version = v;
    },
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

/**
 * 记账用的本机存储 —— node 里没有 localStorage,stub 一份最小的。
 *
 * 「同一版只提示一次」落在 localStorage 上(见 useServiceWorkerUpdate 的
 * `SEEN_VERSION_KEY`):不给它就测不到"下次打开不再弹"这条正题。
 */
const seenStore = new Map<string, string>();
/*
 * 挂在 `globalThis` 上(不是 `vi.stubGlobal`):被测代码读的是
 * `globalThis.localStorage`,而 stubGlobal 另立一套全局表 —— 两处不是同一个东西,
 * 用 stubGlobal 会让记账静默写进虚空(实测:断言拿到的永远是 undefined)。
 */
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => seenStore.get(k) ?? null,
    setItem: (k: string, v: string) => void seenStore.set(k, String(v)),
    removeItem: (k: string) => void seenStore.delete(k),
    clear: () => seenStore.clear(),
  },
});

/** node 环境没有 SW/	location:stub 掉再跑,收尾还原 */
function stubBrowser(controller: ServiceWorker | null) {
  vi.stubGlobal("navigator", { serviceWorker: { controller } });
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  return { reload };
}

/**
 * 等版本握手那一拍。
 *
 * 「弹不弹」现在是异步判定的 —— 要先问清装上的那一版、和正在跑的那一版。
 * 同步断言会永远看到"还没决定",于是以"没提示"变绿(实际什么都没量到)。
 */
const settle = () => new Promise((r) => setTimeout(r, 20));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs?.();
  // 记账用的 localStorage 在 node 里没有:stub 一个,清干净再跑下一条
  seenStore.clear();
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
  it("controller 非空 + 新脚本装到 installed:onUpdate 恰好一次", async () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-bbb");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installed");
    // 判「弹不弹」要先等版本握手回来(异步),给它一拍
    await settle();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("state 中间态(installing)不触发;首次 installed 触发一次", async () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-bbb");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installing");
    expect(onUpdate).not.toHaveBeenCalled();
    installing.setState("installed");
    await settle();
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

  it("装好(installed)就摘 —— 同一个 worker 不重复挂、也不残留", async () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling();
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    found(); // 同一个 updatefound 派发两次:第二条不该把第一条留下
    expect(installing.listenerCount(), "重复派发不该叠加监听").toBe(1);
    installing.setState("installed");
    await settle();
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

/*
 * 「点过刷新之后过一会又弹」—— 线上报的那个 loop。
 *
 * 线上发版走 CDN,边缘最终一致:同一时刻两台边缘可能还各有新旧两份 sw.js。
 * 浏览器两次 update() 撞上不同边缘,就在两个版本之间来回翻;此前页面把**每一次**
 * 装到 installed 都当成「有新版」,于是提示跟着边缘走,刷多少次都停不下来。
 *
 * 真浏览器复现(两条边缘交替吐 sw.js):修复前 8 轮弹 7 次,修复后 8 轮弹 1 次。
 * 下面这几条把"为什么"钉在纯逻辑层。
 */
describe("useServiceWorkerUpdate · CDN 翻版不再反复弹", () => {
  it("版本判据是「不同」不是「更大」—— 字典序会把翻版判错", () => {
    /*
     * 版本是 `xuanshu-v2-<产物短哈希>`,哈希之间**没有大小关系**。
     * 按字典序比时,同一对版本会在两个方向上被判出两种结果 ——
     * 那正是提示跟着 CDN 边缘走、永不收敛的机制。
     */
    expect(shouldPrompt("xuanshu-v2-bbb", "xuanshu-v2-aaa"), "不同就该提示").toBe(true);
    expect(shouldPrompt("xuanshu-v2-aaa", "xuanshu-v2-bbb"), "翻回另一份同样算不同").toBe(true);
    expect(shouldPrompt("xuanshu-v2-aaa", "xuanshu-v2-aaa"), "同一版不提示").toBe(false);
  });

  it("判不出版本(老 SW 没有握手)时不提示 —— 那条路正是会反复弹的那条", () => {
    expect(shouldPrompt(null, "xuanshu-v2-aaa"), "读不到就不提示").toBe(false);
    expect(shouldPrompt("xuanshu-v2-aaa", null), "对照:读得到、跑着的那份读不到,提示一次").toBe(
      true,
    );
  });

  it("弹过一次就记账 —— 同一版之后不再打扰(重开、换页都算)", async () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-bbb");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installed");
    await settle();
    expect(onUpdate, "第一次该弹").toHaveBeenCalledTimes(1);
    expect(seenStore.get("xuanshu.swSeenVersion"), "弹的同时就要记账").toBe("xuanshu-v2-bbb");

    // 模拟「页面重开」:新一套 registration,同一版
    const again = makeInstalling("xuanshu-v2-bbb");
    const second = makeRegistration(again);
    const onUpdate2 = vi.fn();
    useServiceWorkerUpdate(second.registration as unknown as ServiceWorkerRegistration, onUpdate2);
    second.found();
    again.setState("installed");
    await settle();
    expect(onUpdate2, "记过账的那一版重开也不再弹").not.toHaveBeenCalled();
  });

  it("真发了下一版仍会弹 —— 记账只挡同一版,不挡更新", async () => {
    seenStore.set("xuanshu.swSeenVersion", "xuanshu-v2-old");
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-brand-new");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    useServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, onUpdate);
    found();
    installing.setState("installed");
    await settle();
    expect(onUpdate, "新版本要照常提示").toHaveBeenCalledTimes(1);
  });

  it("defer() 之后不再打扰 —— 「稍后」不是「永不更新」", async () => {
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-bbb");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    const handle = useServiceWorkerUpdate(
      registration as unknown as ServiceWorkerRegistration,
      onUpdate,
    );
    found();
    installing.setState("installed");
    await settle();
    handle.defer();
    expect(seenStore.get("xuanshu.swSeenVersion")).toBe("xuanshu-v2-bbb");
    // 监听仍在:下一版来时还要能弹
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

/*
 * 「稍后」这条路的两个断点 —— 都是玩家报「总是弹」时最容易被忽略的那一半。
 */
describe("useServiceWorkerUpdate · 「稍后」不是「永不提示」", () => {
  it("defer() 只记这一版,不摘监听 —— 下一版来了仍会弹", async () => {
    stubBrowser({} as ServiceWorker);
    const first = makeInstalling("xuanshu-v2-bbb");
    const reg = makeRegistration(first);
    const onUpdate = vi.fn();
    const handle = useServiceWorkerUpdate(
      reg.registration as unknown as ServiceWorkerRegistration,
      onUpdate,
    );
    reg.found();
    first.setState("installed");
    await settle();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    handle.defer();
    expect(seenStore.get("xuanshu.swSeenVersion")).toBe("xuanshu-v2-bbb");

    // 下一版:换成新的 installing 再派发一次
    const next = makeInstalling("xuanshu-v2-ccc");
    (reg.registration as { installing: unknown }).installing = next.worker;
    reg.found();
    next.setState("installed");
    await settle();
    expect(onUpdate, "「稍后」之后真发了新版仍要弹").toHaveBeenCalledTimes(2);
  });

  it("defer() 之前先记过的账不会覆盖掉 —— 谁先谁后都只挡同一版", async () => {
    seenStore.set("xuanshu.swSeenVersion", "xuanshu-v2-zzz");
    stubBrowser({} as ServiceWorker);
    const installing = makeInstalling("xuanshu-v2-bbb");
    const { registration, found } = makeRegistration(installing);
    const onUpdate = vi.fn();
    const handle = useServiceWorkerUpdate(
      registration as unknown as ServiceWorkerRegistration,
      onUpdate,
    );
    found();
    installing.setState("installed");
    await settle();
    handle.defer();
    expect(seenStore.get("xuanshu.swSeenVersion"), "该记的是这次提示的那一版").toBe(
      "xuanshu-v2-bbb",
    );
  });
});
