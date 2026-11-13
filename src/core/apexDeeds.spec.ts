/**
 * 此世功业 —— 「这一世到底修成了什么」。
 *
 * 满级玩家打开任何一个页面看到的都是分散的读数,而这个问题没有一处回答。
 * 这一层只读既有事实、不引入任何新资源 —— 终局已经补了两条经济线,
 * 再加一条产出会让它重新变成刷数字。
 */
import { describe, expect, it } from "vite-plus/test";
import { apexDeedSummary, apexDeeds, type ApexDeedInput } from "./apexDeeds";
import { readSource } from "@/test/readSource";

const base: ApexDeedInput = {
  trialsCleared: 0,
  trialsTotal: 10,
  marks: 0,
  marksCap: 60,
  worldsCrossed: 1,
  worldsTotal: 4,
  gongfaLearned: 0,
  gongfaTotal: 92,
  enemiesKnown: 0,
  blueprintsMastered: 0,
  worldClears: 0,
  milestonesDone: 0,
  milestonesTotal: 14,
};

describe("此世功业 · 排序", () => {
  it("最满的排前面 —— 终局玩家先看到成就,再看到余地", () => {
    const deeds = apexDeeds({ ...base, worldsCrossed: 4, trialsCleared: 5 });
    // 界域满了(4/4),应排第一档
    const worldAt = deeds.findIndex((d) => d.id === "world");
    const gongfaAt = deeds.findIndex((d) => d.id === "gongfa");
    expect(worldAt, "满的那条要排在半满前面").toBeLessThan(gongfaAt);
  });

  it("全满时全在前面,不崩", () => {
    const deeds = apexDeeds({
      ...base,
      trialsCleared: 10,
      marks: 60,
      worldsCrossed: 4,
      gongfaLearned: 92,
      milestonesDone: 14,
    });
    expect(deeds.length).toBe(8);
    expect(apexDeedSummary(deeds).done).toBeGreaterThanOrEqual(5);
  });

  it("分母为 0 时不产生 NaN", () => {
    const deeds = apexDeeds({
      ...base,
      trialsTotal: 0,
      marksCap: 0,
      gongfaTotal: 0,
      worldsTotal: 0,
    });
    for (const d of deeds) {
      expect(d.value, `${d.label} 的读数里混进了 NaN`).not.toContain("NaN");
    }
  });
});

describe("此世功业 · 只读既有事实", () => {
  it("不 import 任何 store —— 它是取景,不是又一本账", () => {
    const src = readSource("src/core/apexDeeds.ts");
    expect(src, "功业层不该认识 store").not.toContain("@/stores/");
  });

  it("不 import 任何写入口 —— 它不产出任何东西", () => {
    const src = readSource("src/core/apexDeeds.ts");
    expect(src).not.toContain("notify");
    expect(src).not.toContain("addDaoSource");
    expect(src).not.toContain("gainExp");
  });
});

describe("此世功业 · 每条都有来路", () => {
  const view = readSource("src/views/LegacyView.vue");

  it("八条读数各自读一个既有来源,不在这栏里另数一遍", () => {
    expect(view, "试炼读 trialRecords").toContain("trialRecords");
    expect(view, "道痕读 marks 与上限").toContain("MAX_MARKS");
    expect(view, "功法读 learned 与 GONGFA").toContain("GONGFA");
    // 敌手 / 器谱用 store 现成 getter,不另写「算不算洞悉」的判据
    expect(view, "敌手走现成 getter").toContain("masteredEnemyCount");
    expect(view, "器谱走现成 getter").toContain("masteredBlueprintCount");
    // 破界走现成的 totalClears,不在这里对 Record 求和
    expect(view, "破界走 totalClears").toContain("totalClears");
  });

  it("只读到顶玩家才出现 —— 未到顶不该看见这一栏", () => {
    const apexAt = view.indexOf("data-legacy-apex");
    const deedsAt = view.indexOf("data-legacy-apex-deeds");
    expect(apexAt).toBeGreaterThan(-1);
    expect(deedsAt, "功业要挂在终笔那一块里").toBeGreaterThan(apexAt);
  });
});
