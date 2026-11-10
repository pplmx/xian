/**
 * 灵兽补内容时的**可行域计算器**。
 *
 * ## 为什么需要它
 *
 * 灵兽有两条互相牵制的硬约束(判据见 `core/petQuality.spec`):
 *
 *   ① 同一词条键,高品阶值 ≥ **任意**低品阶的同词条值;
 *   ② 总预算(Σ|词条值|)随品阶不回落。
 *
 * 于是**新增一只**灵兽时,每个词条能写什么不是自由选择 —— 它被夹在
 * 「低品阶该键的最高值」与「高品阶该键的最低值」之间:
 *
 * ```text
 *   可用区间 = [ max(低品阶该键值),  min(高品阶该键值) ]
 * ```
 *
 * 第 58 轮补两只玄品灵兽时,因为没先算这个区间,连改七八轮都被判据挡回来
 * (改 A 触发 B、改 B 又触发 C)。最后把区间算出来,**按区间取值一次就过**。
 *
 * ## 一句话
 *
 * 分布式约束下的手调收敛不了 —— 它不是数值问题,是求解问题。
 * 这个模块把「求解」那一步变成一次函数调用。
 */
import { PETS } from "@/data/pets";
import { qualityDef } from "@/data/qualities";
import type { AnyStatKey, QualityId, PetDef } from "@/types";

/** 某个词条在某个品阶上的可用区间 */
export interface StatRange {
  key: AnyStatKey;
  /** 下限:低品阶该键的最高值。没有低品阶用过该键时为 0 */
  lo: number;
  /** 上限:高品阶该键的最低值。没有高品阶用过该键时为 Infinity */
  hi: number;
}

/** 该品阶下某键是否可写(区间非空) */
export function isWritable(range: StatRange): boolean {
  return range.lo <= range.hi + 1e-9;
}

/**
 * 某品阶的每个词条可用区间。
 *
 * 只统计 `PETS` 里**已经出现过**的词条键 —— 一个从没被任何灵兽用过的键
 * 没有可比对象,自然没有上下界(返回 `lo: 0, hi: Infinity`)。
 * 那种键可以直接写,但也要自己想清楚量级(没有判据会拦,也就没有保障)。
 */
export function statRangesFor(quality: QualityId): StatRange[] {
  const rank = qualityDef(quality).rank;
  const byKey = new Map<AnyStatKey, { lo: number; hi: number }>();

  for (const pet of PETS) {
    const petRank = qualityDef(pet.quality).rank;
    for (const [k, v] of Object.entries(pet.mods)) {
      const key = k as AnyStatKey;
      const value = Math.abs(v ?? 0);
      const cur = byKey.get(key) ?? { lo: 0, hi: Infinity };
      if (petRank < rank) cur.lo = Math.max(cur.lo, value);
      else if (petRank > rank) cur.hi = Math.min(cur.hi, value);
      byKey.set(key, cur);
    }
  }

  return [...byKey.entries()]
    .map(([key, { lo, hi }]) => ({ key, lo, hi }))
    .filter(isWritable)
    .sort((a, b) => a.lo - b.lo || a.key.localeCompare(b.key));
}

/**
 * 某品阶的**总预算**区间 —— 新增一只的 Σ|词条值| 要落在这里面。
 *
 * 下限取「低于该品阶的所有灵兽里预算最高的那只」,上限取「高于该品阶的
 * 所有灵兽里预算最低的那只」。与词条区间同理:两头都不能越。
 */
export function budgetRangeFor(quality: QualityId): { lo: number; hi: number } {
  const rank = qualityDef(quality).rank;
  let lo = 0;
  let hi = Infinity;
  for (const pet of PETS) {
    const petRank = qualityDef(pet.quality).rank;
    if (petRank === rank) continue;
    const budget = petBudget(pet);
    if (petRank < rank) lo = Math.max(lo, budget);
    else hi = Math.min(hi, budget);
  }
  return { lo, hi };
}

/** 一只灵兽的总预算:Σ|词条值|(与 `petQuality.spec` 的口径同一份) */
export function petBudget(pet: Pick<PetDef, "mods">): number {
  return Object.values(pet.mods).reduce((sum, v) => sum + Math.abs(v ?? 0), 0);
}
