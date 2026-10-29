import { describe, expect, it } from "vite-plus/test";
import type { EquipmentInstance, QualityId } from "@/types";
import { sortInventoryForAttention, type InventoryAttentionRow } from "./inventoryPriority";

function item(uid: string, quality: QualityId, tier: number): EquipmentInstance {
  return {
    uid,
    templateId: "w_hanfeng",
    quality,
    tier,
    level: 0,
    affixes: [],
  };
}

function row(uid: string, quality: QualityId, tier: number, isNew: boolean): InventoryAttentionRow {
  return { item: item(uid, quality, tier), equipped: false, isNew };
}

describe("背包藏品 · 先报本次新得", () => {
  it("新得整体压过旧藏,即使旧藏品阶更高", () => {
    const rows = sortInventoryForAttention([
      row("old-divine", "divine", 20, false),
      row("new-mortal", "mortal", 1, true),
    ]);
    expect(rows.map((entry) => entry.item.uid)).toEqual(["new-mortal", "old-divine"]);
  });

  it("新得组与旧藏组内部仍按品阶、层级降序", () => {
    const rows = sortInventoryForAttention([
      row("old-fine", "fine", 9, false),
      row("new-earth", "earth", 12, true),
      row("old-heaven", "heaven", 8, false),
      row("new-fine", "fine", 15, true),
      row("new-heaven", "heaven", 7, true),
    ]);
    expect(rows.map((entry) => entry.item.uid)).toEqual([
      "new-heaven",
      "new-earth",
      "new-fine",
      "old-heaven",
      "old-fine",
    ]);
  });

  it("同组同品同层保持原顺序,且不原地改动调用方数组", () => {
    const input = [
      row("first", "earth", 10, false),
      row("second", "earth", 10, false),
      row("third", "earth", 10, false),
    ];
    const rows = sortInventoryForAttention(input);
    expect(rows.map((entry) => entry.item.uid)).toEqual(["first", "second", "third"]);
    expect(input.map((entry) => entry.item.uid)).toEqual(["first", "second", "third"]);
    expect(rows).not.toBe(input);
  });
});
