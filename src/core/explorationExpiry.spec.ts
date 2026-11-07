/**
 * 际遇阻塞与这一程的收尾 —— 两个数谁先到,决定玩家等多久。
 *
 * ## 抓到的死结
 *
 * `tickExploration` 里「待处理事件」那一支排在「到点收尾」**之前**,而且它以
 * `return` 结束。于是:
 *
 *   际遇最多阻塞 `EVENT_AUTO_RESOLVE_SECONDS`(120 秒);
 *   一趟历练的收尾只看 `endsAt`。
 *
 * 若一趟只剩 30 秒时撞上际遇,`now >= endsAt` 会成立 —— 可那行在事件分支的
 * `return` 底下,永远走不到。真浏览器实测(390×844):
 *
 * ```text
 * 余 00分00秒        ← 整趟倒计时已经归零
 * 逾时默选 · 余 01分39秒   ← 而弹窗还要压一分半
 * ```
 *
 * 这一趟就那么僵着:不收尾、不出「上一程」、也不能再交兵。玩家唯一的出路是
 * 等事件超时 —— 而那 120 秒里他甚至看不出「这一程已经结束了」。
 *
 * ## 修的口径
 *
 * 收尾认的是「时间到了」,不是「手上没有事」。故到点判断提到最前,并且:
 * 还挂着的事件按超时同一条路当场结清(奖励照拿,只是不再等他点),
 * 然后照常 `stopExploration("complete")` —— 结账、「上一程」、track 一样不少。
 */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { tickExploration } from "./exploration";
import { useAdventureStore } from "@/stores/adventure";
import { usePlayerStore } from "@/stores/player";
import { useSettingsStore } from "@/stores/settings";
import { EVENT_AUTO_RESOLVE_SECONDS } from "@/data/constants";

vi.mock("@/utils/random", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/utils/random")>();
  return {
    ...mod,
    rng: {
      next: () => 0.5,
      int: (_a: number, b: number) => b,
      float: (a: number, _b: number) => a,
      pick: <T>(arr: readonly T[]): T => arr[0]!,
      weighted: <T>(arr: readonly T[]): T => arr[0]!,
      chance: (): boolean => true,
    },
  };
});

/** 战斗恒判负:本文件只测「到点收没收尾」,不测战斗 */
vi.mock("./combat", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./combat")>();
  return {
    ...mod,
    resolveCombat: () => ({ win: false, rounds: 5, playerHpPct: 0.4 }),
    makeEnemySnap: () => ({ hp: 100, def: 10, atk: 10 }),
  };
});

const NOW = 1_800_000_000_000;

function seedTrip(input: { endsInMs: number; pendingEventId?: string; pendingSinceMs?: number }) {
  const adventure = useAdventureStore();
  useSettingsStore().dndEvents = false;
  adventure.setSession({
    regionId: "qingyun",
    mode: "normal",
    startedAt: NOW - 60_000,
    endsAt: NOW + input.endsInMs,
    nextBattleAt: NOW + 900_000,
    wins: 4,
    losses: 1,
    events: 1,
    stoneGain: { m: 120, e: 4 },
    expGain: { m: 30, e: 5 },
    itemGain: 2,
    wudaoGain: 3,
    dustGain: 40,
  });
  if (input.pendingEventId) {
    adventure.setPendingEvent(input.pendingEventId, NOW - (input.pendingSinceMs ?? 0));
  }
  return adventure;
}

describe("际遇阻塞时,这一程到点了必须收尾", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("测度", { roots: [] } as never);
  });

  it("回归:事件还压着时到点 —— 收尾必须发生,不许卡在弹窗里", () => {
    /*
     * 这一条就是那个死结的复现:endsAt 已过,而事件才压了 5 秒(离 120 秒的超时
     * 还早)。修之前 tickExploration 直接 return,会话一直挂着 ——
     * 真浏览器里就是「余 00分00秒」配「逾时默选 · 余 01分39秒」。
     */
    const adventure = seedTrip({
      endsInMs: -1_000,
      pendingEventId: "ev_spring",
      pendingSinceMs: 5_000,
    });
    tickExploration(NOW, 0);
    expect(adventure.session, "到点了却没结束这一程 —— 玩家会卡在际遇弹窗里").toBeNull();
    expect(adventure.pendingEventId, "收尾时挂着的际遇要当场结清,不留给下一页").toBeNull();
    expect(adventure.lastTrip, "收尾要留下「上一程」的回执").not.toBeNull();
  });

  it("收尾时把事件按超时同一条路结清:仍计一次际遇,奖励照拿", () => {
    const adventure = seedTrip({
      endsInMs: -1_000,
      pendingEventId: "ev_spring",
      pendingSinceMs: 5_000,
    });
    tickExploration(NOW, 0);
    const trip = adventure.lastTrip;
    expect(trip, "没有回执,判据会空转").not.toBeNull();
    // 事件算进了这一程的「际遇 N 次」,而不是被静默丢掉
    expect(trip!.events, "收尾时结清的那次际遇该计进这一趟").toBeGreaterThan(1);
    expect(trip!.reason).toBe("complete");
  });

  it("没有待处理事件时,到点收尾照旧(别把正常路径改坏)", () => {
    const adventure = seedTrip({ endsInMs: -1_000 });
    tickExploration(NOW, 0);
    expect(adventure.session).toBeNull();
    expect(adventure.lastTrip?.reason).toBe("complete");
  });

  it("没到点就一动不动的:事件压着就是压着", () => {
    const adventure = seedTrip({
      endsInMs: 600_000,
      pendingEventId: "ev_spring",
      pendingSinceMs: 5_000,
    });
    tickExploration(NOW, 0);
    expect(adventure.session, "还早得很,不该收尾").not.toBeNull();
    expect(adventure.pendingEventId, "事件没超时,不该被代选").toBe("ev_spring");
    expect(adventure.lastTrip).toBeNull();
  });

  it("事件超时而这一程没到点:照旧自动结算,不收尾", () => {
    const adventure = seedTrip({
      endsInMs: 600_000,
      pendingEventId: "ev_spring",
      pendingSinceMs: (EVENT_AUTO_RESOLVE_SECONDS + 5) * 1000,
    });
    tickExploration(NOW, 0);
    expect(adventure.session, "这一程还长,不该收尾").not.toBeNull();
    expect(adventure.pendingEventId, "超时事件该被自动结算").toBeNull();
    expect(adventure.lastTrip).toBeNull();
  });
});
