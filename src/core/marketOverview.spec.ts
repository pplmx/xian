import { describe, expect, it } from "vite-plus/test";
import type { BountySlot } from "@/data/bounty";
import { pillDef } from "@/data/pills";
import { bountyStatus, marketOverview, type MarketHoldings } from "./marketOverview";

const ORDER = (over: Partial<BountySlot>): BountySlot => ({
  idx: 0,
  kind: "herb",
  kindId: "herb",
  target: 30,
  tier: 0,
  reward: { m: 1, e: 0 },
  extra: 0,
  claimed: false,
  ...over,
});

const HOLDINGS = (over: Partial<MarketHoldings> = {}): MarketHoldings => ({
  herbs: 0,
  ore: 0,
  pills: {},
  bagTiers: [],
  ...over,
});

describe("坊市 · 悬赏能否交货", () => {
  it("材料刚好够就亮可交，差一件就报出缺口", () => {
    const order = ORDER({ kind: "herb", target: 30 });
    expect(bountyStatus(order, HOLDINGS({ herbs: 30 }))).toEqual({
      claimed: false,
      ready: true,
      shortfall: null,
      shortText: null,
    });
    expect(bountyStatus(order, HOLDINGS({ herbs: 29 }))).toMatchObject({
      ready: false,
      shortfall: { need: 30, have: 29, label: "灵草" },
      shortText: "需 30 灵草,缺 1",
    });
  });

  it("丹药按真实药名报缺口，不把 id 印给玩家", () => {
    const id = "p_jvqisan";
    const name = pillDef(id)?.name ?? "";
    expect(name, "夹具丹药必须在药表里").not.toBe("");
    const status = bountyStatus(
      ORDER({ kind: "pill", kindId: id, target: 3 }),
      HOLDINGS({ pills: { [id]: 1 } }),
    );
    expect(status.shortfall).toEqual({ need: 3, have: 1, label: name });
    expect(status.shortText).toBe(`需 3 ${name},缺 2`);
  });

  it("贡器只认够阶兵刃；够一柄即可交，不够时点明门槛", () => {
    const order = ORDER({ kind: "equip", kindId: "", target: 1, tier: 9 });
    expect(bountyStatus(order, HOLDINGS({ bagTiers: [8, 9, 12] }))).toMatchObject({
      ready: true,
      shortfall: null,
    });
    expect(bountyStatus(order, HOLDINGS({ bagTiers: [7, 8] }))).toMatchObject({
      ready: false,
      shortfall: { need: 1, have: 0, label: "≥9 阶兵刃" },
      shortText: "缺一件 ≥9 阶兵刃",
    });
  });

  it("已交的单不再报缺货，也不计入可交数", () => {
    const claimed = ORDER({ claimed: true });
    expect(bountyStatus(claimed, HOLDINGS())).toEqual({
      claimed: true,
      ready: false,
      shortfall: null,
      shortText: null,
    });
    expect(marketOverview([], [claimed], HOLDINGS(), 0).claimableBounties).toBe(0);
  });
});

describe("坊市 · 卷首市况", () => {
  it("可买只数未售货，可交分贡器与一键两类，寄售读真实格数", () => {
    const orders = [
      ORDER({ idx: 0, kind: "herb", target: 30 }),
      ORDER({ idx: 1, kind: "pill", kindId: "p_jvqisan", target: 3 }),
      ORDER({ idx: 2, kind: "equip", kindId: "", target: 1, tier: 9 }),
      ORDER({ idx: 3, kind: "ore", target: 30, claimed: true }),
    ];
    const overview = marketOverview(
      [{ sold: false }, { sold: true }, { sold: false }],
      orders,
      HOLDINGS({
        herbs: 30,
        pills: { p_jvqisan: 3 },
        bagTiers: [10],
      }),
      2,
    );
    expect(overview).toEqual({
      availableGoods: 2,
      claimableBounties: 3,
      autoClaimableBounties: 2,
      consignCount: 2,
    });
  });
});
