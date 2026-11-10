/**
 * 品质读数 —— 「持有过最高的那一件」,不是「此刻包里最高的那一件」。
 *
 * ## 复现出来的事故
 *
 * 成就谱上「天品或更高 / 仙品或更高 / 神品」这几行的进度条,读的是
 * `inventory.items` 里**此刻**最高的那件(见 views/CollectionView 与 TitlesView)。
 * 而分解会 `inventory.removeEquipment(uid)` —— 把那一件从 items 里拿掉。
 *
 * 于是:得一件神品 → 进度 8/8 → 把它分解 → 进度掉回 0/8。
 *
 * 更糟的是已解锁的成就不掉回(`quests.achieved` 只增),所以同一屏上会出现
 * 「神物自晦 ✓ 已达成」与「天品 0/6 尚未达成」并存 —— 两张卡互相打脸。
 *
 * ## 为什么「持有过」才是对的
 *
 * 成就是**一次性事实**:「我曾得一件天品」。这类事实本该只增不减,与
 * `core/peakRealm`(历世最远那一境)同一条规矩 —— 那里已经写明「只增不减,
 * 转世折回起点不会把足迹抹掉」。品质这一处漏了。
 *
 * ## 四类都要算
 *
 * 品质不是装备独有:法宝、灵兽、功法各有品质。只读 `inventory.items` 会漏掉
 * 玩家真正在意的极品(比如那一件神品法宝)。故读数取四类之间的最大值。
 *
 * 本模块只做**读数**,不参与任何解锁判定(判定仍在 core/engineUnlocks)。
 */
import { QUALITIES } from "@/data/qualities";

/** 合法档位的两端 */
const MIN_RANK = 0;
const MAX_RANK = Math.max(0, QUALITIES.length - 1);

/** 任意值夹成合法品质档位;NaN / 负数 / 越界一律收口 */
function clampRank(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MIN_RANK;
  return Math.min(MAX_RANK, Math.max(MIN_RANK, Math.trunc(value)));
}

/**
 * 折成只增不减的读数。
 *
 * 记着的那一份(`peak`)与此刻看到的那一份(`current`)取大 —— 分解、转世、
 * 背包清空都不会让「曾得过」这件事消失。
 */
export function mergeQualityPeak(peak: unknown, current: unknown): number {
  return Math.max(clampRank(peak), clampRank(current));
}

/** 一串档位里最高的那一档;空表给 0 */
export function highestOf(ranks: readonly number[]): number {
  // 折法只此一份:逐个与已记的那个读数取大(见 mergeQualityPeak)
  let best = MIN_RANK;
  for (const rank of ranks) best = mergeQualityPeak(best, rank);
  return best;
}
