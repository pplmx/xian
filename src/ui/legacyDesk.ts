/**
 * 三生录的展示装配。
 *
 * 历世、宿慧、所知、旧缘与极境都来自各自的事实源；这里只把「有 / 共」换算成
 * 卷首盘面与账页共用的比例、差额和完成态，避免视图里再各写一套夹取。
 */

export interface LegacyMeter {
  value: number;
  total: number;
  ratio: number;
  complete: boolean;
}

export interface LegacyStageMeter extends LegacyMeter {
  floor: number;
  ceiling: number | null;
  remaining: number;
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** 一条「已有 / 共有」进度；零总量不算完成，避免空表伪装成圆满。 */
export function legacyMeter(value: number, total: number): LegacyMeter {
  const safeTotal = count(total);
  const safeValue = Math.min(safeTotal, count(value));
  return {
    value: safeValue,
    total: safeTotal,
    ratio: safeTotal > 0 ? safeValue / safeTotal : 0,
    complete: safeTotal > 0 && safeValue === safeTotal,
  };
}

/** 宿慧阶梯只量当前阶到下一阶的这一段；顶阶没有 ceiling，直接算走满。 */
export function legacyStageMeter(
  insight: number,
  floor: number,
  ceiling: number | null,
): LegacyStageMeter {
  const safeInsight = count(insight);
  const safeFloor = count(floor);
  const safeCeiling =
    ceiling !== null && Number.isFinite(ceiling) && ceiling > safeFloor ? count(ceiling) : null;
  if (safeCeiling === null) {
    return {
      value: safeInsight,
      total: safeInsight,
      ratio: 1,
      complete: true,
      floor: safeFloor,
      ceiling: null,
      remaining: 0,
    };
  }
  const span = safeCeiling - safeFloor;
  const passed = Math.min(span, Math.max(0, safeInsight - safeFloor));
  return {
    value: passed,
    total: span,
    ratio: passed / span,
    complete: passed >= span,
    floor: safeFloor,
    ceiling: safeCeiling,
    remaining: Math.max(0, safeCeiling - safeInsight),
  };
}

/** 把几本「已有 / 共有」合成一条总覆盖率，供卷首盘面读。 */
export function legacyCoverage(rows: readonly { value: number; total: number }[]): LegacyMeter {
  let value = 0;
  let total = 0;
  for (const row of rows) {
    const meter = legacyMeter(row.value, row.total);
    value += meter.value;
    total += meter.total;
  }
  return legacyMeter(value, total);
}
