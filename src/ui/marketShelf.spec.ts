import { describe, expect, it } from "vite-plus/test";
import { equipmentTemplate } from "@/data/equipment";
import { equipPowerComparison, equippablePower } from "@/core/equipBest";
import { formatGN } from "@/utils/format";
import type { EquipmentInstance, QualityId } from "@/types";
import { marketEquipView } from "./marketShelf";

function item(
  templateId: string,
  quality: QualityId,
  tier: number,
  level = 0,
  affixes: EquipmentInstance["affixes"] = [],
): EquipmentInstance {
  return {
    uid: `${templateId}-${quality}-${tier}-${level}-${affixes.length}`,
    templateId,
    quality,
    tier,
    level,
    affixes,
  };
}

describe("marketEquipView · 买前验货", () => {
  it("本件战力与差账直接复用换装比较的同一份真值", () => {
    const worn = item("w_hanfeng", "earth", 14, 2);
    const candidate = item("w_hanfeng", "heaven", 15, 3, [{ id: "atk1", roll: 0.8 }]);
    const comparison = equipPowerComparison(candidate, worn);
    const view = marketEquipView(candidate, worn);

    expect(view).not.toBeNull();
    expect(view!.power).toBeCloseTo(equippablePower(candidate), 9);
    expect(view!.powerText).toBe(formatGN(Math.round(equippablePower(candidate))));
    expect(view!.tone).toBe(comparison.verdict);
    expect(view!.compareText).toContain(equipmentTemplate(worn.templateId)!.name);
    expect(view!.deltaText).toContain(formatGN(Math.round(Math.abs(comparison.delta!))));
    expect(view!.incumbentPowerText).toBe(formatGN(Math.round(comparison.incumbentPower!)));
  });

  it("空槽不伪造涨幅，只报可直接入佩", () => {
    const view = marketEquipView(item("w_hanfeng", "heaven", 15));

    expect(view?.tone).toBe("empty");
    expect(view?.compareText).toContain("可直接入佩");
    expect(view?.deltaText).toBe("空槽无对照");
    expect(view?.incumbentPowerText).toBe("");
  });

  it("弱件报降幅，平铺差异也随本件与当前佩戴的同一份解析结果现算", () => {
    const worn = item("w_hanfeng", "immortal", 16, 4);
    const candidate = item("w_hanfeng", "mortal", 8);
    const comparison = equipPowerComparison(candidate, worn);
    const view = marketEquipView(candidate, worn);

    expect(comparison.verdict).toBe("down");
    expect(view?.tone).toBe("down");
    expect(view?.deltaText.startsWith("-")).toBe(true);
    expect(view?.flatRows.some((row) => row.diff.startsWith("-"))).toBe(true);
  });

  it("验货保留词条全文、固有与共鸣，不让玩家只看见一个总战力", () => {
    const view = marketEquipView(
      item("w_xuantie", "excellent", 2, 1, [{ id: "crit1", roll: 0.7 }]),
    );

    expect(view?.meta).toContain("武器");
    expect(view?.flatRows.length).toBeGreaterThan(0);
    expect(view?.affixRows).toHaveLength(1);
    expect(view?.affixRows[0]!.rarityName.length).toBeGreaterThan(0);
    expect(view?.affixRows[0]!.desc.length).toBeGreaterThan(0);
    expect(view?.setText).toContain("共鸣");
  });

  it("共鸣报当前佩件数与门槛，不把所需件数误读成已有件数", () => {
    const view = marketEquipView(item("w_xuantie", "excellent", 2, 1), undefined, 1);

    expect(view?.setText).toContain("当前 1/");
    expect(view?.setText).toContain("件");
  });

  it("无效模板不从货架凭空造出一件验货帖", () => {
    expect(marketEquipView(item("not-a-template", "mortal", 1))).toBeNull();
  });
});
