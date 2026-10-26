/**
 * 归来结算 · 只读页连内存里的账都不结。
 *
 * 存储层的闸只挡落盘。寄卖到期、弟子归来这些「打开页面顺手结掉」的账若不拦住,
 * 只读页会照常把灵石加到内存里、弹出「灵石到账」,而这些都是假的 ——
 * 那一页的横幅正写着「进度不会保存」。判据盯两件事:
 *   ① 写者页照旧结算(不是把功能关掉换绿灯);
 *   ② 只读页一件都不动,连货架都不换。
 */
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { settleReturn } from "./useReturnSettle";
import { saveReader } from "@/core/singleWriter";
import { useMarketStore } from "@/stores/market";
import { useResourcesStore } from "@/stores/resources";
import { gn } from "@/utils/gnum";

const stoneOf = (): number => {
  const s = useResourcesStore().spiritStone;
  return s.m * 10 ** s.e;
};

/** 一份已到期、尚未收账的寄卖 */
function seedDueConsign(): void {
  useMarketStore().consign = [
    {
      slot: 0,
      tier: 3,
      qualityRank: 1,
      price: gn(4000),
      finishAt: Date.now() - 60_000,
      name: "旧铁剑",
    },
  ];
}

describe("归来结算 · 只读页", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saveReader.value = false;
    seedDueConsign();
    const resources = useResourcesStore();
    resources.spiritStone = gn(0);
  });

  it("写者页照旧:到期寄卖卖掉、灵石入账、格子清空", () => {
    const out = settleReturn(Date.now());
    expect(out.sold).toEqual(["旧铁剑"]);
    expect(stoneOf()).toBeGreaterThan(0);
    expect(useMarketStore().consign).toHaveLength(0);
  });

  it("只读页:一件都不动 —— 不卖、不入账、提示清单为空", () => {
    const before = useMarketStore().stockedAt;
    saveReader.value = true;
    const out = settleReturn(Date.now());
    expect(out.sold, "只读页不许通报「已自售」").toEqual([]);
    expect(out.reaped, "只读页不许通报弟子归来").toEqual([]);
    expect(stoneOf(), "只读页的灵石不该动").toBe(0);
    expect(useMarketStore().consign, "寄卖还留在原处(等真正在玩的那一页来收)").toHaveLength(1);
    expect(useMarketStore().stockedAt, "货架也不该在只读页换新").toBe(before);
  });

  it("判据自证:同一份夹具在写者页会动 —— 上面那条不是恒真句", () => {
    settleReturn(Date.now());
    seedDueConsign();
    saveReader.value = true;
    expect(stoneOf()).toBeGreaterThan(0);
    expect(settleReturn(Date.now()).sold).toEqual([]);
    expect(stoneOf(), "只读那一拍之后余额一分没涨").toBe(4000);
  });
});
