/**
 * 天界四册的卷首总账 —— 道途、远征、试炼与道痕只在这里汇一次。
 *
 * 页面上的总数、已破数、今日天道状态与道痕余量都从这一份读数出发；
 * 各面板仍负责逐项详情，卷首不另算一套「看起来可做」。
 */

export type CelestialDailyState = "ready" | "done" | "unavailable";

export interface CelestialOverviewInput {
  daoChosen: boolean;
  worldIds: readonly string[];
  worldClears: Readonly<Record<string, number>>;
  worldRun: { layer: number; rows: readonly unknown[] } | null;
  trialIds: readonly string[];
  trialRecords: Readonly<Record<string, { clears: number }>>;
  daily: { day: number } | null;
  dailyDoneDay: number | null;
  marksCount: number;
  marksTotal: number;
}

export interface CelestialOverview {
  daoChosen: boolean;
  worldsCleared: number;
  worldsTotal: number;
  activeRun: boolean;
  runFights: number;
  runLayer: number;
  trialsCleared: number;
  trialsTotal: number;
  dailyState: CelestialDailyState;
  marksCount: number;
  marksTotal: number;
  marksRemaining: number;
  marksFull: boolean;
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function celestialOverview(input: CelestialOverviewInput): CelestialOverview {
  const worldIds = [...new Set(input.worldIds)];
  const trialIds = [...new Set(input.trialIds)];
  const marksTotal = whole(input.marksTotal);
  const marksCount = Math.min(marksTotal, whole(input.marksCount));
  const dailyState: CelestialDailyState = !input.daily
    ? "unavailable"
    : input.dailyDoneDay === input.daily.day
      ? "done"
      : "ready";

  return {
    daoChosen: input.daoChosen,
    worldsCleared: worldIds.filter((id) => whole(input.worldClears[id] ?? 0) > 0).length,
    worldsTotal: worldIds.length,
    activeRun: input.worldRun !== null,
    runFights: input.worldRun ? input.worldRun.rows.length : 0,
    runLayer: input.worldRun ? whole(input.worldRun.layer) : 0,
    trialsCleared: trialIds.filter((id) => whole(input.trialRecords[id]?.clears ?? 0) > 0).length,
    trialsTotal: trialIds.length,
    dailyState,
    marksCount,
    marksTotal,
    marksRemaining: marksTotal - marksCount,
    marksFull: marksTotal > 0 && marksCount >= marksTotal,
  };
}
