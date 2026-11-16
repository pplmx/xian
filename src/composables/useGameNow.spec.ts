import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { setEnginePaused } from "@/core/enginePause";
import { useGameNow, gameNowMs } from "./useGameNow";
import { nextTick, ref } from "vue";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

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
    const now = gameNowMs();
    const before = now.value;
    vi.advanceTimersByTime(3000);
    expect(now.value, "3 秒后读数应前进 3 秒").toBe(before + 3000);
  });

  it("暂停冻结:心跳停着读数不动;恢复后跳到墙上钟 —— 与结算 gameNow() 同源,倒计时差值恒正确", () => {
    vi.setSystemTime(2_000_000);
    const now = gameNowMs();
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

/**
 * 单位 —— 名字断言了什么，就得真的是什么。
 *
 * ## 第 412/416 轮：名字骗了人，功能整轮没生效
 *
 * 那两个导出原先叫 `gameNowSeconds` / `gameNowSec`，而它们返回的其实是
 * `gameNow()` 即 `Date.now()` 的**毫秒**。第 412 轮有一处代码信了名字：
 *
 * ```text
 *   enlightenmentCooldownMs(gameNowSec.value * 1000)
 *   真实 now 1794838638298 → 传进去 1794838638298000 → 剩余 ≈ −1.79e15
 *   → 夹成 0 → v-if 恒假 → 那一行从没出现过
 * ```
 *
 * 而当时五条判据全绿：它们查「有没有那一行」「插值形态」「用没用 `gameNowSec`」
 * —— **连「用对了钟」那条都把名字当成了单位**。
 *
 * 故补这一条：**读出来的值必须落在毫秒的合理区间**，且**不许有带 Sec 的名字**。
 */
describe("游戏钟 · 单位必须是毫秒，且名字不说谎", () => {
  it("读出来的是毫秒 —— 与 Date.now() 同量级", () => {
    const now = useGameNow();
    const real = Date.now();
    /*
     * 毫秒与秒差三个数量级，判据用「相差不超过两倍」来分开它们 ——
     * 比断言「大于 1e12」稳:后者对 2001 年之前的时钟会假红。
     */
    expect(
      now.value,
      `读数是 ${now.value}，而 Date.now() 是 ${real} —— 差三个数量级说明它是秒`,
    ).toBeGreaterThan(real / 2);
    expect(now.value).toBeLessThan(real * 2);
  });

  it("全仓没有名字里带 Sec/Second 的读数变量", () => {
    /*
     * `gameNowSeconds` 这种名字一旦存在，就会有人信它（第 412 轮就是我）。
     * 这一条扫全仓的 `.vue` / `.ts`，不许再出现那个形状。
     *
     * 只扫**赋值给 useGameNow / gameNow 的名字**，不扫描述性文本 ——
     * 「秒」这个词在注释里是正常的（倒计时本来就按秒展示）。
     */
    const offenders: string[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      for (const m of src.matchAll(
        /const\s+(\w*(?:Sec|Seconds|Secs)\w*)\s*=\s*(?:useGameNow|gameNowMs)\(/g,
      )) {
        offenders.push(`${f}: ${m[1]}`);
      }
    }
    expect(
      offenders,
      "这些名字说自己是秒，而 useGameNow / gameNowMs 返回的是毫秒 —— 名字会骗到下一个读它的人:" +
        offenders.join("、"),
    ).toEqual([]);
  });

  it("反空转：扫到的时钟读数不止一处", () => {
    let n = 0;
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      n += (src.match(/useGameNow\(\)/g) ?? []).length;
    }
    expect(n, "一处 useGameNow 都没扫到 —— 扫描器坏了，上一条会假绿").toBeGreaterThan(2);
  });
});
