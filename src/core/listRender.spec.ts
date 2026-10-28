import { describe, expect, it } from "vite-plus/test";
import { listWindow, nextListLimit } from "./listRender";

const items = Array.from({ length: 120 }, (_, i) => i);

describe("长列表渐进窗口", () => {
  it("只切显示窗口，完整清单与顺序留原地", () => {
    const all = [...items];
    const page = listWindow(all, 40);
    expect(page.visible).toEqual(items.slice(0, 40));
    expect(page.shown).toBe(40);
    expect(page.hidden).toBe(80);
    expect(all).toEqual(items);
  });

  it("limit 夹在 0 与真实件数之间，小数向下取整", () => {
    expect(listWindow(items, 999).visible).toEqual(items);
    expect(listWindow(items, -3).visible).toEqual([]);
    expect(listWindow(items, Number.NaN).visible).toEqual([]);
    expect(listWindow(items, 2.9).visible).toEqual([0, 1]);
  });

  it("再开一批后报出剩余件数", () => {
    expect(nextListLimit(40, 120, 24)).toBe(64);
    expect(nextListLimit(110, 120, 24)).toBe(120);
  });

  it("清单变短时窗口直接收口，不留下过期的露出量", () => {
    expect(nextListLimit(80, 12, 24)).toBe(12);
    expect(nextListLimit(40, 0, 24)).toBe(0);
  });

  it("批量为脏值时仍至少前进一步", () => {
    expect(nextListLimit(40, 120, 0)).toBe(41);
    expect(nextListLimit(40, 120, -24)).toBe(41);
    expect(nextListLimit(40, 120, Number.NaN)).toBe(41);
    expect(nextListLimit(40, 120, Number.POSITIVE_INFINITY)).toBe(41);
  });
});
