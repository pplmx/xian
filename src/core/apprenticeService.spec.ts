/**
 * 收徒产出 —— 纯计算判据(apprenticeSpoils / taskDone)。
 *
 * 守三件事:
 *   · 天赋门类产出 ×APPRENTICE_TALENT_BONUS(数值字段 floor);
 *   · 寻宝给整数枚丹药,天赋加成用 ceil(否则 1 枚基座 floor 后天赋整场失活,
 *     开局白送的 ap_lingtong 正是 talent='seek' —— 见 ISS 修为/寻宝);
 *   · 任务完工只看墙钟 finishAt。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  apprenticeOverview,
  apprenticeRoster,
  apprenticeSpoils,
  apprenticeTaskProgress,
  taskDone,
  type OwnedApprentice,
} from "./apprenticeService";

function apprentice(over: Partial<OwnedApprentice> = {}): OwnedApprentice {
  return {
    uid: "u",
    archId: "ap_lingtong",
    level: 1,
    bond: 0,
    task: null,
    ...over,
  };
}

describe("apprenticeSpoils 天赋加成", () => {
  it("数值类天赋门类 ×1.25 取 floor:采药灵童采药 Lv1 得 7 草", () => {
    // ap_luanniao talent=herb;herb 基础 4 + level*2 = 6;6×1.25=7.5 → floor 7
    const s = apprenticeSpoils("ap_luanniao", "herb", 0, 1);
    expect(s.herb).toBe(7);
  });

  it("非天赋门类照基础:采药灵童采矿 Lv1 得 5 铁", () => {
    // ore 基础 3 + 2 = 5;mult=1
    const s = apprenticeSpoils("ap_luanniao", "ore", 0, 1);
    expect(s.ore).toBe(5);
  });

  it("寻宝天赋(寻宝灵童)在 1 枚基座上用 ceil 显出差值:得 2 枚而非常规 1 枚", () => {
    // ap_lingtong talent=seek;寻宝基础 pillCount=1;ceil(1×1.25)=2
    const talented = apprenticeSpoils("ap_lingtong", "seek", 0, 1);
    expect(talented.pillCount).toBe(2);
    // 非寻宝天赋(采药灵童)照旧 1 枚
    const plain = apprenticeSpoils("ap_luanniao", "seek", 0, 1);
    expect(plain.pillCount).toBe(1);
  });
});

describe("taskDone", () => {
  it("按墙钟 finishAt 判完工", () => {
    const a = apprentice({
      task: { spec: "seek", startAt: 1000, finishAt: 2000 },
    });
    expect(taskDone(a, 1000)).toBe(false);
    expect(taskDone(a, 2000)).toBe(true);
  });
});

describe("门庭今日", () => {
  it("在途、闲置与最近归期只从弟子列表算一次", () => {
    const overview = apprenticeOverview([
      apprentice({ uid: "idle" }),
      apprentice({
        uid: "later",
        task: { spec: "herb", startAt: 0, finishAt: 5000 },
      }),
      apprentice({
        uid: "sooner",
        task: { spec: "study", startAt: 0, finishAt: 3000 },
      }),
    ]);

    expect(overview).toEqual({
      total: 3,
      idle: 1,
      away: 2,
      nextReturnAt: 3000,
      nextReturnSpec: "study",
    });
  });

  it("空门庭不编造归期", () => {
    expect(apprenticeOverview([])).toEqual({
      total: 0,
      idle: 0,
      away: 0,
      nextReturnAt: null,
      nextReturnSpec: null,
    });
  });

  it("值日簿候差在前,在途按归期从近到远,同刻保留原序", () => {
    const roster = apprenticeRoster([
      apprentice({
        uid: "later",
        task: { spec: "herb", startAt: 0, finishAt: 9000 },
      }),
      apprentice({ uid: "idle-a" }),
      apprentice({
        uid: "sooner",
        task: { spec: "study", startAt: 0, finishAt: 3000 },
      }),
      apprentice({ uid: "idle-b" }),
      apprentice({
        uid: "same-time",
        task: { spec: "ore", startAt: 0, finishAt: 3000 },
      }),
    ]);

    expect(roster.map((row) => [row.apprentice.uid, row.away])).toEqual([
      ["idle-a", false],
      ["idle-b", false],
      ["sooner", true],
      ["same-time", true],
      ["later", true],
    ]);
  });
});

describe("差事进度", () => {
  it("按墙钟在起止之间推进,并把越界值夹在 0~1", () => {
    const task = { startAt: 1000, finishAt: 5000 };
    expect(apprenticeTaskProgress(task, 1000)).toBe(0);
    expect(apprenticeTaskProgress(task, 3000)).toBe(0.5);
    expect(apprenticeTaskProgress(task, 9000)).toBe(1);
  });

  it("零时长与坏值都不泄漏 NaN", () => {
    expect(apprenticeTaskProgress({ startAt: 1000, finishAt: 1000 }, 999)).toBe(0);
    expect(apprenticeTaskProgress({ startAt: 1000, finishAt: 1000 }, 1000)).toBe(1);
    expect(apprenticeTaskProgress({ startAt: Number.NaN, finishAt: 1000 }, 1000)).toBe(1);
  });
});
