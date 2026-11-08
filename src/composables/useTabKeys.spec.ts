import { describe, expect, it } from "vite-plus/test";
import { tabKeyTarget } from "./useTabKeys";

describe("页签栏方向键 · 索引怎么绕", () => {
  it("向右到头回第一个", () => {
    expect(tabKeyTarget("ArrowRight", 2, 3).index).toBe(0);
    expect(tabKeyTarget("ArrowRight", 0, 3).index).toBe(1);
  });

  it("向左到头回最后一个 —— 少个 +count 会算出 -1", () => {
    // 这条正是复制两份时最容易改漏的地方:(-1 + count) 与 (-1) 差一个 count
    expect(tabKeyTarget("ArrowLeft", 0, 3).index).toBe(2);
    expect(tabKeyTarget("ArrowLeft", 2, 3).index).toBe(1);
  });

  it("Home / End 到首尾", () => {
    expect(tabKeyTarget("Home", 5, 10).index).toBe(0);
    expect(tabKeyTarget("End", 5, 10).index).toBe(9);
  });

  it("别的键不归它管", () => {
    for (const key of ["Enter", " ", "ArrowUp", "a"]) {
      expect(tabKeyTarget(key, 1, 3), `${key} 不该被拦`).toEqual({ index: -1, handled: false });
    }
  });

  it("一页都没有时不越界 —— 空列表不该算出 0", () => {
    // count=0 时 (0+1)%0 是 NaN、(-1+0)%0 也是 NaN,必须提前挡掉
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(tabKeyTarget(key, 0, 0), `${key} 在空列表上`).toEqual({ index: -1, handled: false });
    }
  });

  it("只有一页时方向键原地不动,但仍算处理过", () => {
    expect(tabKeyTarget("ArrowRight", 0, 1)).toEqual({ index: 0, handled: true });
    expect(tabKeyTarget("ArrowLeft", 0, 1)).toEqual({ index: 0, handled: true });
  });
});
