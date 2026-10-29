import { describe, expect, it } from "vite-plus/test";
import { REALMS, WORLDS } from "@/data/realms";
import {
  realmCodexCurrent,
  realmCodexInitialWorld,
  realmCodexWorldRows,
  realmCodexWorldStatus,
} from "./realmCodex";

describe("界域志 · 此刻与卷目", () => {
  it("当前境、全路序号与本界序号同源", () => {
    const atZhenxian = realmCodexCurrent(9);
    expect(atZhenxian.def.name).toBe("真仙");
    expect(atZhenxian.world.name).toBe("仙界");
    expect(atZhenxian.globalPosition).toBe(10);
    expect(atZhenxian.worldPosition).toBe(1);
    expect(atZhenxian.worldTotal).toBe(5);
    expect(atZhenxian.previous?.def.name).toBe("渡劫");
    expect(atZhenxian.next?.def.name).toBe("玄仙");

    const atXuanxian = realmCodexCurrent(10);
    expect(atXuanxian.worldPosition).toBe(2);
    expect(atXuanxian.previous?.def.name).toBe("真仙");
    expect(atXuanxian.next?.def.name).toBe("金仙");
  });

  it("四界卷目保持正序,并逐界报已渡 / 当前 / 未至", () => {
    const rows = realmCodexWorldRows(9);
    expect(rows.map((row) => row.world.id)).toEqual(["mortal", "immortal", "god", "chaos"]);
    expect(rows.map((row) => row.state)).toEqual(["past", "current", "future", "future"]);
    expect(rows.map((row) => row.entered)).toEqual([9, 1, 0, 0]);
    expect(rows.map((row) => row.total)).toEqual([9, 5, 4, 3]);
    expect(rows.flatMap((row) => row.realms).map((cell) => cell.index)).toEqual(
      REALMS.map((_, index) => index),
    );
    expect(rows.map(realmCodexWorldStatus)).toEqual(["已渡 9/9", "行至 1/5", "未至", "未至"]);
  });

  it("首境与末境没有越界的前后链接", () => {
    const first = realmCodexCurrent(0);
    expect(first.previous).toBeNull();
    expect(first.next?.def.name).toBe("筑基");

    const last = realmCodexCurrent(REALMS.length - 1);
    expect(last.def.name).toBe("混沌道祖");
    expect(last.next).toBeNull();
    expect(last.previous?.def.name).toBe("混沌神魔");
  });

  it("坏档里的越界 / 非整数 / 非有限值都夹回合法境界", () => {
    expect(realmCodexCurrent(-99).index).toBe(0);
    expect(realmCodexCurrent(999).index).toBe(REALMS.length - 1);
    expect(realmCodexCurrent(10.9).index).toBe(10);
    expect(realmCodexCurrent(Number.NaN).index).toBe(0);
    expect(realmCodexInitialWorld(999)).toBe(WORLDS.at(-1)?.id);
    expect(realmCodexInitialWorld(Number.NaN)).toBe(WORLDS[0]?.id);
  });
});
