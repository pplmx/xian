import {
  realmCodexWorldStatus,
  type RealmCodexCurrent,
  type RealmCodexWorldRow,
  type RealmWorldState,
} from "@/core/realmCodex";

/** 四界的单字印。界名仍从 WORLDS 读，这里只给卷目与谱图一枚可扫读的记号。 */
export const REALM_WORLD_MARKS: Record<string, string> = {
  mortal: "凡",
  immortal: "仙",
  god: "神",
  chaos: "混",
};

export interface RealmCodexAtlasRow extends RealmCodexWorldRow {
  mark: string;
  ordinal: number;
  rangeLabel: string;
  ratio: number;
  status: string;
}

export interface RealmCodexOverview {
  passed: number;
  total: number;
  remaining: number;
  ratio: number;
  worldPosition: number;
  worldTotal: number;
  worldIndex: number;
  worldCount: number;
}

export interface RealmCodexRealmEntry {
  def: RealmCodexWorldRow["realms"][number]["def"];
  index: number;
  ordinal: number;
  state: RealmWorldState;
  stateLabel: string;
  stateMark: string;
}

export function realmCodexWorldMark(worldId: string): string {
  return REALM_WORLD_MARKS[worldId] ?? worldId.slice(0, 1);
}

function rangeLabel(start: number, end: number): string {
  if (start === end) return `第 ${start} 境`;
  return `第 ${start}–${end} 境`;
}

/** 四界卷目只给 core 行补展示记号、界内序号与进度，不另算状态。 */
export function realmCodexAtlasRows(rows: readonly RealmCodexWorldRow[]): RealmCodexAtlasRow[] {
  return rows.map((row, index) => ({
    ...row,
    mark: realmCodexWorldMark(row.world.id),
    ordinal: index + 1,
    rangeLabel: rangeLabel(row.world.start + 1, row.world.end + 1),
    ratio: row.total > 0 ? row.entered / row.total : 0,
    status: realmCodexWorldStatus(row),
  }));
}

/** 卷首只汇总同一份当前境与四界行；总数、已渡、余境都不再手数。 */
export function realmCodexOverview(
  current: RealmCodexCurrent,
  rows: readonly RealmCodexWorldRow[],
): RealmCodexOverview {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const worldIndex = rows.findIndex((row) => row.world.id === current.world.id) + 1;
  return {
    passed: current.index,
    total,
    remaining: Math.max(0, total - current.globalPosition),
    ratio: total > 0 ? current.globalPosition / total : 0,
    worldPosition: current.worldPosition,
    worldTotal: current.worldTotal,
    worldIndex: Math.max(1, worldIndex),
    worldCount: rows.length,
  };
}

/** 单境三态与当前大境界同源；坏档与 realmCodex 一样把当前境夹回首境。 */
export function realmCodexRealmState(index: number, major: number): RealmWorldState {
  const at = Number.isFinite(major) ? Math.max(0, Math.trunc(major)) : 0;
  if (index < at) return "past";
  if (index === at) return "current";
  return "future";
}

export function realmCodexRealmStateLabel(state: RealmWorldState): string {
  if (state === "past") return "已渡";
  if (state === "current") return "此刻";
  return "未至";
}

export function realmCodexRealmStateMark(state: RealmWorldState): string {
  if (state === "past") return "渡";
  if (state === "current") return "此";
  return "待";
}

export function realmCodexRealmEntries(
  row: RealmCodexWorldRow,
  major: number,
): RealmCodexRealmEntry[] {
  return row.realms.map((cell) => {
    const state = realmCodexRealmState(cell.index, major);
    return {
      ...cell,
      ordinal: cell.index + 1,
      state,
      stateLabel: realmCodexRealmStateLabel(state),
      stateMark: realmCodexRealmStateMark(state),
    };
  });
}
