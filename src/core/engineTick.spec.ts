/**
 * 游戏心跳的墙钟契约 —— 时钟回拨不许把心跳冻住。
 *
 * 由来:`GameEngine.tick()` 用 `if (dt <= 0) return` 同时兜住「同一毫秒两拍」与
 * 「墙钟倒退」。前者无害,后者把 `lastTickAt` 留在未来 —— 之后每一拍都算出负数、
 * 提前返回,直到墙钟自己追平为止。手改时间或系统 NTP 校正之后,修为/灵气/建筑/
 * 历练一起停摆,`totalPlaySec` 也不再增长。修复不只重设基准,还要把大幅回拨
 * 明说给玩家:已经按新时钟继续,且倒退的那段不补成离线收益。
 *
 * 为什么在 node 环境下测:`GameEngine` 只用 `window.setInterval` 与
 * `document.addEventListener` 两条浏览器 API,壳在这里用 `vi.stubGlobal` 顶上。
 * 推进全在 `Date.now()` 上,故只假 timer 不假 Date,再用 Date.now 替身推墙钟 ——
 * 回拨才能真造出来(假 Date 的 setSystemTime 只挪读数,不重排已挂的 timer)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useDiagStore } from "@/stores/diag";
import { engine } from "./engine";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
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
  // notify / 诊断落点都由 store setup 时接入;先建一次,才测得到引擎发出的消息
  useUiStore();
  useDiagStore();
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
    const toast = vi.spyOn(useUiStore(), "toast");
    tick(6);
    expect(useGameStore().totalPlaySec).toBe(5);

    // 手改时间 / NTP 校正:墙钟一次退回一小时,而心跳 interval 照常每秒跑
    clock -= 3_600_000;
    toast.mockClear();
    tick(1);

    expect(useGameStore().totalPlaySec, "回拨的那一拍没有可结算时长,不该把倒退的一小时补进来").toBe(
      5,
    );
    expect(
      toast.mock.calls.some(
        ([text, kind]) => kind === "warn" && String(text).includes("系统时间向后调整了约"),
      ),
      "大幅回拨要告诉玩家:时间已重设,且不回补离线收益",
    ).toBe(true);

    tick(5);
    expect(useGameStore().totalPlaySec, "回拨之后仍应继续累计游玩时长").toBe(10);
  });

  it("回拨不是缺席:不发归来账,也不把那小时补成游玩时长", () => {
    tick(6);
    clock -= 3_600_000;
    tick(6);

    expect(useUiStore().offlineSummary, "回拨既不是离线,不该弹归来卷轴").toBeNull();
    expect(useGameStore().totalPlaySec, "回拨的那一小时不能反算成游玩时长").toBe(10);
  });

  it("小幅时钟校正不打扰玩家", () => {
    const toast = vi.spyOn(useUiStore(), "toast");
    tick(6);
    toast.mockClear();
    clock -= 4_000;
    tick(1); // 净回拨 3 秒,低于提示线
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("GameEngine 心跳 · 异常可追踪", () => {
  it("Tick 异常写入诊断,连续坏拍只累计、不刷 toast", () => {
    const diag = useDiagStore();
    const toast = vi.spyOn(useUiStore(), "toast");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(usePlayerStore(), "gainExp").mockImplementation(() => {
      throw new Error("坏拍");
    });

    tick(6);

    expect(consoleError, "控制台仍要留原始异常,方便开发与浏览器自检定位").toHaveBeenCalled();
    expect(diag.errors, "设置页诊断必须拿得到被 catch 的引擎异常").toHaveLength(1);
    expect(diag.errors[0]).toMatchObject({
      info: "engine.tick",
      message: "Error: 坏拍",
      count: 6,
    });
    const engineNotices = toast.mock.calls.filter(([text]) =>
      String(text).includes("已记入设置页诊断"),
    );
    expect(engineNotices, "连续坏拍不能每秒弹一条").toHaveLength(1);
    expect(engineNotices[0]?.[1]).toBe("warn");
  });

  it("持续坏拍不把故障时长攒成离线结算", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gainExp = vi.spyOn(usePlayerStore(), "gainExp").mockImplementation(() => {
      throw new Error("推进失败");
    });

    tick(125);
    expect(gainExp, "每拍失败后都应从当下重新起算,不能在恢复时一次补 121 秒").toHaveBeenCalledTimes(
      125,
    );
    expect(useUiStore().offlineSummary, "在线报错不是缺席,不该冒领归来账").toBeNull();
  });
});
