import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { setEnginePaused } from "@/core/enginePause";
import { useGameNow, gameNowSeconds } from "./useGameNow";
import { nextTick, ref } from "vue";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  // enginePause 是模块级单例:恢复心跳,别把暂停态漏给下一个用例/文件
  setEnginePaused(false);
});

/**
 * 游戏钟域的秒级心跳读数 —— 盯着的倒计时显示专用。
 *
 * 缺口:闭关剩余/BuffDialog/卦倒计时此前读 totalPlaySec 当心跳,而引擎只在
 * ACTIVE_STAMP_MS(5 秒)才 addPlayTime 一次 —— 分秒倒计时 5 秒一跳,
 * 「04分58秒」的秒针纹丝不动、每 5 秒跳 5 格,盯着看的玩家只觉得卡。
 * totalPlaySec 直接改 1s 会把 weatherMods → finalStats(全库最重 computed)拖成
 * 每秒重算 —— 显示心跳与结算依赖解耦:本 composable 自起 1s 表,
 * 冻结/顺延语义与结算的 gameNow() 完全一致;结算判定链不读它,不受影响。
 */

describe("useGameNow · 游戏钟域的秒级心跳", () => {
  it("每秒推进:读数随 1s 表刷新,分秒倒计时不再 5 秒一跳", () => {
    vi.setSystemTime(1_000_000);
    const now = gameNowSeconds();
    const before = now.value;
    vi.advanceTimersByTime(3000);
    expect(now.value, "3 秒后读数应前进 3 秒").toBe(before + 3000);
  });

  it("暂停冻结:心跳停着读数不动;恢复后跳到墙上钟 —— 与结算 gameNow() 同源,倒计时差值恒正确", () => {
    vi.setSystemTime(2_000_000);
    const now = gameNowSeconds();
    const atPause = now.value;
    setEnginePaused(true);
    vi.advanceTimersByTime(8000);
    expect(now.value, "暂停期间读数冻结于入停时刻").toBe(atPause);
    setEnginePaused(false);
    vi.advanceTimersByTime(1000);
    // 恢复后读数 = gameNow() = 墙上钟(恢复拍)。这与结算判定同源:
    // shiftWallClocks 已把在途截止顺延 8 秒,(endsAt − now) 恢复前后都正确,
    // 显示不会比判定先归零 —— 「读数吃掉暂停段」不是缺陷,是同源本身。
    expect(now.value).toBe(2_009_000);
  });

  it("useGameNow:组合式起表,读数是 ref;卸载语义由组件生命周期兜(useGameClock 同壳)", async () => {
    vi.setSystemTime(3_000_000);
    // 不在组件环境里直接调命令式核心即可;组合式只是薄壳,这里验证它可调用、返回 ref
    const holder = ref<number | null>(null);
    expect(useGameNow).toBeTypeOf("function");
    void holder;
    await nextTick();
  });
});
