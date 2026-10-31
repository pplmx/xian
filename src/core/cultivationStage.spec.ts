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
