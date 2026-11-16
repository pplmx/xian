import { describe, expect, it } from "vite-plus/test";
import { formatGN, formatFollowing } from "@/utils/format";

/**
 * 进度行的分母要跟着分子的量级 —— 「14.56亿 / 29.69兆」读不出来
 *
 * 修炼页「本境修为」那一行，分子由 `TapNumber` 渲染（自带格式化），
 * 分母曾经直接 `formatGN(player.expReq)` —— 两个数各自按自己的数量级选单位。
 *
 * 玩家要回答「我还差多少」，得先知道 1 兆 = 10000 亿。而这不是一闪而过的边界:
 * 那个境界里分子 1.456e9、分母 2.969e13，比例 1:20390，
 * **99.99% 的时间都停在这个跨量级上**。
 *
 * 本仓 `AGENTS.md` 说「给决策前把数字摊开」。反过来说，摊开了却要读者自己换算，
 * 等于没摊开 —— 同一行里的两个数用两套单位，是「两本账」在**呈现**上的那一面。
 */
describe("进度行 · 分母跟随分子量级", () => {
  it("跨量级的那一对，现在同单位了", () => {
    const exp = 1.456e9; // 14.56亿
    const req = 2.969e13; // 29.69兆
    const shown = formatFollowing(req, exp);
    expect(shown, "分母没跟着分子走 —— 仍是一段亿一段兆").not.toMatch(/亿.*兆|兆.*亿/);
    expect(shown).toContain("亿");
  });

  it("同量级时行为不变 —— 不给正常情况添噪", () => {
    /*
     * 若分子分母本就同量级（或都没到万），结果必须与直接调 `formatGN` 一致。
     * 否则这一改会动到所有早期玩家的读数 —— 那是远比它要修的问题更大的扰动。
     */
    expect(formatFollowing(80, 40)).toBe(formatGN(80));
    expect(formatFollowing(3400, 1200)).toBe(formatGN(3400));
    expect(formatFollowing(2e8, 5e8)).toBe(formatGN(2e8));
    expect(formatFollowing(3e13, 4e13)).toBe(formatGN(3e13));
  });

  it("一方没到万时保持原样 —— 硬对齐会造出更糟的读数", () => {
    /*
     * 分子 5000、分母 3e13:若把 5000 写成「0兆」，那是**更糟**的读数。
     * 对齐要解决的是"两段都够大、却各选各的单位"，不是所有情况。
     */
    expect(formatFollowing(3e13, 5000)).toBe(formatGN(3e13));
  });

  it("边界不崩：0 与负值", () => {
    expect(() => formatFollowing(0, 0)).not.toThrow();
    expect(() => formatFollowing(100, 0)).not.toThrow();
    expect(() => formatFollowing(0, 1000)).not.toThrow();
    expect(formatFollowing(100, 0), "分母 0 算出了 Infinity/NaN").not.toMatch(/Infinity|NaN/);
  });
});
