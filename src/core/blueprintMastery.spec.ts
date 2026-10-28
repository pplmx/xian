import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BLUEPRINT_MASTERY_PER_REFORGE } from "@/data/constants";
import {
  blueprintReforgesUntilMastered,
  clampBlueprintMastery,
  isBlueprintMastered,
} from "./blueprintMastery";

describe("器谱掌握度 · 唯一口径", () => {
  it("只把满掌握认作读通,过半与近似值都不能冒充", () => {
    expect(isBlueprintMastered(0)).toBe(false);
    expect(isBlueprintMastered(0.99)).toBe(false);
    expect(isBlueprintMastered(1)).toBe(true);
    expect(isBlueprintMastered(1.2), "越界值按读通处理").toBe(true);
    expect(isBlueprintMastered(Number.NaN)).toBe(false);
  });

  it("坏值不污染掌握度:负数、越界与 NaN 都夹到合法区间", () => {
    expect(clampBlueprintMastery(-0.2)).toBe(0);
    expect(clampBlueprintMastery(0.42)).toBe(0.42);
    expect(clampBlueprintMastery(1.8)).toBe(1);
    expect(clampBlueprintMastery(Number.NaN)).toBe(0);
    expect(clampBlueprintMastery(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("读通还需几次按当前每次增量向上取整,浮点余量不凭空多一次", () => {
    expect(blueprintReforgesUntilMastered(0)).toBe(50);
    expect(blueprintReforgesUntilMastered(0.5)).toBe(25);
    expect(blueprintReforgesUntilMastered(0.98)).toBe(1);
    expect(blueprintReforgesUntilMastered(0.999)).toBe(1);
    expect(blueprintReforgesUntilMastered(1)).toBe(0);
    expect(blueprintReforgesUntilMastered(-1)).toBe(Math.ceil(1 / BLUEPRINT_MASTERY_PER_REFORGE));
  });

  it("每次增量非法时不给「已经读通」的假读数", () => {
    expect(blueprintReforgesUntilMastered(0.5, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(blueprintReforgesUntilMastered(0.5, Number.NaN)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("器谱掌握度 · 消费者同源", () => {
  it("宿慧、轮回录、图鉴、铁砧与重铸全认同一枚读通判据", () => {
    for (const file of [
      "core/samsaraService.ts",
      "stores/lore.ts",
      "ui/codex.ts",
      "components/equipment/EquipmentDetailDialog.vue",
      "core/reforge.ts",
    ]) {
      const src = readFileSync(resolve(__dirname, "../", file), "utf8");
      expect(src, `${file} 该走 core/blueprintMastery 的读通判据`).toContain("isBlueprintMastered");
    }
  });
});
