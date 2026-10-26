/**
 * 单写者 —— 同一份存档只许一个页面写。
 *
 * 判据用 Web Locks 的 `ifAvailable` 语义:先到的那页拿到锁并持有到卸载,后来的
 * 拿到 null、立刻交还、把自己标成只读。老内核没有 LockManager 时 fail-open,
 * 退回旧行为而不是让游戏起不来。
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { acquireSaveWriterRole, saveReader, type LockLike } from "./singleWriter";

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
