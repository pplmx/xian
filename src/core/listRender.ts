/**
 * 长列表的渐进渲染窗口。
 *
 * 清单再长也没必要让成百上千行在第一帧一起进 DOM。调用方先给一批,玩家显式续开
 * 再放下一批;排序与完整清单始终留在数据层。
 */
export interface ListWindow<T> {
  visible: T[];
  shown: number;
  hidden: number;
}

function clampCount(value: number, total: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(total, Math.max(0, Math.trunc(value)));
}

/** 当前窗口:`limit` 只影响渲染,不改变传入的完整清单与排序 */
export function listWindow<T>(items: readonly T[], limit: number): ListWindow<T> {
  const shown = clampCount(limit, items.length);
  return {
    visible: items.slice(0, shown),
    shown,
    hidden: items.length - shown,
  };
}

/** 再开一批;清单变短时直接把窗口收口到真实件数 */
export function nextListLimit(shown: number, total: number, batch: number): number {
  const current = clampCount(shown, total);
  const step = Math.max(1, Math.trunc(batch));
  return Math.min(total, current + step);
}
