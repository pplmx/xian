import {
  heritageGroups,
  type HeritageGroup,
  type HeritageMode,
  type HeritageRow,
} from "@/core/samsaraAudit";

export type ReincarnationStageId = "death" | "review" | "choice";
export type ReincarnationStageState = "done" | "current" | "upcoming";

export const REINCARNATION_STAGES: ReadonlyArray<{
  id: ReincarnationStageId;
  ordinal: string;
  name: string;
  note: string;
}> = [
  { id: "death", ordinal: "一", name: "辞世", note: "寿数已尽" },
  { id: "review", ordinal: "二", name: "回照", note: "只读不落账" },
  { id: "choice", ordinal: "三", name: "择生", note: "落子不可撤回" },
];

export function reincarnationStageState(
  stageIndex: number,
  activeIndex: number,
): ReincarnationStageState {
  if (stageIndex < activeIndex) return "done";
  if (stageIndex === activeIndex) return "current";
  return "upcoming";
}

export interface SamsaraLedgerGroup extends HeritageGroup {
  count: number;
  mark: string;
  tone: `is-${HeritageMode}`;
}

export interface SamsaraBalance {
  full: number;
  partial: number;
  reset: number;
  keep: number;
  total: number;
}

export interface SamsaraCriticalRow {
  id: string;
  name: string;
  mode: HeritageMode;
  power: HeritageRow["power"];
  detail: string;
  mark: string;
  groupTitle: string;
  tone: `is-${HeritageMode}`;
}

export interface ReincarnationConfirmGate {
  disabled: boolean;
  state: "blocked" | "ready" | "empty";
  short: string;
  detail: string;
}

const MODE_MARK: Record<HeritageMode, string> = {
  full: "留",
  partial: "折",
  reset: "散",
};

export function samsaraLedger(groups: HeritageGroup[] = heritageGroups()): SamsaraLedgerGroup[] {
  return groups.map((group) => ({
    ...group,
    count: group.rows.length,
    mark: MODE_MARK[group.mode],
    tone: `is-${group.mode}`,
  }));
}

export function samsaraBalance(ledger: SamsaraLedgerGroup[] = samsaraLedger()): SamsaraBalance {
  const count = (mode: HeritageMode) => ledger.find((group) => group.mode === mode)?.count ?? 0;
  const full = count("full");
  const partial = count("partial");
  const reset = count("reset");
  return {
    full,
    partial,
    reset,
    keep: full + partial,
    total: full + partial + reset,
  };
}

export function criticalSamsaraRows(
  ledger: SamsaraLedgerGroup[] = samsaraLedger(),
): SamsaraCriticalRow[] {
  return ledger.flatMap((group) =>
    group.rows
      .filter((row) => row.mode === "partial" || (row.mode === "reset" && row.power === "high"))
      .map((row) => ({
        id: row.id,
        name: row.name,
        mode: row.mode,
        power: row.power,
        detail: row.detail,
        mark: group.mark,
        groupTitle: group.title,
        tone: group.tone,
      })),
  );
}

export function reincarnationConfirmGate(
  choiceCount: number,
  chosen: string | null,
): ReincarnationConfirmGate {
  if (choiceCount === 0) {
    return {
      disabled: false,
      state: "empty",
      short: "先天之姿已尽，可直接落子",
      detail: "姿池已抽空，这一刻没有必须再选的项目。",
    };
  }
  if (!chosen) {
    return {
      disabled: true,
      state: "blocked",
      short: `先择一先天之姿（${choiceCount} 项可选）`,
      detail: "选定后才能落下此印；点选本身不会改写存档。",
    };
  }
  return {
    disabled: false,
    state: "ready",
    short: "此印一落，此生归档",
    detail: "道号、灵根、境界与天地都会换新；资源与外物随皮囊散去。",
  };
}
