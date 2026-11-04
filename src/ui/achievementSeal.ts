/**
 * 成就报喜的品阶印 —— 「神物自晦」与「初有积蓄」不该长得一样。
 *
 * ## 缺口:同一屏里两条「rare」,分量差着量级
 *
 * `progress.announceAchievement` 对**所有**成就发同一条提示:
 *
 *     notify(`成就达成「${def.name}」`, "rare")
 *
 * 而「rare」这一族的提示早就按品阶分层了(见 ui/flashTier / ui/rareSfx / ui/toastLife):
 * 有品阶印的那条会盖一枚印、闪一道带该档颜色的光、响对应的一响、停更久。
 *
 * 于是:
 *
 *   拾得一件神品装备 —— `notify(pickup, "rare", inst.quality)` → 有「神」印、神品的光与声
 *   成就「神物自晦」—— `notify(..., "rare")`                  → 什么都没有,与「初有积蓄」同款
 *
 * 而「神物自晦」的达成条件**就是**获得一件神品装备 —— 它是同一件事的报喜,
 * 却比那件装备本身的提示轻了一整个量级。
 *
 * ## 做法:从条件里读出品阶,而不是在数据里再抄一栏
 *
 * 成就定义里已经有 `cond: { type: "quality", rank }`(见 data/achievements)。
 * 那一档的名字与颜色全在品质表里,故这里只做一次「rank → QualityId」的翻译,
 * 不新增字段、不往每条成就里各抄一遍品质 id。
 *
 * ## 只管品质型成就
 *
 * 其余成就(累计击杀、境界、自定条件)没有「品阶」这回事 —— 给它们编一个印
 * 就是在撒谎。故这里对非品质条件一律返回 undefined,提示条退回与改造前逐位相同的模样。
 */
import type { AchievementDef, AchvCond, QualityId } from "@/types";
import { QUALITIES } from "@/data/qualities";

/**
 * 条件里写的那一档 → 品质表里的 id。
 *
 * 坏值(负 / NaN / 越界)夹到两端 —— 与 `core/qualityPeak` 同一条夹取口径:
 * 坏档宁可落到凡品,也不要让提示条盖出一枚查不到的章。
 */
function qualityIdAtRank(rank: number): QualityId {
  const max = Math.max(0, QUALITIES.length - 1);
  const safe =
    typeof rank === "number" && Number.isFinite(rank)
      ? Math.min(max, Math.max(0, Math.trunc(rank)))
      : 0;
  return (QUALITIES[safe] ?? QUALITIES[0]!).id;
}

/**
 * 这一条成就在报喜时该盖哪一档的印。
 *
 * 品质型成就返回它达成条件里那一档;其余一律 undefined(不盖印)。
 */
export function achievementSealOf(def: AchievementDef | null | undefined): QualityId | undefined {
  const cond: AchvCond | undefined = def?.cond;
  if (!cond || cond.type !== "quality") return undefined;
  return qualityIdAtRank(cond.rank);
}
