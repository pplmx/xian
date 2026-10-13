/**
 * 灵脉投资服务的核心契约 —— 修复前 UI 把主脉和副脉一刀切卡在 30,
 * UI 上主脉到不了 70、「改立主脉」没有入口。服务侧逻辑本就是 70/30 分轨,
 * 这里把服务契约锁死,杜绝 UI 与服务再分叉。
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { gn, toNum } from "@/utils/gnum";
import { investVein, investVeinBatch, switchMainVein, veinCap, veinPointCost } from "./veinService";
import { usePlayerStore } from "@/stores/player";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";

describe("灵脉投资(Phase 30.3)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.major = 2; // 金丹,灵脉开放
    useResourcesStore().spiritStone = gn(1e9); // 不限灵石
  });

  it("未定主脉时首投即成主脉,主脉可投过 30 直达 70", () => {
    const dongfu = useDongfuStore();
    expect(dongfu.veinMain).toBeNull();
    expect(veinCap("gather")).toBe(30); // 未定主脉时按副脉算

    // 连投 40 点:首投定主,之后一路投到 40(越过副脉 30 上限)
    for (let i = 0; i < 40; i += 1) investVein("gather");
    expect(dongfu.veinMain).toBe("gather");
    expect(dongfu.veinPoints.gather).toBe(40);
    expect(veinCap("gather")).toBe(70); // 主脉 70

    // 继续投到 70 仍可行,再多则拒
    for (let i = 40; i < 70; i += 1) expect(investVein("gather")).toBe(true);
    expect(dongfu.veinPoints.gather).toBe(70);
    expect(investVein("gather")).toBe(false);
  });

  it("改立主脉:付费换向,原主脉点数保留但降至副脉上限不可续投", () => {
    const dongfu = useDongfuStore();
    for (let i = 0; i < 40; i += 1) investVein("gather"); // gather 成主,40 点

    expect(switchMainVein("craft")).toBe(true);
    expect(dongfu.veinMain).toBe("craft");
    // 原主脉点数不回收:gather 保持 40,但已是副脉,再投被上限拦下
    expect(dongfu.veinPoints.gather).toBe(40);
    expect(veinCap("gather")).toBe(30);
    expect(investVein("gather")).toBe(false);
    // 新主脉 craft 可过 30
    for (let i = 0; i < 35; i += 1) expect(investVein("craft")).toBe(true);
    expect(dongfu.veinPoints.craft).toBe(35);
  });

  it("连投:一次连投 5 点,首投认主、账目逐点同源", () => {
    const dongfu = useDongfuStore();
    const res = investVeinBatch("gather", 5);
    expect(res.count).toBe(5);
    expect(res.stopped).toBe("quota");
    expect(dongfu.veinPoints.gather).toBe(5);
    expect(dongfu.veinMain).toBe("gather");
  });

  it("连投料尽止:灵石只够两点的账就只连投两点,不越权烧", () => {
    const dongfu = useDongfuStore();
    const resources = useResourcesStore();
    resources.spiritStone = gn(2 * toNum(veinPointCost())); // 只够两点
    const res = investVeinBatch("gather", 10);
    expect(res.count).toBe(2);
    expect(res.stopped).toBe("broke");
    expect(dongfu.veinPoints.gather).toBe(2);
    expect(toNum(resources.spiritStone)).toBe(0);
  });
});
