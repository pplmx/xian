import { describe, expect, it } from "vite-plus/test";
import { resolve, relative } from "node:path";
import { ROOT, isVueFile, readSource, walkFiles } from "@/test/readSource";
import {
  listWindow,
  nextListLimit,
  nextRevealCount,
  previousListLimit,
  previousListStep,
} from "./listRender";

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

  it("可渲染窗口封顶:继续前翻时丢最早一批,不让 DOM 随点击无限长", () => {
    const first = listWindow(items, 48, 48);
    expect(first.visible).toEqual(items.slice(0, 48));
    expect(first.start).toBe(0);

    const third = listWindow(items, 72, 48);
    expect(third.visible).toEqual(items.slice(24, 72));
    expect(third.start).toBe(24);
    expect(third.shown).toBe(72);
    expect(third.hidden).toBe(48);
    expect(third.visible).toHaveLength(48);
  });

  it("前翻以整批回退,不会退到第一批之前或把短清单越过末页", () => {
    expect(previousListLimit(72, 120, 24)).toBe(48);
    expect(previousListLimit(48, 120, 24)).toBe(24);
    expect(previousListLimit(24, 120, 24)).toBe(24);
    expect(previousListLimit(66, 66, 24)).toBe(48);
    expect(previousListLimit(999, 12, 24)).toBe(12);
    expect(previousListLimit(40, 120, 0)).toBe(40);
  });

  it("前翻按钮只报真正换回的行数,末页短批不许冒充整批", () => {
    expect(previousListStep(300, 300, 32)).toBe(12);
    expect(previousListStep(66, 66, 24)).toBe(18);
    expect(previousListStep(48, 120, 24)).toBe(24);
    expect(previousListStep(24, 120, 24)).toBe(0);
    expect(previousListStep(40, 120, 0)).toBe(0);
  });
});

describe("续开一批报出的件数", () => {
  /*
   * 这个数在界面上出现两次:「再看 N 部」的按钮文案,与同一枚按钮上的
   * `data-promised`。
   * 两处各拼一遍 Math.min(BATCH, hidden) 时,改批量只改一处就会出现
   * 「按钮说 24,实际放出 8」—— 这个函数就是那个唯一的一份。
   */
  it("够一批就报一批,末批不满按真实件数报", () => {
    expect(nextRevealCount(100, 24)).toBe(24);
    expect(nextRevealCount(24, 24)).toBe(24);
    expect(nextRevealCount(8, 24)).toBe(8);
    expect(nextRevealCount(1, 24)).toBe(1);
  });

  it("已经开到底时报 0,不报一批", () => {
    expect(nextRevealCount(0, 24)).toBe(0);
    // 脏值不许变成负数或 NaN 混进 aria-label / data 属性
    expect(nextRevealCount(-5, 24)).toBe(0);
    expect(nextRevealCount(Number.NaN, 24)).toBe(0);
    expect(nextRevealCount(Number.POSITIVE_INFINITY, 24)).toBe(0);
  });

  it("批量是脏值时不许报 0 件(那样按钮会永远打不开)", () => {
    // 0 / NaN 都落回「至少一件」:报 0 的按钮是死的,而它旁边写着「余 10」
    expect(nextRevealCount(10, 0)).toBe(1);
    expect(nextRevealCount(10, Number.NaN)).toBe(1);
    // Infinity 不是脏值,是「不限量」:能放多少报多少
    expect(nextRevealCount(10, Number.POSITIVE_INFINITY)).toBe(10);
  });

  it("界面里没有第二份 min(批量, hidden) 的拼法", () => {
    // 防回归:这条若是红的,说明有人又在模板或 computed 里手拼了一遍,
    // 而那份随时会和按钮文案分叉。
    const offenders = walkFiles(resolve(ROOT, "src"), isVueFile).filter((f) =>
      /Math\.min\(\s*\w*RENDER_BATCH\s*,/.test(readSource(relative(ROOT, f))),
    );
    expect(offenders).toEqual([]);
  });
});
