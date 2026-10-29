import { QUALITIES } from "@/data/qualities";
import { REALMS } from "@/data/realms";
import type { AchievementDef, AchvCond, CounterKey } from "@/types";

export interface AchievementProgressState {
  achieved: readonly string[];
  counters: Partial<Record<CounterKey, number>>;
  major: number;
  /** 当前持有过的最高装备品质 rank；没有装备时为 0 */
  maxQualityRank: number;
}

export interface AchievementProgressRow {
  def: AchievementDef;
  done: boolean;
  /** 0..1；无数值进度的 custom 条件为 0 */
  ratio: number;
  /** 有数值进度时的整数百分比，custom 未达成时为 null */
  percent: number | null;
  current: number | null;
  target: number | null;
  /** 离目标还差多少；custom 为 null */
  gap: number | null;
  /** 一眼可读的当前进度 */
  label: string;
}

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function clampInt(value: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteInt(value, min)));
}

function ratioOf(current: number, target: number): number {
  if (target <= 0) return current >= target ? 1 : 0;
  return Math.min(1, Math.max(0, current / target));
}

function realmName(major: number): string {
  return REALMS[clampInt(major, 0, REALMS.length - 1)]?.name ?? "未知境界";
}

function qualityName(rank: number): string {
  return QUALITIES.find((q) => q.rank === clampInt(rank, 0, QUALITIES.length - 1))?.name ?? "凡品";
}

function conditionProgress(
  cond: AchvCond,
  state: AchievementProgressState,
): Pick<AchievementProgressRow, "current" | "target" | "ratio" | "percent" | "gap" | "label"> {
  if (cond.type === "counter") {
    const target = Math.max(1, finiteInt(cond.value, 1));
    const current = Math.max(0, finiteInt(state.counters[cond.key], 0));
    const ratio = ratioOf(current, target);
    return {
      current,
      target,
      ratio,
      percent: Math.round(ratio * 100),
      gap: Math.max(0, target - current),
      label: `${current} / ${target}`,
    };
  }

  if (cond.type === "realm") {
    const target = clampInt(cond.major, 0, REALMS.length - 1);
    const current = clampInt(state.major, 0, REALMS.length - 1);
    const ratio = ratioOf(current, target);
    return {
      current,
      target,
      ratio,
      percent: Math.round(ratio * 100),
      gap: Math.max(0, target - current),
      label:
        current >= target
          ? `已至 ${realmName(current)}`
          : `${realmName(current)} → ${realmName(target)}`,
    };
  }

  if (cond.type === "quality") {
    const target = clampInt(cond.rank, 0, QUALITIES.length - 1);
    const current = clampInt(state.maxQualityRank, 0, QUALITIES.length - 1);
    const ratio = ratioOf(current, target);
    return {
      current,
      target,
      ratio,
      percent: Math.round(ratio * 100),
      gap: Math.max(0, target - current),
      label:
        current >= target
          ? `已持 ${qualityName(current)}`
          : `现持 ${qualityName(current)} → ${qualityName(target)}`,
    };
  }

  return {
    current: null,
    target: null,
    ratio: 0,
    percent: null,
    gap: null,
    label: "条件达成时自动结算",
  };
}

/**
 * 把成就定义与当前状态折成可排序的进度行。
 * 这里只做派生，不改存档；达成与否仍以 quests.achieved 为唯一真值。
 */
export function achievementProgressRows(
  defs: readonly AchievementDef[],
  state: AchievementProgressState,
): AchievementProgressRow[] {
  const achieved = new Set(state.achieved);
  return defs.map((def) => {
    const done = achieved.has(def.id);
    const progress = conditionProgress(def.cond, state);
    return {
      def,
      done,
      ...progress,
      ...(done
        ? {
            ratio: 1,
            percent: 100,
            label: "已达成",
          }
        : {}),
    };
  });
}

/** 只取有数值进度的未达成项；按完成比例、剩余步数与定义顺序排。 */
export function nearestAchievementRows<T extends AchievementProgressRow>(
  rows: readonly T[],
  limit = 3,
): T[] {
  const count = Math.max(0, finiteInt(limit, 0));
  if (count === 0) return [];
  return rows
    .filter((row) => !row.done && row.target !== null)
    .sort(
      (a, b) =>
        b.ratio - a.ratio ||
        (a.gap ?? Number.MAX_SAFE_INTEGER) - (b.gap ?? Number.MAX_SAFE_INTEGER) ||
        a.def.id.localeCompare(b.def.id),
    )
    .slice(0, count);
}
