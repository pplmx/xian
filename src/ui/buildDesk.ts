/**
 * 流派页的展示装配。
 *
 * 识别、契合与核心词条仍由 core/buildDetect 提供；这里只把「当前走到哪一段」
 * 与「下一步该补哪几条」换算成卷首盘、阶段账和行动清单共用的读数。
 */
import {
  STYLE_EMERGENCE_AFFINITY,
  STYLE_MASTER_AFFINITY,
  STYLE_MATURE_AFFINITY,
  type BuildAffinityRow,
} from "@/core/buildDetect";

export type BuildStageName = "未成" | "雏形" | "成形" | "大成";

export interface BuildStageMeter {
  stage: BuildStageName;
  floor: number;
  ceiling: number | null;
  ratio: number;
  gap: number;
}

export interface BuildCoreGap {
  key: BuildAffinityRow["terms"][number]["key"];
  value: number;
  reference: number;
  ratio: number;
  gap: number;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** 当前契合落在哪一段，以及离下一形态还差多少。 */
export function buildStageMeter(affinity: number): BuildStageMeter {
  const value = Math.max(0, finite(affinity));
  if (value < STYLE_EMERGENCE_AFFINITY) {
    return {
      stage: "未成",
      floor: 0,
      ceiling: STYLE_EMERGENCE_AFFINITY,
      ratio: value / STYLE_EMERGENCE_AFFINITY,
      gap: Math.max(0, STYLE_EMERGENCE_AFFINITY - value),
    };
  }
  if (value < STYLE_MATURE_AFFINITY) {
    const span = STYLE_MATURE_AFFINITY - STYLE_EMERGENCE_AFFINITY;
    return {
      stage: "雏形",
      floor: STYLE_EMERGENCE_AFFINITY,
      ceiling: STYLE_MATURE_AFFINITY,
      ratio: (value - STYLE_EMERGENCE_AFFINITY) / span,
      gap: Math.max(0, STYLE_MATURE_AFFINITY - value),
    };
  }
  if (value < STYLE_MASTER_AFFINITY) {
    const span = STYLE_MASTER_AFFINITY - STYLE_MATURE_AFFINITY;
    return {
      stage: "成形",
      floor: STYLE_MATURE_AFFINITY,
      ceiling: STYLE_MASTER_AFFINITY,
      ratio: (value - STYLE_MATURE_AFFINITY) / span,
      gap: Math.max(0, STYLE_MASTER_AFFINITY - value),
    };
  }
  return {
    stage: "大成",
    floor: STYLE_MASTER_AFFINITY,
    ceiling: null,
    ratio: 1,
    gap: 0,
  };
}

/** 核心词条还差多少；缺口最大的排在前面，供「下一步」只取前几条。 */
export function buildCoreGaps(row: BuildAffinityRow): BuildCoreGap[] {
  return row.terms
    .map((term) => {
      const value = Math.max(0, finite(term.value));
      const reference = Math.max(0, finite(term.reference));
      return {
        key: term.key,
        value,
        reference,
        ratio: reference > 0 ? Math.min(1, value / reference) : 1,
        gap: Math.max(0, reference - value),
      };
    })
    .filter((term) => term.gap > 0)
    .sort((a, b) => a.ratio - b.ratio);
}
