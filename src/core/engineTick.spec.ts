/**
 * 游戏心跳的墙钟契约 —— 时钟回拨不许把心跳冻住。
 *
 * 由来:`GameEngine.tick()` 用 `if (dt <= 0) return` 同时兜住「同一毫秒两拍」与
 * 「墙钟倒退」。前者无害,后者把 `lastTickAt` 留在未来 —— 之后每一拍都算出负数、
 * 提前返回,直到墙钟自己追平为止。手改时间或系统 NTP 校正之后,修为/灵气/建筑/
 * 历练一起停摆,`totalPlaySec` 也不再增长,而界面上没有任何提示。
 *
 * 为什么在 node 环境下测:`GameEngine` 只用 `window.setInterval` 与
 * `document.addEventListener` 两条浏览器 API,壳在这里用 `vi.stubGlobal` 顶上。
 * 推进全在 `Date.now()` 上,故只假 timer 不假 Date,再用 Date.now 替身推墙钟 ——
 * 回拨才能真造出来(假 Date 的 setSystemTime 只挪读数,不重排已挂的 timer)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { engine } from "./engine";
import { useGameStore } from "@/stores/game";
import { useUiStore } from "@/stores/ui";

let clock = 1_000_000;

function stubBrowserApis(): void {
  const noop = (): void => undefined;
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: noop,
    removeEventListener: noop,
  });
  vi.stubGlobal("window", {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
    clearInterval: (id: number) => clearInterval(id as unknown as ReturnType<typeof setInterval>),
    addEventListener: noop,
    removeEventListener: noop,
  });
}

/** 走 n 拍:每拍把墙钟推 1 秒,再让心跳的 interval 真跑一次 */
function tick(seconds: number): void {
  for (let i = 0; i < seconds; i += 1) {
    clock += 1000;
    vi.advanceTimersByTime(1000);
  }
}

beforeEach(() => {
  clock = 1_000_000;
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  setActivePinia(createPinia());
  stubBrowserApis();
  useGameStore().markStarted();
  engine.start();
});

afterEach(() => {
  engine.stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GameEngine 心跳 · 按时间戳差值推进", () => {
  it("六拍之后按 5 秒盖章记一次游玩时长", () => {
    tick(6);
    expect(useGameStore().totalPlaySec, "ACTIVE_STAMP_MS=5s,第六拍还差一脚").toBe(5);
  });
});

describe("GameEngine 心跳 · 墙钟回拨", () => {
  it("回拨之后从新时钟接着走,不冻到墙钟追平", () => {
    tick(6);
    expect(useGameStore().totalPlaySec).toBe(5);

    // 手改时间 / NTP 校正:墙钟一次退回一小时,而心跳 interval 照常每秒跑
    clock -= 3_600_000;
    tick(6);

    expect(
      useGameStore().totalPlaySec,
      "回拨之后仍应继续累计游玩时长 —— 否则心跳要停满一小时才恢复",
    ).toBe(10);
  });

  it("回拨不是缺席:不发归来账,也不把那小时补成游玩时长", () => {
    tick(6);
    clock -= 3_600_000;
    tick(6);

    expect(useUiStore().offlineSummary, "回拨既不是离线,不该弹归来卷轴").toBeNull();
    expect(useGameStore().totalPlaySec, "回拨的那一小时不能反算成游玩时长").toBe(10);
  });
});
