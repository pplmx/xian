/**
 * 坊市悬赏板 store —— 订单生成/换版、交货入账、坏档修形。
 *
 * 定价与换版在 core/bountyService(纯);这里守编排:
 *   · sync 按墙钟换版、窗口内不动;
 *   · 募材/募丹验货扣货入账,贡器按所交品质现算;
 *   · sanitize 烂纸丢弃、时刻夹回非负。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useBountyStore } from "./bounty";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import type { BountySlot } from "@/data/bounty";
import { stoneByTier } from "@/core/formulas";
import { MARKET_MAT_STONE_UNITS } from "@/data/market";
import { gn, toNum } from "@/utils/gnum";

function seedPlayerAndFunds(): void {
  const p = usePlayerStore();
  p.initCharacter("测试道友", { roots: [] } as never);
  useResourcesStore().addSmall("herb", 100);
  useResourcesStore().addSmall("ore", 100);
  useResourcesStore().addStone(gn(1e12));
}

describe("悬赏板 store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sync:首回生成一版四单;窗口内不重复换版", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    const t0 = Date.now();
    b.sync(t0);
    expect(b.orders.length).toBeGreaterThanOrEqual(1);
    const at = b.bountyAt;
    b.sync(t0 + 1000);
    expect(b.bountyAt).toBe(at);
  });

  it("交货募材:扣库存入账,盖已交;量不够则拒", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    useResourcesStore().spendSmall("herb", 100); // 清空 herb,只留 ore
    const t = Date.now();
    b.sync(t);
    const herb = b.orders.find((o) => o.kind === "herb")!;
    const stoneBefore = toNum(useResourcesStore().spiritStone);
    // herb 已被清空 → 交不起
    expect(b.claim(herb.idx)).toBe("insufficient");
    // 交 ore(有货)→ 成
    const ore = b.orders.find((o) => o.kind === "ore")!;
    expect(b.claim(ore.idx)).toBe("ok");
    expect(ore.claimed).toBe(true);
    expect(toNum(useResourcesStore().spiritStone)).toBeGreaterThan(stoneBefore);
  });

  it("贡一柄够阶兵刃:现算入账,离包", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    const inventory = useInventoryStore();
    inventory.addEquipment({
      uid: "e1",
      templateId: "w_zhuqing",
      quality: "fine",
      tier: 3,
      level: 0,
      affixes: [],
    });
    const t = Date.now();
    b.sync(t);
    const equip = b.orders.find((o) => o.kind === "equip")!;
    expect(b.claim(equip.idx)).toBe("ok");
    expect(inventory.findItem("e1")).toBeUndefined();
    expect(equip.claimed).toBe(true);
  });

  it("claimEquip 交玩家点选的那一件,不顺着取第一件", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    const inventory = useInventoryStore();
    // 一件旧凡品 + 一件刚重铸的高阶,订单只要求「够阶」 —— 若顺取第一件
    // (行囊插入序)会把高阶的情头好悄悄顺走;点选轨就该交玩家挑的那件。
    inventory.addEquipment({
      uid: "old1",
      templateId: "w_zhuqing",
      quality: "fine",
      tier: 3,
      level: 0,
      affixes: [],
    });
    inventory.addEquipment({
      uid: "treasure",
      templateId: "w_zhuqing",
      quality: "divine",
      tier: 5,
      level: 0,
      affixes: [],
    });
    const t = Date.now();
    b.sync(t);
    const equip = b.orders.find((o) => o.kind === "equip")!;
    expect(b.claimEquip(equip.idx, "treasure")).toBe("ok");
    expect(inventory.findItem("treasure")).toBeUndefined();
    expect(inventory.findItem("old1")).not.toBeUndefined();
    expect(equip.claimed).toBe(true);
  });

  it("悬赏灵草价受货架购价约束:每株恒低于坊市货架购入价,「买来再交悬赏」无利可图", () => {
    seedPlayerAndFunds();
    const p = usePlayerStore();
    const b = useBountyStore();
    b.sync(Date.now());
    const herb = b.orders.find((o) => o.kind === "herb")!;
    const perHerb = toNum(herb.reward) / herb.target;
    // 真实购入锚是坊市货架的 stoneByTier(..,6),不是灵草坊 herbBuyPrice —— 后者与玩家实购价脱节,
    // 曾经正是这条错锚让「买草→交悬赏」成为无本套利。现改为对真实购价断言。
    const buyP = toNum(stoneByTier(p.major, MARKET_MAT_STONE_UNITS));
    expect(perHerb, "悬赏每株不可高于坊市货架购入价").toBeLessThan(buyP);
    expect(perHerb).toBeGreaterThan(0);
  });

  it("sanitize:烂单丢弃,只剩合法单,时刻夹回非负", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    b.orders = [
      {
        idx: 0,
        kind: "herb",
        kindId: "herb",
        target: 5,
        tier: 0,
        reward: gn(50),
        extra: 0,
        claimed: false,
      } as BountySlot,
      { garbage: true } as never,
      { kind: "nope" } as never,
    ];
    b.bountyAt = -3;
    b.sanitize();
    expect(b.bountyAt).toBe(0);
    expect(b.orders.length).toBe(1);
    expect(b.orders[0]!.kind).toBe("herb");
  });

  /**
   * 跨过换版窗口时点下「交货」:屏幕上还是旧单,`sync` 却整版换新。
   * 若照旧按 idx 交货,扣的是玩家的货、成交的是**他没看过的新单**(新单收的货
   * 与赏格都可能不同)。宁可不成,让玩家按新单再点。
   */
  it("坏档重复单号重排:两张单都交得了,好货不被缺号顶掉", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    b.sync(Date.now());
    // 坏档:两张单同号 idx 1(生成器确定性 → kind 依序恒 herb/ore/pill/equip)
    const list = b.orders.map((o, i) => ({ ...o, idx: i < 2 ? 1 : i }));
    b.orders = list;
    b.sanitize();
    // 重排后 4 张单 idx 互异、连续覆盖 0..3 —— 两张「同号」单都还找得到
    const idxs = b.orders.map((o) => o.idx).sort((a, z) => a - z);
    expect(idxs, "单号互异").toEqual([0, 1, 2, 3]);
    expect(
      b.orders.map((o) => o.kind),
      "四张单一张不少",
    ).toEqual(["herb", "ore", "pill", "equip"]);
  });

  it("跨过换版窗口时按下交货:不成交,也不扣货", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    const res = useResourcesStore();
    // 先上一版(玩家正看着这屏旧单),再把上货时刻推到窗口之外
    b.sync(Date.now());
    b.bountyAt = 0;
    res.spendSmall("herb", 100); // 先清空,精确断言不扣
    res.addSmall("herb", 30);
    const oldList = b.orders;
    const oldOrder = oldList[0]!;

    expect(b.claim(0)).toBe("expired");
    expect(oldOrder.claimed, "旧单不动").toBe(false);
    expect(res.herb, "货一株不许扣").toBe(30);
    expect(b.orders, "已整版换新").not.toBe(oldList);
    expect(b.orders.includes(oldOrder), "旧单一纸不留").toBe(false);
  });

  it("贡器点选跨过换版窗口:同样不成交、不扣兵刃", () => {
    seedPlayerAndFunds();
    const b = useBountyStore();
    const inventory = useInventoryStore();
    inventory.addEquipment({
      uid: "race-eq",
      templateId: "w_zhuqing",
      quality: "fine",
      tier: 3,
      level: 0,
      affixes: [],
    });
    // 先上一版(玩家正对着旧单点选),再把上货时刻推到窗口之外
    b.sync(Date.now());
    b.bountyAt = 0; // 屏幕上是旧版,已过换版窗口
    const oldList = b.orders;

    expect(b.claimEquip(3, "race-eq")).toBe("expired");
    expect(inventory.findItem("race-eq"), "兵刃不许离包").not.toBeUndefined();
    expect(b.orders, "已整版换新").not.toBe(oldList);
  });
});
