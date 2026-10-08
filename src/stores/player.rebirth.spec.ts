/**
 * 转世「新的一世」—— 本世进程清零、跨世记忆保留(ISS-015 / TASK-009)
 *
 * 边界(与 DEC-003 对齐):
 *   - 必清:连胜/当日巡游/进行中的秘境/进行中的区域事件 —— 它们属「这一世」的当下
 *   - 保留:区域兴衰与战绩(「成长改变世界」的世界记忆)、机缘选择记忆
 *     (fortuneChoices,「世界记得你的选择」)、奇遇连锁(eventChains)
 *   - 清权不清忆:镇压**权益**(收益/资格)随皮囊散去(妖气复聚),regionStats 战绩仍留
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerStore, type PlayerStore } from "@/stores/player";
import { useDongfuStore } from "@/stores/dongfu";
import { REGIONS } from "@/data/regions";
import { settleSuppressedRegions } from "@/core/suppress";
import { rng } from "@/utils/random";
import type { SecretRealmState } from "@/core/secretRealm";

function seedPlayer(p: PlayerStore): void {
  p.winStreak = 7;
  p.lastCaveEventDay = 5;
  p.secretRealm = {
    realmId: "sr_kurong",
    enteredAt: 1,
    layer: 2,
    wins: 5,
    losses: 0,
    spoils: [],
    rules: [],
    carriedHpPct: 1,
    finished: false,
  } as SecretRealmState;
  p.regionEvent = { regionId: "qingyun", eventId: "ev_raiders", endsAt: 9e15 } as never;
  // 跨世记忆:全保留
  p.suppressedRegions = ["qingyun"];
  p.fortuneChoices = { ft_sword_remnant: "take" };
  p.eventChains = { old_man_stone: 2 };
}

describe("player.rebirth 转世状态重置", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("清空本世进程:连胜/当日巡游/秘境/区域事件", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    seedPlayer(p);

    p.rebirth({ roots: [] } as never);

    expect(p.winStreak).toBe(0);
    expect(p.lastCaveEventDay).toBe(0);
    expect(p.secretRealm).toBeNull();
    expect(p.regionEvent).toBeNull();
  });

  it("保留「世界记得你」的记忆,但镇压**权益**随皮囊散去", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    seedPlayer(p);

    p.rebirth({ roots: [] } as never);

    // 镇压权益(收益/资格)是「我拥有多少」,不跨世 —— 妖气复聚(见 DEC-003 修订)
    expect(p.suppressedRegions).toEqual([]);
    expect(p.suppressedSince).toEqual({});
    expect(p.suppressQualified).toEqual([]);
    // 「世界记得你的选择」:机缘取/弃记忆不随转世清空
    expect(p.fortuneChoices).toEqual({ ft_sword_remnant: "take" });
    expect(p.eventChains).toEqual({ old_man_stone: 2 });
    // 「成长改变世界」:区域战绩(regionStats)仍记住你 —— 只清权益,不清世界记忆
    expect(p.regionStats).not.toBeUndefined();
  });

  /**
   * 「灵魂/记忆留下,外物归零」:灵兽、洞府建筑、灵脉投资都是外物,
   * 不得随转世带走 —— 否则每一世都从半成品起步,「重新经历」名存实亡。
   */
  it("外物归零:灵兽/洞府建筑/灵脉投资", () => {
    const p = usePlayerStore();
    const dongfu = useDongfuStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    p.setPet("pet_yueying");
    dongfu.setLevel("field", 8);
    dongfu.setLevel("library", 6);
    dongfu.setVeinMain("gather");
    dongfu.addVeinPoint("gather", 30);
    dongfu.addVeinPoint("insight", 12);

    p.rebirth({ roots: [] } as never);

    expect(p.petId, "灵兽应随皮囊散去").toBeNull();
    expect(dongfu.levels.field, "洞府建筑应归零").toBe(0);
    expect(dongfu.levels.library).toBe(0);
    expect(dongfu.veinMain, "灵脉主脉应清空").toBeNull();
    expect(
      Object.values(dongfu.veinPoints).every((v) => v === 0),
      "灵脉投点应清零",
    ).toBe(true);
  });

  /**
   * 宿命传承的效果必须在**出生那一刻**真的落地(ISS-302 的后半)。
   * 此前传承只被 addHeritage 记下,效果一个都没接 —— 玩家看到的是一张空头支票。
   */
  it("宿命传承「元婴凝实」:出生境界下限抬到筑基", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    p.rebirth({ roots: [] } as never);
    expect(p.major, "没有传承时出生即炼气").toBe(0);

    p.addHeritage("yuanying");
    p.rebirth({ roots: [] } as never);
    expect(p.major, "有元婴凝实:睁眼即筑基").toBe(1);
    expect(p.sub).toBe(0);
  });

  it("传承的「每世一次」:持有才能用,用满即止,转世后重置", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    // 没持有 → 用不了
    expect(p.consumeHeritageUse("dubu")).toBe(false);
    p.addHeritage("dubu");
    expect(p.consumeHeritageUse("dubu"), "首次应可用").toBe(true);
    expect(p.consumeHeritageUse("dubu"), "用满一次即止").toBe(false);
    // 转世重置:下一世又能用
    p.rebirth({ roots: [] } as never);
    expect(p.consumeHeritageUse("dubu"), "转世后重置").toBe(true);
    // 丹心:本世可用三次
    p.addHeritage("danxin");
    expect(p.consumeHeritageUse("danxin", 3)).toBe(true);
    expect(p.consumeHeritageUse("danxin", 3)).toBe(true);
    expect(p.consumeHeritageUse("danxin", 3)).toBe(true);
    expect(p.consumeHeritageUse("danxin", 3)).toBe(false);
  });
});

