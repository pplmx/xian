import { describe, expect, it } from "vite-plus/test";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TITLES } from "@/data/titles";
import type { AchvCond, AchievementDef, TitleDef } from "@/types";
import { nearestTitleProgressRows, titleProgressRows } from "./titleProgress";

function title(id: string): TitleDef {
  return { id, name: id, desc: `${id} desc`, mods: {} };
}

function achievement(id: string, titleId: string, cond: AchvCond): AchievementDef {
  return { id, name: id, desc: `${id} desc`, cond, reward: { titleId } };
}

const state = {
  achieved: [] as string[],
  counters: { kills: 5 },
  major: 1,
  maxQualityRank: 0,
};

describe("名号进度 · 从发放成就派生", () => {
  it("按 reward.titleId 把名号与成就对齐,不另写一张来源表", () => {
    const rows = titleProgressRows(
      [title("t1"), title("t2"), title("t3")],
      [
        achievement("a1", "t1", { type: "counter", key: "kills", value: 10 }),
        achievement("a2", "t2", { type: "realm", major: 2 }),
        achievement("orphan", "missing", { type: "realm", major: 3 }),
      ],
      state,
    );

    expect(rows.map((row) => [row.def.id, row.source.id])).toEqual([
      ["t1", "a1"],
      ["t2", "a2"],
    ]);
    expect(rows[0]?.progress.label).toBe("5 / 10");
  });

  it("实际名号表每一项都能追到发放成就,没有静默孤儿", () => {
    const rows = titleProgressRows(TITLES, ACHIEVEMENTS, state);

    expect(rows).toHaveLength(TITLES.length);
    expect(rows.map((row) => row.def.id)).toEqual(TITLES.map((def) => def.id));
    expect(rows.map((row) => row.source.reward?.titleId)).toEqual(TITLES.map((def) => def.id));
  });

  it("下一顶只取未拥有者,可量化进度优先,没有进度的排后兜底", () => {
    const rows = titleProgressRows(
      [title("t1"), title("t2"), title("t3")],
      [
        achievement("a1", "t1", { type: "counter", key: "kills", value: 10 }),
        achievement("a2", "t2", { type: "realm", major: 2 }),
        achievement("a3", "t3", { type: "custom", key: "lifespan10k" }),
      ],
      state,
    );

    expect(nearestTitleProgressRows(rows, new Set(["t2"]), 2).map((row) => row.def.id)).toEqual([
      "t1",
      "t3",
    ]);
    expect(nearestTitleProgressRows(rows, new Set(["t1", "t2", "t3"]), 2)).toEqual([]);
  });
});
