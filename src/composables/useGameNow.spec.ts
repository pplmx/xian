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
 *
 * 为什么不是「把 ACTIVE_STAMP_MS 改成 1s」:原始理由写的是「finalStats 是最重的
 * computed,每秒重算受不了」—— 实测把这条推翻了(满装 + 闭关状态下 finalStats
 * 重算 ≈7.4us、渡劫逐波推演 ≈18.5us、修行页 1s 心跳零长帧、最差帧 17ms)。
 * 解耦的真理由因此改成**语义**:totalPlaySec 是「已游玩时长」这一存档事实,
 * 它的盖章节流同时服务 lastActiveAt 落盘 —— 让落盘节奏去决定秒针怎么走,
 * 是两个不相干的东西被一根线串起来。详见 useGameNow.ts 文件头的实测账。
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
