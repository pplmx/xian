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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useMarketStore } from "./market";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { MARKET_REFRESH_SECONDS, MARKET_SLOTS, type MarketSlot } from "@/data/market";
import type { EquipmentInstance } from "@/types";
import { gn, toNum } from "@/utils/gnum";

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

  it("坏档格号先校验再认号:缺号格不顶掉好货,寄卖格号重复重排", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    market.sync(Date.now());
    // 坏档:第 0、1 格同号 idx 0
    market.stock = market.stock.map((g, i) => ({ ...g, idx: i === 1 ? 0 : g.idx }));
    market.sanitize();
    const idxs = market.stock.map((g) => g.idx).sort((a, z) => a - z);
    expect(new Set(idxs).size, "货架格号互异").toBe(market.stock.length);
    // 寄卖:两笔同号 slot 0
    const inventory = useInventoryStore();
    for (const uid of ["c1", "c2"]) {
      inventory.addEquipment({
        uid,
        templateId: "w_zhuqing",
        quality: "mortal",
        tier: 3,
        level: 0,
        affixes: [],
      });
      expect(market.consignEquip(uid, Date.now()), "预置寄卖入格").toBe("ok");
    }
    market.consign = market.consign.map((p) => ({ ...p, slot: 0 }));
    market.sanitize();
    const slots = market.consign.map((p) => p.slot).sort((a, z) => a - z);
    expect(slots, "寄卖格号重排互异且不越界").toEqual([0, 1]);
  });

  /**
   * 跨过换货窗口时点下「买」:屏幕上还是旧架,`sync` 却整架换新。
   * 若照旧按 idx 扣钱,玩家买下的是他没看过的那件(灵石照扣,装备品质还按新的
   * `(stockedAt, idx)` 再生)。宁可不成,让他按新货再买。
   */
  it("跨过换货窗口时买下:不成交、不扣灵石、不入袋", () => {
    seedPlayerAndFunds();
    const market = useMarketStore();
    const resources = useResourcesStore();
    const inventory = useInventoryStore();
    market.sync(Date.now());
    market.stockedAt = 0; // 屏幕上画的还是这架旧货,但已过窗口
    resources.spiritStone = gn(100);
    const oldShelf = market.stock;

    expect(market.buy(0)).toBe("expired");
    expect(market.stock, "已整架换新").not.toBe(oldShelf);
    expect(oldShelf[0]!.sold, "旧架那格不动").toBe(false);
    expect(toNum(resources.spiritStone), "灵石一枚不扣").toBe(100);
    expect(
      Object.values(inventory.pills).every((n) => n === 0),
      "也不入袋",
    ).toBe(true);
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

  it("买装备的落袋原子性:入包失败要退回灵石,不许「花了钱没拿到货」", () => {
    // 采购前有 bagFull 预检,但「预检到落袋」之间可能被同一帧别的掉落挤满 ——
    // 防御臂必须是:addEquipment 返回 false 时退回灵石、返回 bagfull、不标 sold。
    const src = readFileSync(resolve(__dirname, "market.ts"), "utf-8");
    expect(src).toContain("admitted = inventory.addEquipment");
    expect(src, "入包失败要退回灵石").toContain("resources.addStone(slot.price);");
    expect(src, "回退后要返回 bagfull").toContain('return "bagfull";');
    expect(src, "失败分支不得走到标 sold").toMatch(
      /admitted = inventory\.addEquipment[\s\S]{0,200}return "bagfull";/,
    );
  });
});
