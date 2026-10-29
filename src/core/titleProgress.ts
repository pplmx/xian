import type { AchievementDef, TitleDef } from "@/types";
import {
  achievementProgressRows,
  type AchievementProgressRow,
  type AchievementProgressState,
} from "./achievementProgress";

export interface TitleProgressRow {
  def: TitleDef;
  /** 发放这顶名号的成就；名号页据此显示条件与进度，不另写来源表 */
  source: AchievementDef;
  progress: AchievementProgressRow;
}

/**
 * 把名号表与成就表按 reward.titleId 对齐。
 * 没有来源的名号不伪造可追路径，留给数据审计去抓孤儿。
 */
export function titleProgressRows(
  titles: readonly TitleDef[],
  achievements: readonly AchievementDef[],
  state: AchievementProgressState,
): TitleProgressRow[] {
  const progressById = new Map(
    achievementProgressRows(achievements, state).map((row) => [row.def.id, row]),
  );
  const sourceByTitleId = new Map<string, AchievementDef>();
  for (const achievement of achievements) {
    const titleId = achievement.reward?.titleId;
    if (titleId && !sourceByTitleId.has(titleId)) sourceByTitleId.set(titleId, achievement);
  }

  return titles.flatMap((def) => {
    const source = sourceByTitleId.get(def.id);
    const progress = source ? progressById.get(source.id) : undefined;
    return source && progress ? [{ def, source, progress }] : [];
  });
}

/**
 * 名号页的「下一顶」：只取尚未拥有的名号。
 * 有数值进度的排在纯条件之前；同组按完成比例、剩余步数和原表顺序稳定排序。
 */
export function nearestTitleProgressRows<T extends TitleProgressRow>(
  rows: readonly T[],
  ownedTitleIds: ReadonlySet<string>,
  limit = 3,
): T[] {
  const count = Math.max(0, Math.floor(limit));
  if (count === 0) return [];
  const orderOf = new Map(rows.map((row, index) => [row.def.id, index]));
  return rows
    .filter((row) => !ownedTitleIds.has(row.def.id))
    .sort(
      (a, b) =>
        Number(a.progress.target === null) - Number(b.progress.target === null) ||
        b.progress.ratio - a.progress.ratio ||
        (a.progress.gap ?? Number.MAX_SAFE_INTEGER) - (b.progress.gap ?? Number.MAX_SAFE_INTEGER) ||
        (orderOf.get(a.def.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderOf.get(b.def.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, count);
}
