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
import { apprenticeSpoils, taskDone, type OwnedApprentice } from "./apprenticeService";

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
    const a: OwnedApprentice = {
      uid: "u",
      archId: "ap_lingtong",
      level: 1,
      task: { spec: "seek", startAt: 1000, finishAt: 2000 },
    };
    expect(taskDone(a, 1000)).toBe(false);
    expect(taskDone(a, 2000)).toBe(true);
  });
});
