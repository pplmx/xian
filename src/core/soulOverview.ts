/**
 * 器魂此刻能做 —— 卷首、天界入口与凝炼台共用这一份判据。
 *
 * 从前「可凝」只数行囊资格，没算道源：付不起时入口仍写 N 件可凝，
 * 点进凝炼台才看到按钮全灰。这里把可凝清单、可支付枚数与短差一起算清。
 */
import type { EquipmentInstance } from "@/types";
import { SOUL_REFINE_COST, SOUL_SLOTS, soulMods, type SoulInstance } from "@/data/souls";
import { CELESTIAL_BASE_DEPTH } from "./gauntlet";
import { canRefine } from "./soulForge";
import { modDepth } from "./statsCalc";

export interface SoulOverviewInput {
  activeSouls: readonly SoulInstance[];
  soulList: readonly SoulInstance[];
  items: readonly EquipmentInstance[];
  equippedUids: ReadonlySet<string>;
  daoSource: number;
}

/**
 * 器魂页此刻该先做什么。
 *
 * 优先处理手上已有的形意，再看能否开炉；三席已满时先取舍，
 * 没有闲置也没有可凝件时才把玩家送回行囊找下一件带形意的法器。
 */
export type SoulNextAction = "wear" | "choose" | "refine" | "short" | "inventory" | "settled";

export interface SoulOverview {
  slotTotal: number;
  activeCount: number;
  slotsFull: boolean;
  idleSouls: SoulInstance[];
  refinable: EquipmentInstance[];
  refinableCount: number;
  affordableRefines: number;
  shortfall: number;
  nextAction: SoulNextAction;
  /**
   * 这三席器魂合起来的强度（各枚 mods 的深度之和）。
   *
   * ## 为什么要报它（第 562 轮）
   *
   * `souls.spec` 用「满配器魂合计深度 1.52」当量尺，而**界面上没有一处说这个数** ——
   * 玩家看得到每枚器魂的名字与品阶，却看不到「这三枚合起来有多深」。
   *
   * 而它正是这一层投入的强弱：单看一枚「化真」说不出什么，三枚加起来 1.52
   * 对基准 2.6 才是那一句话。
   *
   * 口径与 `souls.spec` 同一条:`modDepth(soulMods(s))` 逐枚求和 ——
   * 不在这里另写一份深度公式。
   */
  totalDepth: number;
  /**
   * 基准深度（`CELESTIAL_BASE_DEPTH`）—— 界面上要说「1.52 / 2.6」的那种分母。
   *
   * 报出来是因为单看 1.52 没有参照；而这个数是数据里的常数，不是这里算的。
   */
  baseDepth: number;
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
  const slotsFull = input.activeSouls.length >= SOUL_SLOTS;
  /*
   * 合计深度 —— 逐枚 `modDepth(soulMods(s))` 求和，与 souls.spec 的量尺同源。
   * 空席不贡献，故三席只上了两枚时它会小 —— 那是对的。
   */
  const totalDepth = input.activeSouls.reduce((sum, soul) => sum + modDepth(soulMods(soul)), 0);
  const nextAction: SoulNextAction =
    idleSouls.length > 0
      ? slotsFull
        ? "choose"
        : "wear"
      : refinableCount > 0
        ? affordableRefines > 0
          ? "refine"
          : "short"
        : slotsFull
          ? "settled"
          : "inventory";
  return {
    slotTotal: SOUL_SLOTS,
    activeCount: input.activeSouls.length,
    slotsFull,
    idleSouls,
    refinable,
    refinableCount,
    affordableRefines,
    shortfall: refinableCount > 0 ? Math.max(0, SOUL_REFINE_COST - daoSource) : 0,
    nextAction,
    totalDepth,
    baseDepth: CELESTIAL_BASE_DEPTH,
  };
}