/**
 * 转世 × 镇压 —— 旧世压下的高阶远境,不能在新世继续按旧阶位派发装备。
 *
 * 病灶:镇压权益(kind: state)曾整档跨世,新世炼气还在领旧世仙境的 20+ 阶装备,
 * 数值当场爆炸(玩家实报「低境界刷低副本掉远超当前的装备」)。
 * 修法:转世即「妖气复聚」—— 镇压权益随皮囊散去,区域回到历练地;
 * 战绩(regionStats)仍随神魂不灭,「世界记得你」的叙事不丢。
 */
describe("转世不残留产出型镇压", () => {
  /** 高阶远境(minRealm>0),新世炼气根本打不进:选仙界以上一境 */
  function seedFarSuppress(p: PlayerStore): string {
    const far = REGIONS.filter((r) => r.minRealm >= 9)[0]!;
    p.suppressedRegions = [far.id, "qingyun"];
    p.suppressedSince = { [far.id]: 12345, qingyun: 67890 };
    p.suppressQualified = [far.id, "qingyun"];
    return far.id;
  }

  it("转世后,上一世镇压的远境应已复聚:结算不再为其派发装备", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    const far = seedFarSuppress(p);
    expect(p.suppressedRegions).toContain(far);

    p.rebirth({ roots: [] } as never);

    // 镇压权益不该跨世 —— 复聚回历练地
    expect(p.suppressedRegions).not.toContain(far);
    // 即便结算跑起来,也绝无旧世远境的高阶装备漏出来
    expect(settleSuppressedRegions(3 * 3600, rng)).toBeNull();
  });

  it("宿敌与区域战绩是「我是谁」,仍随神魂不灭(转世不清)", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    seedFarSuppress(p);
    p.rebirth({ roots: [] } as never);
    expect(p.suppressedRegions).toHaveLength(0);
    expect(p.suppressQualified).toHaveLength(0);
    expect(Object.keys(p.suppressedSince)).toHaveLength(0);
  });

  it("老档兜底:修复前已转世的存档,读档时远境镇压照清(不然还得再转一次世)", () => {
    const p = usePlayerStore();
    p.initCharacter("测试道友", { roots: [] } as never);
    // 模拟修复上线前的旧档:境界 0(已然转世),却带着高界远境的镇压列表
    const far = seedFarSuppress(p);
    p.sanitize();
    // 这一世(境界 0)根本打不进那个远境 —— 妖气复聚;本世合法的 qingyun(minRealm 0)原样留
    expect(p.suppressedRegions).toEqual(["qingyun"]);
    expect(p.suppressQualified).toEqual(["qingyun"]);
    expect(Object.keys(p.suppressedSince)).toEqual(["qingyun"]);
    expect(p.suppressedRegions).not.toContain(far);
  });
});
