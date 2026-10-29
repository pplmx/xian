import { describe, expect, it } from "vite-plus/test";
import { clearedRoutePath, smoothRoutePath } from "./routeMap";

describe("山河行旅图 · 路线笔路", () => {
  it("空路线不画笔", () => {
    expect(smoothRoutePath([])).toBe("");
  });

  it("单点只落一处", () => {
    expect(smoothRoutePath([{ x: 12, y: 30 }])).toBe("M 12 30");
  });

  it("多点以水平切线逐段相接,不在节点处折成统计图", () => {
    expect(
      smoothRoutePath([
        { x: 12, y: 52 },
        { x: 60, y: 20 },
        { x: 120.5, y: 40 },
      ]),
    ).toBe("M 12 52 C 36 52 36 20 60 20 C 90.25 20 90.25 40 120.50 40");
  });
});

describe("山河行旅图 · 已走实线", () => {
  const points = [
    { x: 12, y: 52 },
    { x: 90, y: 20 },
    { x: 288, y: 40 },
  ];

  it("没有走完一段时不画实线,避免首点就冒出一截假进度", () => {
    expect(clearedRoutePath(points, 0)).toBe("");
    expect(clearedRoutePath(points, 1)).toBe("");
  });

  it("实线停在最后一个已通节点,不按整条路线等比例越界", () => {
    expect(clearedRoutePath(points, 2)).toBe(smoothRoutePath(points.slice(0, 2)));
    expect(clearedRoutePath(points, 2)).not.toContain("288");
  });

  it("全通画完整路线,越界计数按路线长度收口", () => {
    expect(clearedRoutePath(points, 3)).toBe(smoothRoutePath(points));
    expect(clearedRoutePath(points, 99)).toBe(smoothRoutePath(points));
  });
});
