import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { legacyCoverage, legacyMeter, legacyStageMeter } from "./legacyDesk";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("三生案 · 本世、所知与旧缘同读此刻", () => {
  it("通用账目只做一把尺:坏数归零、越界夹住、空表不算圆满", () => {
    expect(legacyMeter(0, 0)).toEqual({
      value: 0,
      total: 0,
      ratio: 0,
      complete: false,
    });
    expect(legacyMeter(3, 10)).toEqual({
      value: 3,
      total: 10,
      ratio: 0.3,
      complete: false,
    });
    expect(legacyMeter(12, 10)).toEqual({
      value: 10,
      total: 10,
      ratio: 1,
      complete: true,
    });
    expect(legacyMeter(-2, 10).value).toBe(0);
    expect(legacyMeter(3.9, 10.9)).toMatchObject({ value: 3, total: 10 });
    expect(legacyMeter(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      value: 0,
      total: 0,
      ratio: 0,
      complete: false,
    });
  });

  it("宿慧阶梯只量当前阶到下一阶这一段,顶阶直接走满", () => {
    expect(legacyStageMeter(23, 0, 90)).toEqual({
      value: 23,
      total: 90,
      ratio: 23 / 90,
      complete: false,
      floor: 0,
      ceiling: 90,
      remaining: 67,
    });
    expect(legacyStageMeter(120, 90, 260)).toMatchObject({
      value: 30,
      total: 170,
      remaining: 140,
    });
    expect(legacyStageMeter(1200, 1100, null)).toMatchObject({
      ratio: 1,
      complete: true,
      ceiling: null,
      remaining: 0,
    });
    expect(legacyStageMeter(Number.NaN, Number.NaN, Number.POSITIVE_INFINITY)).toMatchObject({
      value: 0,
      ratio: 1,
      complete: true,
      floor: 0,
      ceiling: null,
    });
  });

  it("随身所知合成一条覆盖率,四本账各按自己的总量计入", () => {
    expect(
      legacyCoverage([
        { value: 2, total: 4 },
        { value: 3, total: 6 },
        { value: 1, total: 5 },
        { value: 9, total: 3 },
      ]),
    ).toEqual({
      value: 9,
      total: 18,
      ratio: 0.5,
      complete: false,
    });
    expect(legacyCoverage([])).toMatchObject({ value: 0, total: 0, ratio: 0 });
  });

  it("卷首走三生盘,四册总案与旧长列表的续开 / 回翻标记都还在", () => {
    const view = source("src/views/LegacyView.vue");
    const wheel = source("src/components/common/LegacyWheel.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view, "三生录进入 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,420}\bfeatured\b/,
    );
    expect(view, "卷首主视觉读同一份本世、所知与旧缘").toMatch(
      /<template #visual>[\s\S]{0,240}<LegacyWheel/,
    );
    expect(view).toContain("legacyStageMeter(");
    expect(view).toContain("legacyCoverage(loreRows.value)");
    expect(view).toContain("data-legacy-current");
    expect(view).toContain("data-legacy-profile");
    expect(view).toContain("data-legacy-samsara");
    expect(view).toContain("data-legacy-stage");
    expect(view).toContain("data-legacy-lore");
    expect(view).toContain("data-legacy-vow");
    expect(view).toContain("data-legacy-journey");
    expect(view).toContain("data-legacy-fate");
    expect(view).toContain("data-legacy-record");
    expect(view).toContain("masteredBlueprintCount");
    expect(view).toContain("读通器谱");
    expect(view).toContain('v-for="l in lifePage.visible"');
    expect(view).toContain("data-life-more");
    expect(view).toContain("data-life-prev");
    expect(view).toContain('v-for="l in lossPage.visible"');
    expect(view).toContain("data-loss-more");
    expect(view).toContain("data-loss-prev");
    expect(view).toContain("cnNumber(PROFILE_MIN_MARKS)");
    expect(view).not.toContain("道痕未满五则");
    expect(wheel, "三生盘是重复信息的视觉摘要,不重复进入读屏").toContain('aria-hidden="true"');
    expect(layout, "真浏览器要核卷首与总案确实落在三生录").toContain(
      'document.querySelector("[data-legacy-current]")',
    );
    expect(layout).toContain('document.querySelector("[data-legacy-samsara]")');
  });

  it("手机单列、620 两列、960 三列,220 以下行尾读数退到下一行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 三生案");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const legacyCss = css.slice(start, end);

    expect(start, "三生样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "三生样式段要有明确结尾").toBeGreaterThan(start);
    expect(legacyCss).toMatch(
      /\.legacy-ledger__grid\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(legacyCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1200}\.legacy-ledger__grid\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(legacyCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,220}\.legacy-ledger__grid--three\s*\{[\s\S]{0,100}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(legacyCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.legacy-history__insight\s*\{[\s\S]{0,80}grid-column:\s*2/,
    );
    expect(legacyCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3200}\.legacy-record__value\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
  });
});
