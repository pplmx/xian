import { describe, expect, it } from "vite-plus/test";
import { celestialOverview } from "./celestialOverview";

describe("天界卷首总账", () => {
  it("只按已知世界与试炼计数,旧档里的陌生键和零胜不冒充进度", () => {
    const overview = celestialOverview({
      daoChosen: true,
      worldIds: ["chiyan", "xingyun", "chiyan"],
      worldClears: { chiyan: 2, xingyun: 0, unknown: 9 },
      worldRun: null,
      trialIds: ["qisha", "pojun"],
      trialRecords: { qisha: { clears: 1 }, pojun: { clears: 0 }, unknown: { clears: 5 } },
      daily: null,
      dailyDoneDay: null,
      marksCount: 4,
      marksTotal: 60,
    });

    expect(overview.worldsTotal).toBe(2);
    expect(overview.worldsCleared).toBe(1);
    expect(overview.trialsTotal).toBe(2);
    expect(overview.trialsCleared).toBe(1);
    expect(overview.marksRemaining).toBe(56);
  });

  it("远征在途与今日天道各报自己的真实状态", () => {
    const overview = celestialOverview({
      daoChosen: true,
      worldIds: ["chiyan"],
      worldClears: {},
      worldRun: { layer: 2, rows: [{}, {}, {}] },
      trialIds: ["qisha"],
      trialRecords: {},
      daily: { day: 20261030 },
      dailyDoneDay: null,
      marksCount: 0,
      marksTotal: 60,
    });

    expect(overview.activeRun).toBe(true);
    expect(overview.runLayer).toBe(2);
    expect(overview.runFights).toBe(3);
    expect(overview.dailyState).toBe("ready");
  });

  it("今日天道已过、未生成与未择道时分别说清", () => {
    const base = {
      daoChosen: true,
      worldIds: [],
      worldClears: {},
      worldRun: null,
      trialIds: [],
      trialRecords: {},
      marksCount: 0,
      marksTotal: 60,
    } as const;

    expect(celestialOverview({ ...base, daily: { day: 7 }, dailyDoneDay: 7 }).dailyState).toBe(
      "done",
    );
    expect(celestialOverview({ ...base, daily: null, dailyDoneDay: 7 }).dailyState).toBe(
      "unavailable",
    );
    expect(
      celestialOverview({
        ...base,
        daoChosen: false,
        daily: { day: 7 },
        dailyDoneDay: null,
      }).daoChosen,
    ).toBe(false);
  });

  it("道痕数量夹在卷册上限内,满卷只由真实总数决定", () => {
    const atCap = celestialOverview({
      daoChosen: true,
      worldIds: [],
      worldClears: {},
      worldRun: null,
      trialIds: [],
      trialRecords: {},
      daily: null,
      dailyDoneDay: null,
      marksCount: 99,
      marksTotal: 60,
    });
    const malformed = celestialOverview({
      ...atCap,
      daoChosen: true,
      worldIds: [],
      worldClears: {},
      worldRun: null,
      trialIds: [],
      trialRecords: {},
      daily: null,
      dailyDoneDay: null,
      marksCount: Number.NaN,
      marksTotal: 60,
    });

    expect(atCap.marksCount).toBe(60);
    expect(atCap.marksRemaining).toBe(0);
    expect(atCap.marksFull).toBe(true);
    expect(malformed.marksCount).toBe(0);
    expect(malformed.marksFull).toBe(false);
  });
});
