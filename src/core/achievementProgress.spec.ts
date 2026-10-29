import { describe, expect, it } from "vite-plus/test";
import type { AchievementDef, AchvCond } from "@/types";
import { achievementProgressRows, nearestAchievementRows } from "./achievementProgress";

function def(id: string, cond: AchvCond): AchievementDef {
  return { id, name: id, desc: id, cond };
}

const state = {
  achieved: [] as string[],
  counters: { kills: 12 },
  major: 9,
  maxQualityRank: 6,
};

describe("成就进度 · 从条件与当前状态派生", () => {
  it("计数器给出当前值、目标值与剩余数", () => {
    const [row] = achievementProgressRows(
      [def("kills", { type: "counter", key: "kills", value: 50 })],
      state,
    );
    expect(row).toMatchObject({
      done: false,
      current: 12,
      target: 50,
      gap: 38,
      percent: 24,
      label: "12 / 50",
    });
  });

  it("境界进度从当前大境指向目标大境", () => {
    const [row] = achievementProgressRows([def("realm", { type: "realm", major: 10 })], state);
    expect(row).toMatchObject({
      current: 9,
      target: 10,
      gap: 1,
      label: "真仙 → 玄仙",
    });
  });

  it("品质进度读当前最高持有品质，不另写一张品质表", () => {
    const [row] = achievementProgressRows([def("quality", { type: "quality", rank: 7 })], state);
    expect(row).toMatchObject({
      current: 6,
      target: 7,
      gap: 1,
      label: "现持 天品 → 仙品",
    });
  });

  it("custom 条件不给假百分比，达成后仍由 achieved 真值收口", () => {
    const rows = achievementProgressRows(
      [def("custom", { type: "custom", key: "stone1m" })],
      state,
    );
    expect(rows[0]).toMatchObject({
      done: false,
      ratio: 0,
      percent: null,
      gap: null,
      label: "条件达成时自动结算",
    });

    const [done] = achievementProgressRows([def("custom", { type: "custom", key: "stone1m" })], {
      ...state,
      achieved: ["custom"],
    });
    expect(done).toMatchObject({ done: true, ratio: 1, percent: 100, label: "已达成" });
  });

  it("眼下可追只取未达成且可量化的项，按完成比例排序", () => {
    const rows = achievementProgressRows(
      [
        def("kills50", { type: "counter", key: "kills", value: 50 }),
        def("explores10", { type: "counter", key: "explores", value: 10 }),
        def("kills100", { type: "counter", key: "kills", value: 100 }),
        def("custom", { type: "custom", key: "stone1m" }),
        def("done", { type: "counter", key: "kills", value: 1 }),
      ],
      {
        achieved: ["done"],
        counters: { kills: 12, explores: 9 },
        major: 0,
        maxQualityRank: 0,
      },
    );
    expect(nearestAchievementRows(rows, 3).map((row) => row.def.id)).toEqual([
      "explores10",
      "kills50",
      "kills100",
    ]);
    expect(nearestAchievementRows(rows, 0)).toEqual([]);
  });
});
