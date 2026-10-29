/**
 * 器魂此刻能做 —— 卷首、天界入口与凝炼台共用这一份判据。
 *
 * 从前「可凝」只数行囊资格，没算道源：付不起时入口仍写 N 件可凝，
 * 点进凝炼台才看到按钮全灰。这里把可凝清单、可支付枚数与短差一起算清。
 */
import type { EquipmentInstance } from "@/types";
import { SOUL_REFINE_COST, SOUL_SLOTS, type SoulInstance } from "@/data/souls";
import { canRefine } from "./soulForge";

export interface SoulOverviewInput {
  activeSouls: readonly SoulInstance[];
  soulList: readonly SoulInstance[];
  items: readonly EquipmentInstance[];
  equippedUids: ReadonlySet<string>;
  daoSource: number;
}

export interface SoulOverview {
  slotTotal: number;
  activeCount: number;
  slotsFull: boolean;
  idleSouls: SoulInstance[];
  refinable: EquipmentInstance[];
  refinableCount: number;
  affordableRefines: number;
  shortfall: number;
}

export function soulOverview(input: SoulOverviewInput): SoulOverview {
  const activeIds = new Set(input.activeSouls.map((soul) => soul.uid));
  const idleSouls = input.soulList.filter((soul) => !activeIds.has(soul.uid));
  const refinable = input.items.filter(
    (item) => !item.locked && !input.equippedUids.has(item.uid) && canRefine(item),
  );
  const daoSource = Number.isFinite(input.daoSource) ? Math.max(0, Math.floor(input.daoSource)) : 0;
  const refinableCount = refinable.length;
  const affordableRefines = Math.min(refinableCount, Math.floor(daoSource / SOUL_REFINE_COST));
  return {
    slotTotal: SOUL_SLOTS,
    activeCount: input.activeSouls.length,
    slotsFull: input.activeSouls.length >= SOUL_SLOTS,
    idleSouls,
    refinable,
    refinableCount,
    affordableRefines,
    shortfall: refinableCount > 0 ? Math.max(0, SOUL_REFINE_COST - daoSource) : 0,
  };
}
