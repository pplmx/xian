/**
 * 0~1 夹取 —— 一件小事,但脏值会静默吃掉整条 CSS。
 *
 * `Math.max(0, Math.min(1, NaN))` 是 `NaN`;把它拼进 `width: NaN%`,
 * 浏览器会把那条样式整条丢掉:进度条不出现,控制台干净。坏档与除零都会
 * 造出这种值,所以「脏值归零」是这条判据真正要守的东西。
 */
import { describe, expect, it } from "vite-plus/test";
import { unitRatio } from "./unitRatio";

describe("unitRatio · 夹到 0~1", () => {
  it("区间内的值原样通过", () => {
    expect(unitRatio(0)).toBe(0);
    expect(unitRatio(0.42)).toBe(0.42);
    expect(unitRatio(1)).toBe(1);
  });

  it("越界按边界夹", () => {
    expect(unitRatio(-3)).toBe(0);
    expect(unitRatio(17)).toBe(1);
    expect(unitRatio(-0.001)).toBe(0);
    expect(unitRatio(1.001)).toBe(1);
  });

  it("脏值归零 —— 不许把 NaN 放给 CSS", () => {
    expect(unitRatio(Number.NaN)).toBe(0);
    expect(unitRatio(Number.POSITIVE_INFINITY)).toBe(0);
    expect(unitRatio(Number.NEGATIVE_INFINITY)).toBe(0);
    // 反证:裸夹取确实会把 NaN 放过去(这就是这条判据存在的理由)
    expect(Math.max(0, Math.min(1, Number.NaN))).toBeNaN();
  });

  it("结果可以直接当比例用 —— 拼出来不会是 NaN%", () => {
    for (const dirty of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2]) {
      const css = `${unitRatio(dirty) * 100}%`;
      expect(css).not.toContain("NaN");
      expect(Number.parseFloat(css)).toBeGreaterThanOrEqual(0);
      expect(Number.parseFloat(css)).toBeLessThanOrEqual(100);
    }
  });
});
