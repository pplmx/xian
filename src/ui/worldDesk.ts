/**
 * 地界志的展示装配。
 *
 * 路线状态仍由 core/mortalWorldService 给出；这里只把同一份阶段结果换算成
 * 卷首山图、本世总账与路线标题共用的进度读数，避免三处各数一遍。
 */
import type { MortalStageStatus, PlaceView } from "@/core/mortalWorldService";

export interface WorldDeskMeter {
  total: number;
  cleared: number;
  remaining: number;
  ratio: number;
  currentIndex: number;
  currentName: string;
  currentOrdinal: string;
  atlasMark: string;
}

export function worldDeskMeter(
  places: readonly PlaceView[],
  statuses: readonly MortalStageStatus[],
): WorldDeskMeter {
  const total = places.length;
  const known = Math.min(total, statuses.length);
  const cleared = statuses.slice(0, known).filter((status) => status.state === "cleared").length;
  const currentIndex = statuses.slice(0, known).findIndex((status) => status.state === "current");
  const current = currentIndex >= 0 ? places[currentIndex] : null;

  return {
    total,
    cleared,
    remaining: Math.max(0, total - cleared),
    ratio: total > 0 ? cleared / total : 0,
    currentIndex,
    currentName: current?.name ?? "全程已行",
    currentOrdinal: currentIndex >= 0 ? `第 ${currentIndex + 1} 程` : "全程已行",
    atlasMark: current?.name.slice(0, 1) ?? "山",
  };
}
