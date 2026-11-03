/**
 * 重铸预算总账 —— 押之前把这一押的价说清楚。
 *
 * 判据五组:
 *   一 只是乘法:单价 × 次数,不自己另算一份价;
 *   二 预算是「至多」的上界:坏值夹到 [1, 500],与按钮提交同一口径;
 *   三 付不齐时明写差多少(灰钮不许只有一句「不足」);
 *   四 一句里三样齐全:次数、总价、够不够;
 *   五 真接线:面板读它,并给真浏览器留落点。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { cmp, gn, gnZero, toNum } from "@/utils/gnum";
import {
  clampReforgeRolls,
  REFORGE_BUDGET_MAX,
  reforgeBudget,
  reforgeBudgetLine,
} from "./reforgeBudget";

const COST = { dust: 12, stone: gn(800) };
const RICH = { dust: 10_000, stone: gn(1_000_000) };
const fmt = (v: { m: number; e: number }): string => `${v.m}e${v.e}`;

describe("重铸预算 · 只是乘法", () => {
  it("总价 = 单价 × 次数", () => {
    const budget = reforgeBudget(50, COST, RICH)!;
    expect(budget.rolls).toBe(50);
    expect(budget.dust).toBe(600);
    expect(cmp(budget.stone, gn(40_000))).toBe(0);
  });

  it("洗 1 次就等于单价 —— 不额外加价", () => {
    const budget = reforgeBudget(1, COST, RICH)!;
    expect(budget.dust).toBe(12);
    expect(cmp(budget.stone, gn(800))).toBe(0);
  });

  it("没有价目时整个总账不出,而不是给一份零价", () => {
    expect(reforgeBudget(50, null, RICH)).toBeNull();
    expect(reforgeBudget(50, undefined, RICH)).toBeNull();
  });
});

describe("重铸预算 · 至多与夹值", () => {
  it("预算是「至多」的上界:夹在 [1, 500]", () => {
    expect(clampReforgeRolls(0)).toBe(1);
    expect(clampReforgeRolls(-5)).toBe(1);
    expect(clampReforgeRolls(600)).toBe(REFORGE_BUDGET_MAX);
    expect(clampReforgeRolls("30")).toBe(30);
  });

  it("坏值按 1 次,不让它算出 NaN 总价", () => {
    for (const bad of [Number.NaN, undefined, null, "abc", {}]) {
      expect(clampReforgeRolls(bad)).toBe(1);
    }
    const budget = reforgeBudget(Number.NaN, COST, RICH)!;
    expect(budget.rolls).toBe(1);
    expect(Number.isFinite(budget.dust)).toBe(true);
  });

  it("面板输入框的上界与这里同一个数", () => {
    const panel = readSource("src/components/equipment/EquipReforgePanel.vue");
    expect(panel, "上界要读常量,不在模板里再写一个 500").toContain("REFORGE_BUDGET_MAX");
  });
});

describe("重铸预算 · 够不够", () => {
  it("手上有余:enough 为真,缺口都是 0", () => {
    const budget = reforgeBudget(50, COST, RICH)!;
    expect(budget.enough).toBe(true);
    expect(budget.dustShort).toBe(0);
    expect(cmp(budget.stoneShort, gnZero())).toBe(0);
  });

  it("尘不够时,差的是那一个确切的数 —— 不是一句「不足」", () => {
    const budget = reforgeBudget(50, COST, { dust: 400, stone: gn(1_000_000) })!;
    expect(budget.enough).toBe(false);
    expect(budget.dustShort).toBe(200);
    // 缺口以读数给出,那句人话由 reforgeBudgetLine 拼(两处不各写一份)
    expect(toNum(reforgeBudgetLine(budget, fmt).length > 0 ? gn(1) : gnZero())).toBe(1);
  });

  it("灵石不够时也一样,两样都缺就报两样", () => {
    const onlyStone = reforgeBudget(50, COST, { dust: 10_000, stone: gn(1_000) })!;
    expect(onlyStone.enough).toBe(false);
    expect(onlyStone.dustShort).toBe(0);
    expect(onlyStone.stoneShort).toBeTruthy();
    const both = reforgeBudget(50, COST, { dust: 0, stone: gnZero() })!;
    expect(both.dustShort).toBe(600);
    expect(both.stoneShort).toBeTruthy();
    const line = reforgeBudgetLine(both, fmt);
    expect(line).toContain("尚差");
    expect(line).toContain("器灵尘");
    expect(line).toContain("灵石");
  });
});

describe("重铸预算 · 一句话里三样齐全", () => {
  it("够的时候报次数与总价", () => {
    const line = reforgeBudgetLine(reforgeBudget(50, COST, RICH)!, fmt);
    expect(line).toContain("50 次");
    expect(line).toContain("器灵尘×600");
    expect(line).toContain("灵石");
    expect(line, "够的时候不该说「尚差」").not.toContain("尚差");
  });

  it("明写「至多」—— 自动重铸会提前收手,那是上界不是预计", () => {
    const line = reforgeBudgetLine(reforgeBudget(50, COST, RICH)!, fmt);
    expect(line).toContain("至多");
  });

  it("灵石为零时不写一个「灵石 0」的空账", () => {
    const line = reforgeBudgetLine(reforgeBudget(10, { dust: 5, stone: gnZero() }, RICH)!, fmt);
    expect(line).not.toContain("灵石");
    expect(line).toContain("器灵尘×50");
  });
});

describe("重铸预算 · 真接线", () => {
  it("面板读它,并给真浏览器留落点", () => {
    const panel = readSource("src/components/equipment/EquipReforgePanel.vue");
    expect(panel, "面板要读总账").toContain("reforgeBudget(");
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-equipment-reforge-budget");
  });

  it("单价仍取自 core/reforge —— 这里不另算一份价", () => {
    const src = readSource("src/ui/reforgeBudget.ts");
    expect(src, "不该 import 重铸实现").not.toContain('from "@/core/reforge"');
    expect(src, "也不该碰装备表").not.toContain('from "@/data/equipment"');
  });
});
