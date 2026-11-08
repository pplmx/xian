/**
 * 单写者 —— 同一份存档只许一个页面写。
 *
 * 判据用 Web Locks 的 `ifAvailable` 语义:先到的那页拿到锁并持有到卸载,后来的
 * 拿到 null、立刻交还、把自己标成只读。老内核没有 LockManager 时 fail-open,
 * 退回旧行为而不是让游戏起不来。
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  SAVE_WRITER_LOCK,
  acquireSaveWriterRole,
  saveReader,
  saveWriterFree,
  type LockLike,
  resetSaveReader,
} from "./singleWriter";

/** 极简 LockManager:同名锁同一时刻只有一个持有者,`ifAvailable` 拿不到就回 null */
function makeLocks(): { locks: LockLike; release: () => void } {
  let held = false;
  return {
    locks: {
      request: async (name, options, callback) => {
        if (options.ifAvailable && held) {
          await callback(null);
          return null;
        }
        held = true;
        // 持有者的回调永不 settle(一直持有到页面卸载),这里不等它
        void callback({ name });
        return null;
      },
    },
    release: () => {
      held = false;
    },
  };
}

/*
 * 每个用例后把模块态复位 —— `saveReader` 是模块级 ref,不随 pinia 重置。
 * 漏了它,任何一次 `acquireSaveWriterRole` 落进只读分支后,后面所有读它的用例
 * (以及**别的 spec 文件**)都会以为自己是只读页。
 */
afterEach(() => {
  resetSaveReader();
  vi.unstubAllGlobals();
});

describe("单写者 · 先到先写,后来的只读", () => {
  it("空场:本页是写者", async () => {
    const { locks } = makeLocks();
    expect(await acquireSaveWriterRole(locks)).toBe(true);
    expect(saveReader.value, "写者不该被标成只读").toBe(false);
  });

  it("已有页面在写:本页只读,且不去排队抢", async () => {
    const { locks } = makeLocks();
    expect(await acquireSaveWriterRole(locks)).toBe(true);
    expect(await acquireSaveWriterRole(locks), "第二个页面必须让位").toBe(false);
    expect(saveReader.value, "第二页要进只读态(启动流程据此跳过引擎)").toBe(true);
  });

  it("没有 Web Locks 的老内核:fail-open,照旧能写", async () => {
    expect(await acquireSaveWriterRole(undefined)).toBe(true);
    expect(saveReader.value).toBe(false);
  });

  /**
   * 迟到的「没拿到」必须把已经开出去的写者身份收回来。
   *
   * 超时那条路会在 500ms 后按 fail-open 答 true(main.ts 据此跑 prepareLocalSave
   * 与心跳)。而浏览器完全可能更晚才回 locks.request 的回调 —— 主线程忙、
   * 锁服务被占着,500ms 不算长。若那时只把 promise settle 掉,没有人会再看它:
   * 本页带着「我是写者」的身份继续跑,两个页面各写各的,后写的盖掉先写的。
   *
   * 这条用例让回调在超时**之后**才给 null,断言本页被收回成只读。
   */
  it("超时后回调才说没拿到:要把写者身份收回来", async () => {
    vi.useFakeTimers();
    try {
      let lateCallback: (() => void) | null = null;
      const late: LockLike = {
        request: (_name, _opts, callback) => {
          // 先不回,等用例主动触发 —— 模拟「浏览器迟于超时」
          lateCallback = () => void callback(null);
          return Promise.resolve(null);
        },
      };
      const p = acquireSaveWriterRole(late);
      await vi.advanceTimersByTimeAsync(800);
      expect(await p, "超时先按写者处理(fail-open)").toBe(true);
      expect(saveReader.value, "此刻还不是只读").toBe(false);

      lateCallback!();
      await vi.advanceTimersByTimeAsync(0);
      expect(saveReader.value, "迟到的 null 必须把本页收回成只读").toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("探测卡住时按写者处理 —— 不把启动挂在锁上", async () => {
    vi.useFakeTimers();
    try {
      const stuck: LockLike = { request: () => new Promise(() => undefined) };
      const p = acquireSaveWriterRole(stuck);
      await vi.advanceTimersByTimeAsync(800);
      expect(await p, "超时后 fail-open").toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("只读页 · 席位空出来没有", () => {
  /*
   * 只读页的另一半:另一处关掉之后,玩家得知道「现在刷新就能继续」。
   * 没有这条探测时,横幅一辈子写着「已在另一处打开」—— 玩家只能猜。
   */
  it("有人持有 → false;没人持有 → true", async () => {
    let live: { name: string }[] = [{ name: SAVE_WRITER_LOCK }];
    const locks: LockLike = {
      request: async () => null,
      query: async () => ({ held: live, pending: [] }),
    };
    expect(await saveWriterFree(locks)).toBe(false);
    live = [];
    expect(await saveWriterFree(locks), "另一处关掉后要看得出来").toBe(true);
  });

  it("排队等着的也算有人 —— 席位还没真正空出来", async () => {
    const locks: LockLike = {
      request: async () => null,
      query: async () => ({ pending: [{ name: SAVE_WRITER_LOCK }] }),
    };
    expect(await saveWriterFree(locks)).toBe(false);
  });

  it("问不出来就答 false —— 不能让玩家白刷新", async () => {
    /*
     * `undefined` 会命中默认参数 `locks = defaultLocks()`,而 **Node 26 自带
     * `navigator.locks`** —— 于是这条根本走不到 `!locks` 分支,断言的是真实锁的
     * 当下状态。默认顺序下碰巧为 false,打乱后别的用例让它变成 true(实测 seed=3 红)。
     * 要测"没有 LockManager",得把 navigator 临时摘掉,而不是传 undefined。
     */
    vi.stubGlobal("navigator", undefined);
    try {
      expect(await saveWriterFree(undefined), "没有 LockManager").toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(await saveWriterFree({ request: async () => null }), "没有 query").toBe(false);
    const broken: LockLike = {
      request: async () => null,
      query: async () => {
        throw new Error("query 炸了");
      },
    };
    expect(await saveWriterFree(broken)).toBe(false);
  });

  it("只认我们这一把锁:别的锁不算", async () => {
    const locks: LockLike = {
      request: async () => null,
      query: async () => ({ held: [{ name: "someone-else" }] }),
    };
    expect(await saveWriterFree(locks)).toBe(true);
  });
});
