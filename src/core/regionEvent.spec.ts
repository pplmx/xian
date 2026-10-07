/**
 * Phase 31.0 A2:区域动态事件 —— 临时异象,自动过期
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import {
  REGION_EVENTS,
  liveRegionEvent,
  regionEventDef,
  rollNewRegionEvent,
  type RegionEventState,
} from "./regionEvent";
import { usePlayerStore } from "@/stores/player";
import { regionDef } from "@/data/regions";
import { RandomService } from "@/utils/random";

describe("区域动态事件(regionEvent)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("事件表完整:妖潮/灵脉暴动/古墓/商队", () => {
    expect(REGION_EVENTS.map((e) => e.id)).toEqual(["yaochao", "lingmai", "gumu", "shangdui"]);
    for (const ev of REGION_EVENTS) {
      expect(ev.desc).toBeTruthy();
      expect(regionEventDef(ev.id)?.name).toBe(ev.name);
    }
  });

  it("事件按区域生效,过期自动清理", () => {
    const player = usePlayerStore();
    player.setRegionEvent({ regionId: "qingyun", eventId: "yaochao", endsAt: Date.now() + 60_000 });
    expect(player.currentRegionEvent("qingyun")?.eventId).toBe("yaochao");
    expect(player.currentRegionEvent("luoxia")).toBeNull();
    // 过期
    player.setRegionEvent({ regionId: "qingyun", eventId: "gumu", endsAt: Date.now() - 1000 });
    expect(player.currentRegionEvent("qingyun")).toBeNull();
    expect(player.regionEvent).toBeNull();
  });

  it("妖潮更险更多掉落,灵脉无额外危险", () => {
    const yaochao = regionEventDef("yaochao")!;
    expect(yaochao.dangerMult).toBeGreaterThan(1);
    expect(yaochao.rewardMult).toBeGreaterThan(1);
    const lingmai = regionEventDef("lingmai")!;
    expect(lingmai.dangerMult).toBe(1);
  });

  it("同一个机制换界域换叫法,但倍率一条不动", () => {
    // 人间界有「过路商队」,混沌海里没有 —— 文案按界域取,数值只此一份
    const mortal = regionEventDef("shangdui", 0)!;
    const chaos = regionEventDef("shangdui", 20)!;
    expect(mortal.name).toBe("商队遇袭");
    expect(chaos.name).not.toBe(mortal.name);
    expect(chaos.rewardMult).toBe(mortal.rewardMult);
    expect(chaos.dangerMult).toBe(mortal.dangerMult);
    expect(chaos.eventMult).toBe(mortal.eventMult);
    for (const id of REGION_EVENTS.map((e) => e.id)) {
      for (const major of [9, 14, 20]) {
        const def = regionEventDef(id, major)!;
        expect(def.desc, `${id} 在 ${major} 境没有自己的说法`).toBeTruthy();
        expect(def.name, `${id} 在 ${major} 境还用人间界的名字`).not.toBe(regionEventDef(id)!.name);
      }
    }
  });
});

/**
 * 纯函数那半边:判断与掷法不必起 Pinia —— 这正是把编排挪出 core 的收益。
 * 状态怎么动归 store(上面那条),能不能生效 / 怎么掷归这里的纯函数。
 */
describe("区域事件的判断与掷法可脱离 Pinia", () => {
  const ev = (regionId: string, endsAt: number): RegionEventState => ({
    regionId,
    eventId: "yaochao",
    endsAt,
  });

  it("liveRegionEvent:只认匹配且未过期的那条", () => {
    expect(liveRegionEvent(ev("qingyun", 100), "qingyun", 50)?.eventId).toBe("yaochao");
    expect(liveRegionEvent(ev("qingyun", 100), "luoxia", 50)).toBeNull();
    expect(liveRegionEvent(ev("qingyun", 40), "qingyun", 50)).toBeNull();
    expect(liveRegionEvent(null, "qingyun", 50)).toBeNull();
  });

  it("rollNewRegionEvent:已有未过期事件则不重复(掷都不掷)", () => {
    const region = regionDef("qingyun")!;
    // 固定随机源:若照常掷必出事件;这里应因"已有未过期事件"直接返回 null
    const rng = new RandomService(() => 0);
    expect(rollNewRegionEvent(region, 50, ev("qingyun", 100), rng)).toBeNull();
  });
});
