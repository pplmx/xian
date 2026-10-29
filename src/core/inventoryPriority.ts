import { qualityDef } from "@/data/qualities";
import type { EquipmentInstance } from "@/types";

export interface InventoryAttentionRow {
  item: EquipmentInstance;
  equipped: boolean;
  isNew: boolean;
}

/**
 * 背包藏品先报本次新得，再按品阶与层级降序。
 *
 * 底栏用 newItemCount 提示「有新货」，若开包后仍把新得埋在旧藏之后，玩家会看到
 * 徽标在、却找不到是哪几件。新得置顶只改呈现顺序，收藏集合与已有排序口径不变；
 * 两组内部仍守原来的品质 → 层级顺序。相同键保持调用方原序。
 */
export function sortInventoryForAttention<T extends InventoryAttentionRow>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    const qualityDelta = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
    if (qualityDelta !== 0) return qualityDelta;
    return b.item.tier - a.item.tier;
  });
}
