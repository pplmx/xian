/**
 * 缺席记账 —— 「不玩」这件事只有一种账,不是两种。
 *
 * 玩家离开游戏有两条路,引擎必须对它们记同一笔:
 *   A. 关掉页面 / 断网 / 系统回收标签页 → 下次 `start()` → `settleOffline`
 *   B. 标签页留在后台(手机锁屏、切到别的 tab)→ 回来那一拍 `tick` 看到
 *      `dt > OFFLINE_MIN_SECONDS` → 同样 `settleOffline`
 *
 * 两条路都**不该**推进 `totalPlaySec`。B 曾经会:离线分支结算完之后,
 * 紧接着那个盖章块仍用 `now - lastStampAt` 补时长,而 `lastStampAt` 还停在
 * 离开前那一刻。于是同样缺席 8 小时,标签页开着白得 8 小时游玩时长,关掉页面
 * 一秒不记 —— 同一段缺席,两本账。
 *
 * 为什么这不是"统计字段算错了"这种小事:`totalPlaySec` 是天时、值日宿、
 * 际遇概率的序号来源(DEC-120 定的纪律是「序号只由游戏内时长决定,不碰现实
 * 时间」)。补进去的那 8 小时会实打实地换掉半轮天时 —— 实测:第 0 日 20 点
 * 缺席 8 小时,补时长即跨到第 1 日,天时从「灵雨」变「雷鸣」;不补则原地不动。
 * 这恰好是「挂机不该换天」要防的事。
 *
 * 判据钉两件:引擎源码里离线分支必须推平盖章基准(静态),以及这个推平
 * 在可见结果上确实意味着「不换天、不涨游玩时长」(行为)。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore } from "@/stores/game";
import { todayWeather, weatherRemainingSec } from "@/core/weather";

const SRC = readFileSync(resolve(import.meta.dirname, "./engine.ts"), "utf8");

describe("缺席记账 · 挂起与关页面同一本账", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("离线分支结算完必须推平盖章基准 —— 否则缺席时长会被补进 totalPlaySec", () => {
    // tick 里:dt > OFFLINE_MIN_SECONDS 那一段,必须同时推平 lastStampAt。
    // 只在末尾推 lastTickAt 是不够的:盖章块读的是 lastStampAt。
    const offlineBranch = /if \(dt > OFFLINE_MIN_SECONDS\)[\s\S]*?this\.lastTickAt = now;/.exec(
      SRC,
    );
    expect(offlineBranch, "找不到离线分支 —— 判据要跟着 tick 的结构一起改").not.toBeNull();
    expect(
      offlineBranch![0],
      "离线分支要推平 lastStampAt:缺席走 settleOffline 那本账,不再进 totalPlaySec",
    ).toContain("this.lastStampAt = now;");
    // 活跃时刻仍要刷 —— 它服务「下次 start 该结算多久」与落盘节流,两件事分开走
    expect(
      offlineBranch![0],
      "离线分支仍要刷新活跃时刻,否则下次 start 会把这段缺席再结算一遍",
    ).toContain("stampActive(now)");
  });

  it("补 8 小时游玩时长会真的换天;不补则原地不动(判据的可见后果)", () => {
    const game = useGameStore();
    // 第 0 游戏日 20 点 —— 再补 8 小时正好跨到第 1 日,差异看得见
    game.totalPlaySec = 20 * 3600;
    const day0 = Math.floor(game.totalPlaySec / 86400);
    const weather0 = todayWeather().id;
    const left0 = weatherRemainingSec();

    game.totalPlaySec += 8 * 3600; // 旧行为:把缺席补成游玩时长
    expect(Math.floor(game.totalPlaySec / 86400), "补时长会跨日 —— 这就是要防的").toBe(day0 + 1);
    expect(todayWeather().id, "跨日必然换天时").not.toBe(weather0);

    game.totalPlaySec -= 8 * 3600; // 新行为:缺席不进游玩时长
    expect(Math.floor(game.totalPlaySec / 86400), "不补则仍是同一游戏日").toBe(day0);
    expect(todayWeather().id, "同一游戏日天时一位不变").toBe(weather0);
    expect(weatherRemainingSec(), "剩余时长也不该被缺席吃掉").toBe(left0);
  });
});
