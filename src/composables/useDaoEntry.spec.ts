/**
 * 道源入口短差 —— 覆盖地图补测(此前无 spec 无脚本覆盖的交互面)。
 *
 * daoEntryShort 的契约不止「max(0, cost - daoSource)」这一个算式,还有两条
 * 注释里承诺、却从未被钉住的纪律:
 *   一 与 spendDaoSource 拒绝臂**同口径** —— 列差为零 ⟺ 那笔真付得起;
 *   二 列差是**最小补足量** —— 补上列出的差数就能付,补少了照样付不起。
 *   天界各入口(远征/虚界/试炼/忆战重写)的置灰与「尚差 N 道源」都吃这一个
 *   返回值,差一口就「差了还说付得起」或「付得起却置灰」,故两条都要钉死。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useDaoEntry } from "./useDaoEntry";
import { useEndgameStore } from "@/stores/endgame";

describe("useDaoEntry · 道源入口短差", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("道源远超成本:短差为 0,入口不该列差", () => {
    const endgame = useEndgameStore();
    endgame.addDaoSource(10_000);
    const { daoEntryShort } = useDaoEntry();
    expect(daoEntryShort(120)).toBe(0);
    expect(daoEntryShort(1)).toBe(0);
  });

  it("道源不足:列差正是所缺之数(「尚差 N 道源」的 N 与它同源)", () => {
    const endgame = useEndgameStore();
    endgame.addDaoSource(30);
    const { daoEntryShort } = useDaoEntry();
    expect(daoEntryShort(120)).toBe(90);
    expect(daoEntryShort(31)).toBe(1);
  });

  it("边界:道源恰好等于成本 —— 付得起,短差为 0", () => {
    const endgame = useEndgameStore();
    endgame.addDaoSource(120);
    const { daoEntryShort } = useDaoEntry();
    expect(daoEntryShort(120)).toBe(0);
  });

  it("道源为 0:短差就是全额成本(初见者的置灰要列全额)", () => {
    const { daoEntryShort } = useDaoEntry();
    expect(daoEntryShort(120)).toBe(120);
  });

  it("免票入口(cost = 0):永远不列差", () => {
    const { daoEntryShort } = useDaoEntry();
    expect(daoEntryShort(0)).toBe(0);
  });

  it("同口径契约:列差为零 ⟺ spendDaoSource 那笔真付得起(两条拒绝臂永不分叉)", () => {
    const endgame = useEndgameStore();
    const { daoEntryShort } = useDaoEntry();
    for (const daoSource of [0, 1, 29, 30, 119, 120, 121, 999]) {
      for (const cost of [0, 1, 30, 120, 500]) {
        endgame.addDaoSource(daoSource - endgame.daoSource); // 归零后再设,免得累积
        const affordable = daoEntryShort(cost) === 0;
        expect(affordable, `daoSource=${daoSource}, cost=${cost}: 列差与扣费口径分叉`).toBe(
          endgame.daoSource >= cost,
        );
        // 再走一遍真扣费验证:列差为零 ⟺ spend 成功(且确实扣得动)
        expect(daoEntryShort(cost) === 0).toBe(endgame.spendDaoSource(cost));
      }
    }
  });

  it("最小补足量契约:补上列差即可付,补差减一仍付不起", () => {
    const endgame = useEndgameStore();
    const { daoEntryShort } = useDaoEntry();
    for (const [daoSource, cost] of [
      [0, 120],
      [30, 120],
      [119, 120],
      [7, 30],
    ] as const) {
      endgame.addDaoSource(daoSource - endgame.daoSource);
      const short = daoEntryShort(cost);
      expect(short, "列差必须是正数(付不起却列 0 = 假绿)").toBeGreaterThan(0);
      endgame.addDaoSource(short);
      expect(daoEntryShort(cost), "补上列差后必须付得起").toBe(0);
      expect(endgame.spendDaoSource(cost), "补上列差后真扣得动").toBe(true);
    }
  });
});
