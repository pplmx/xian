/**
 * 心跳暂停的墙上时钟 —— 暂停期间「现在」必须冻住
 *
 * 由来:暂停(重置确认框 / 早期窗口)期间,凡是「按墙上时钟算到期」的东西都不能继续
 * 走 —— 否则挂着一个确认框,卦会自己散、地界事件会自己过、突破准备会自己变成就绪。
 * `enginePause` 把这一刻钉住:暂停时 `gameNow()` 返回暂停那一刻,恢复后回到真实时间。
 *
 * 这块逻辑此前没有单独的 spec,只被别处的静态审计蹭到(见 uiLayering「不空耗墙上
 * 时钟」),而它正是最该钉死的那类东西 —— 差一秒就是「我没点它自己动了」。故补一份。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { enginePaused, gameNow, pauseElapsedMs, setEnginePaused } from "./enginePause";

const at = (iso: string) => vi.setSystemTime(new Date(iso));

describe("心跳暂停 · 墙上时钟冻在暂停那一刻", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setEnginePaused(false);
    at("2026-01-01T00:00:00Z");
  });

  afterEach(() => {
    setEnginePaused(false);
    vi.useRealTimers();
  });

  it("未暂停:gameNow 跟真实时钟走,pauseElapsedMs 恒为 0", () => {
    expect(enginePaused.value).toBe(false);
    const t0 = gameNow();
    at("2026-01-01T00:00:10Z");
    expect(gameNow()).toBe(t0 + 10_000);
    expect(pauseElapsedMs()).toBe(0);
  });

  it("暂停后:gameNow 冻在暂停那一刻,真实时间再走也不动", () => {
    at("2026-01-01T00:00:05Z");
    setEnginePaused(true);
    const frozen = gameNow();
    expect(enginePaused.value).toBe(true);
    at("2026-01-01T01:00:00Z");
    expect(gameNow()).toBe(frozen);
  });

  it("暂停中重复 setEnginePaused(true) 不重置冻结点(幂等)", () => {
    at("2026-01-01T00:00:05Z");
    setEnginePaused(true);
    const frozen = gameNow();
    at("2026-01-01T00:00:30Z");
    setEnginePaused(true);
    expect(gameNow()).toBe(frozen);
  });

  it("pauseElapsedMs:暂停中按传入的 now 计,且不早于冻结点(负数夹回 0)", () => {
    at("2026-01-01T00:00:05Z");
    setEnginePaused(true);
    expect(pauseElapsedMs(gameNow() + 4_000)).toBe(4_000);
    expect(pauseElapsedMs(gameNow() - 1_000)).toBe(0);
  });

  it("恢复后:gameNow 回到真实时钟,pauseElapsedMs 归 0", () => {
    setEnginePaused(true);
    at("2026-01-01T02:00:00Z");
    setEnginePaused(false);
    expect(enginePaused.value).toBe(false);
    expect(pauseElapsedMs()).toBe(0);
    expect(gameNow()).toBe(Date.now());
  });
});
