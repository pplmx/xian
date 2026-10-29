/**
 * 坊市当下能做什么 —— 与逐单交货条件、页签朱点共用同一份判据。
 *
 * 坊市此前把「够不够交」藏在视图本地：页签若另算一遍，就会出现「悬赏页签亮着
 * 可交，点进去每单却写着缺货」的两本账。这里只做纯计算，不读写 store。
 */
import { pillDef } from "@/data/pills";
import type { BountySlot } from "@/data/bounty";
import type { MarketSlot } from "@/data/market";

export interface MarketHoldings {
  herbs: number;
  ore: number;
  pills: Readonly<Record<string, number>>;
  bagTiers: readonly number[];
}

export interface BountyShortfall {
  need: number;
  have: number;
  label: string;
}

export interface BountyStatus {
  claimed: boolean;
  ready: boolean;
  shortfall: BountyShortfall | null;
  /** 按钮旁的就地短差；claimed 时为空，避免交过的单还挂着「缺货」。 */
  shortText: string | null;
}

/** 一张悬赏此刻是否交得掉；贡器按行囊里最高阶的够格件算。 */
export function bountyStatus(order: BountySlot, holdings: MarketHoldings): BountyStatus {
  if (order.claimed) {
    return { claimed: true, ready: false, shortfall: null, shortText: null };
  }

  let have = 0;
  let label = "";
  if (order.kind === "herb") {
    have = holdings.herbs;
    label = "灵草";
  } else if (order.kind === "ore") {
    have = holdings.ore;
    label = "玄铁";
  } else if (order.kind === "pill") {
    have = holdings.pills[order.kindId] ?? 0;
    label = pillDef(order.kindId)?.name ?? order.kindId;
  } else {
    have = holdings.bagTiers.filter((tier) => tier >= order.tier).length;
    label = `≥${order.tier} 阶兵刃`;
  }

  if (have >= order.target) {
    return { claimed: false, ready: true, shortfall: null, shortText: null };
  }
  const shortfall = { need: order.target, have, label };
  const shortText =
    order.kind === "equip"
      ? `缺一件 ${label}`
      : `需 ${shortfall.need} ${label},缺 ${shortfall.need - shortfall.have}`;
  return { claimed: false, ready: false, shortfall, shortText };
}

export interface MarketOverview {
  /** 当前货架还买得到几格（已售不计）。 */
  availableGoods: number;
  /** 没交且眼下交得掉的悬赏数，贡器也算。 */
  claimableBounties: number;
  /** 其中能一键交掉的非贡器单数。 */
  autoClaimableBounties: number;
  /** 正在寄卖、尚未到时的件数。 */
  consignCount: number;
}

export function marketOverview(
  stock: readonly Pick<MarketSlot, "sold">[],
  orders: readonly BountySlot[],
  holdings: MarketHoldings,
  consignCount: number,
): MarketOverview {
  let availableGoods = 0;
  let claimableBounties = 0;
  let autoClaimableBounties = 0;
  for (const slot of stock) {
    if (!slot.sold) availableGoods += 1;
  }
  for (const order of orders) {
    const status = bountyStatus(order, holdings);
    if (!status.ready) continue;
    claimableBounties += 1;
    if (order.kind !== "equip") autoClaimableBounties += 1;
  }
  return {
    availableGoods,
    claimableBounties,
    autoClaimableBounties,
    consignCount: Math.max(0, Math.floor(consignCount)),
  };
}
