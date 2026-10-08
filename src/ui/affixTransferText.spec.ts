/**
 * 词条转移文案 —— 每种「接不了」的落位提示,逐条钉字。
 * 判据变了但忘了改嘴,这里红;文案与 core 判据分离,符合 eventText / codex 一类惯例。
 */
import { describe, expect, it } from "vite-plus/test";
import { transferBlockText, TRANSFER_NEEDS_TEXT } from "./affixTransferText";

describe("transferBlockText", () => {
  it("每类落位都有话可说,且带词条名", () => {
    expect(transferBlockText("same", "atk1")).toContain("同一件");
    expect(transferBlockText("noAffix", "atk1")).toContain("锋锐"); // affixDef('atk1').name
    expect(transferBlockText("noTemplate", "atk1")).toContain("件形失效");
    expect(transferBlockText("slot", "atk1")).toContain("部位");
    expect(transferBlockText("rank", "atk1")).toContain("品质");
    expect(transferBlockText("dup", "atk1")).toContain("已有");
    expect(transferBlockText("noLanding", "atk1")).toContain("不在目标上");
    expect(transferBlockText("full", "atk1")).toContain("已满");
    expect(transferBlockText("stack", "atk1")).toContain("递减");
    expect(transferBlockText("sealFull", "atk1")).toContain("封满");
  });

  it("短判语:缺灵石 / 缺器尘分列", () => {
    expect(TRANSFER_NEEDS_TEXT.stone).toBe("灵石不足");
    expect(TRANSFER_NEEDS_TEXT.dust).toBe("器灵尘不足");
  });
});
