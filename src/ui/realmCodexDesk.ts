import {
  realmCodexWorldStatus,
  type RealmCodexCurrent,
  type RealmCodexWorldRow,
  type RealmWorldState,
} from "@/core/realmCodex";
import { CODEX_CHAPTERS } from "@/ui/navigation";
import { realmDef } from "@/data/realms";

export type RealmCodexTab = (typeof CODEX_CHAPTERS)[number]["id"];

export interface RealmCodexChapter {
  tab: RealmCodexTab;
  index: string;
  title: string;
  hint: string;
}

const CHAPTER_INDEXES = ["壹", "贰", "叁", "肆", "伍", "陆"] as const;

const CHAPTER_HINTS = {
  realm: "四界成卷，先看此刻，再翻境界谱",
  classics: "境界名背后的原典，点相涉之境可回望",
  yi: "八卦为体，重卦为用，一卦在身则过时自散",
  ziwei: "一时之机在卦，一世之格在命",
  xiang: "值日之宿只利一方，先看今日所利",
  qimen: "依洛书排布，择门只改这一趟打法",
} satisfies Record<RealmCodexTab, string>;

/**
 * 六册的卷次、题名与读法只装配一次。
 *
 * 题名直接读导航册目，章序也沿用导航顺序；各册的具体事实仍由页面直读
 * 原有数据表、store 与 core 派生值，这里不另记一份会漂的读数。
 */
export function realmCodexChapters(): RealmCodexChapter[] {
  return CODEX_CHAPTERS.map((chapter, index) => ({
    tab: chapter.id,
    index: CHAPTER_INDEXES[index] ?? String(index + 1),
    title: chapter.label,
    hint: CHAPTER_HINTS[chapter.id],
  }));
}

export function realmCodexChapter(tab: RealmCodexTab): RealmCodexChapter {
  const chapter = realmCodexChapters().find((candidate) => candidate.tab === tab);
  if (!chapter) throw new Error(`unknown realm codex chapter: ${tab}`);
  return chapter;
}

/** 四界的单字印。界名仍从 WORLDS 读，这里只给卷目与谱图一枚可扫读的记号。 */
export const REALM_WORLD_MARKS: Record<string, string> = {
  mortal: "凡",
  immortal: "仙",
  god: "神",
  chaos: "混",
};

/**
 * 卷首那一行「此身曾至」。
 *
 * 只在这一世**没走回**那个高度时才有话说:当前境就是历世最高,读出来与「此刻在此」
 * 完全重复,那正是本仓刚清掉的那类同屏两遍。所以给 null,整行不出。
 */
export function realmCodexPeakLine(
  current: RealmCodexCurrent,
  peakMajor: number,
): { def: RealmCodexCurrent["def"]; label: string } | null {
  const peak = Number.isFinite(peakMajor) ? Math.max(0, Math.trunc(peakMajor)) : 0;
  if (peak <= current.index) return null;
  const def = realmDef(peak);
  return { def, label: `此身曾至 ${def.name}` };
}

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
  /** 三态之外多一种「曾至」:历世到过、而这一世还没重新走到的境 */
  state: RealmWorldState | "reached";
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

export function realmCodexRealmStateLabel(state: RealmWorldState | "reached"): string {
  if (state === "past") return "已渡";
  if (state === "current") return "此刻";
  if (state === "reached") return "曾至";
  return "未至";
}

export function realmCodexRealmStateMark(state: RealmWorldState | "reached"): string {
  if (state === "past") return "渡";
  if (state === "current") return "此";
  if (state === "reached") return "曾";
  return "待";
}

/**
 * 谱上那一行的读法。
 *
 * 三态(已渡 / 此刻 / 未至)说的是**这一世**走到了哪里;可转世会把这一世折回起点,
 * 于是你上个月刚从真仙转世下来,谱上那一行照样写「未至」—— 而它明明在历世履历里。
 *
 * 第四种读法补的就是这一段:**当前境之上、曾到过的**那些境,读「曾至」。
 * 它不改任何门槛:`major` 仍是唯一决定你能做什么的数,这里只多一句话。
 * 当前境本身仍是「此刻」—— 「此刻在真仙」比「曾至真仙」信息量大。
 */
export function realmCodexRealmState(
  index: number,
  major: number,
  peakMajor = major,
): RealmWorldState | "reached" {
  const at = Number.isFinite(major) ? Math.max(0, Math.trunc(major)) : 0;
  if (index < at) return "past";
  if (index === at) return "current";
  const peak = Number.isFinite(peakMajor) ? Math.max(at, Math.trunc(peakMajor)) : at;
  if (index <= peak) return "reached";
  return "future";
}

export function realmCodexRealmEntries(
  row: RealmCodexWorldRow,
  major: number,
  peakMajor = major,
): RealmCodexRealmEntry[] {
  return row.realms.map((cell) => {
    const state = realmCodexRealmState(cell.index, major, peakMajor);
    return {
      ...cell,
      ordinal: cell.index + 1,
      state,
      stateLabel: realmCodexRealmStateLabel(state),
      stateMark: realmCodexRealmStateMark(state),
    };
  });
}
