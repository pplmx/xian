/**
 * 坊市 store —— 货架生成/购买、寄卖自售、即时售丹料,随存档持久化。
 *
 * 定价与货架生成在 core/marketService(纯);这里守编排:
 *   · sync 按墙钟换货、不重复生成;
 *   · buy 次序(满包先验再扣款)、生计照付;
 *   · 寄卖离包即定、到时辰自售入账;
 *   · sanitize 逐格修形,坏格整格丢弃。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useMarketStore } from "./market";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { MARKET_REFRESH_SECONDS, MARKET_SLOTS, type MarketSlot } from "@/data/market";
import type { EquipmentInstance } from "@/types";
import { gn } from "@/utils/gnum";

function seedPlayerAndFunds(): void {
  const p = usePlayerStore();
  p.initCharacter("测试道友", { roots: [] } as never);
  useResourcesStore().addStone(gn(1e12));
}

describe("坊市 store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sync:首回生成一满架;窗口未过不重复生成", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    const t0 = Date.now();
    market.sync(t0);
    expect(market.stock.length).toBe(MARKET_SLOTS);
    const first = market.stockedAt;
    market.sync(t0 + 1000); // 未过期
    expect(market.stockedAt).toBe(first);
    expect(market.stock.length).toBe(MARKET_SLOTS);
  });

  it("sync:过窗换货,货架重新填满", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    market.sync(Date.now());
    const first = market.stockedAt;
    market.sync(first + MARKET_REFRESH_SECONDS * 1000 + 1);
    expect(market.stockedAt).not.toBe(first);
    expect(market.stock.length).toBe(MARKET_SLOTS);
  });

  it("buy:灵石照付,货架格子标售罄;没钱则拒", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    const res = useResourcesStore();
    market.sync(Date.now());
    const slot = market.stock[0]!;
    const before = res.spiritStone;
    const r = market.buy(slot.idx);
    expect(r).toBe("ok");
    expect(JSON.stringify(market.stock[0]!.sold)).toBe("true");
    expect(JSON.stringify(res.spiritStone)).not.toBe(JSON.stringify(before));
  });

  it("sanitize:坏格整格丢弃,只剩合法格,时刻夹回非负", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    // 手造一格合法 pill + 一坨垃圾
    market.stock = [
      {
        kind: "pill",
        idx: 0,
        pillId: "p_jvqisan",
        count: 1,
        price: gn(100),
        sold: false,
      } as MarketSlot,
      { garbage: true } as never,
      { kind: "nope" } as never,
    ];
    market.stockedAt = -5;
    market.sanitize();
    expect(market.stockedAt).toBe(0);
    expect(market.stock.length).toBe(1);
    expect((market.stock[0] as { kind: "pill" }).kind).toBe("pill");
  });

  it("寄卖:满 2 格拒收;到时辰自售入账并清格", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    const inventory = useInventoryStore();
    const res = useResourcesStore();
    const inst: EquipmentInstance = {
      uid: "e1",
      templateId: "w_zhuqing",
      quality: "mortal",
      tier: 3,
      level: 0,
      affixes: [],
    };
    inventory.addEquipment(inst);
    const t = Date.now();
    expect(market.consignEquip("e1", t)).toBe("ok");
    expect(inventory.findItem("e1")).toBeUndefined(); // 离包即定
    const stoneBefore = JSON.stringify(res.spiritStone);
    market.collectConsign(t + 10_000_000); // 早已到时辰
    expect(JSON.stringify(res.spiritStone)).not.toBe(stoneBefore); // 入账
    expect(market.consign.length).toBe(0); // 格清
  });
});
