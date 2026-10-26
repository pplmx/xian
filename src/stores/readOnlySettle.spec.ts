/**
 * 只读页 · 按墙钟结算的 store 写入一律不发生。
 *
 * 只在 App 启动那一拍拦是不够的:坊市页与收徒页自己也调 sync / collectConsign /
 * collectFinished,还各挂一个每秒的定时器。闸必须长在 store 里 —— 这组用例直接
 * 调那五个方法,不经过 App,正是为了让「换个入口又漏」这件事被挡住。
 */
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { saveReader } from "@/core/singleWriter";
import { useApprenticeStore } from "@/stores/apprentice";
import { useBountyStore } from "@/stores/bounty";
import { useMarketStore } from "@/stores/market";
import { useResourcesStore } from "@/stores/resources";
import { gn } from "@/utils/gnum";

const stoneOf = (): number => {
  const s = useResourcesStore().spiritStone;
  return s.m * 10 ** s.e;
};

/** 一份已到期的寄卖 + 一版该换了的货架/悬赏 */
function seedDueWork(): void {
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
  useMarketStore().stockedAt = 0;
  useBountyStore().bountyAt = 0;
}

describe("只读页 · store 层的结算闸", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saveReader.value = false;
    seedDueWork();
    useResourcesStore().spiritStone = gn(0);
  });

  it("只读页:寄卖不自售、货架不换新、悬赏不换版", () => {
    saveReader.value = true;
    const now = Date.now();
    expect(useMarketStore().collectConsign(now), "不许通报已自售").toEqual([]);
    useMarketStore().sync(now);
    useBountyStore().sync(now);
    expect(stoneOf()).toBe(0);
    expect(useMarketStore().consign).toHaveLength(1);
    expect(useMarketStore().stockedAt, "货架不该在只读页换新").toBe(0);
  });

  it("只读页:不白送弟子、不收割归来", () => {
    saveReader.value = true;
    const apprentice = useApprenticeStore();
    apprentice.sync();
    expect(apprentice.apprentices, "只读页不该凭空空降一名弟子").toHaveLength(0);
    expect(apprentice.collectFinished(Date.now(), 3)).toEqual([]);
  });

  it("写者页照旧:同一份夹具会动 —— 上面两条不是恒真句", () => {
    const now = Date.now();
    expect(useMarketStore().collectConsign(now)).toEqual(["旧铁剑"]);
    useMarketStore().sync(now);
    const apprentice = useApprenticeStore();
    apprentice.sync();
    expect(stoneOf()).toBe(4000);
    expect(useMarketStore().consign).toHaveLength(0);
    expect(useMarketStore().stockedAt).toBeGreaterThan(0);
    expect(apprentice.apprentices.length).toBeGreaterThan(0);
  });
});
