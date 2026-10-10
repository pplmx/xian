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
});
