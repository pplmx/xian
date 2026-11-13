import { describe, expect, it } from "vite-plus/test";
import { cultivationStageOf } from "./cultivationStage";

describe("修行阶段 · 首页只报此刻最该知道的一件事", () => {
  it("破境条件已齐时，关口压过闭关与伤势状态", () => {
    expect(
      cultivationStageOf({
        expFull: true,
        breakthroughReady: true,
        breakthroughReason: "",
        retreating: true,
        injured: true,
      }),
    ).toEqual({
      key: "gate",
      label: "关隘已开",
      hint: "修为圆满，破境条件已齐 —— 下一步就在下方。",
    });
  });

  it("修为圆满但条件未齐时，原样交代拦因", () => {
    expect(
      cultivationStageOf({
        expFull: true,
        breakthroughReady: false,
        breakthroughReason: "灵气不足",
        retreating: false,
        injured: false,
      }),
    ).toEqual({
      key: "full",
      label: "修为已满",
      hint: "修为已到本境尽头；还需过「灵气不足」这一关。",
    });
  });

  it("伤势先于闭关，未闭关时回落为吐纳", () => {
    expect(
      cultivationStageOf({
        expFull: false,
        breakthroughReady: false,
        breakthroughReason: "修为未满",
        retreating: false,
        injured: true,
      }),
    ).toMatchObject({ key: "injured", label: "带伤行功" });

    expect(
      cultivationStageOf({
        expFull: false,
        breakthroughReady: false,
        breakthroughReason: "修为未满",
        retreating: true,
        injured: false,
      }),
    ).toMatchObject({ key: "retreat", label: "闭关中" });

    expect(
      cultivationStageOf({
        expFull: false,
        breakthroughReady: false,
        breakthroughReason: "修为未满",
        retreating: false,
        injured: false,
      }),
    ).toMatchObject({ key: "flow", label: "吐纳中" });
  });
});

/*
 * 到顶不许把终点当关卡。
 *
 * `breakthroughReason` 在到顶时是「已至大道尽头」——它说的是**为什么不能破**,
 * 不是「还差哪一道门」。原先直接拼进 `还需过「${reason}」这一关`,玩家读到的是
 * 「还需过「已至大道尽头」这一关」:把终局状态写成了一道门。
 */
describe("修行阶段 · 已至大道尽头", () => {
  it("到顶:说「大道已尽」,不说「还需过『已至大道尽头』这一关」", () => {
    const stage = cultivationStageOf({
      expFull: true,
      breakthroughReady: false,
      breakthroughReason: "已至大道尽头",
      atMaxRealm: true,
      retreating: false,
      injured: false,
    });
    expect(stage.label, "标签该说尽头").toBe("大道已尽");
    expect(stage.hint, "把终点当关卡了").not.toContain("还需过");
    expect(stage.hint, "把终点当关卡了").not.toContain("已至大道尽头」这一关");
    expect(stage.hint).toContain("尽头");
  });

  it("未到顶 + 修为已满:照旧报「还需过某一关」", () => {
    const stage = cultivationStageOf({
      expFull: true,
      breakthroughReady: false,
      breakthroughReason: "灵气不足",
      atMaxRealm: false,
      retreating: false,
      injured: false,
    });
    expect(stage.label).toBe("修为已满");
    expect(stage.hint, "没到顶就该说清差哪一关").toContain("还需过「灵气不足」这一关");
  });
});
