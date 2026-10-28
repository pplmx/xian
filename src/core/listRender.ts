/**
 * 长列表的渐进渲染窗口。
 *
 * 清单再长也没必要让成百上千行在第一帧一起进 DOM。调用方先给一批,玩家显式续开
 * 再放下一批;排序与完整清单始终留在数据层。
 */
export interface ListWindow<T> {
  visible: T[];
  /** 当前窗口在完整清单里的起点(0 起) */
  start: number;
  /** 已向前开到哪一件(用于「第 start+1–shown 件」与继续前翻) */
  shown: number;
  hidden: number;
}

function clampCount(value: number, total: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(total, Math.max(0, Math.trunc(value)));
}

/**
 * 当前窗口:`limit` 记录已前翻到哪一件,`maxVisible` 只限制这一刻真正进 DOM 的件数。
 * 到顶后继续前翻会滑掉最早一批 —— 既保留整份清单的可达性,也不让 DOM 无限增长。
 */
export function listWindow<T>(
  items: readonly T[],
  limit: number,
  maxVisible = Number.POSITIVE_INFINITY,
): ListWindow<T> {
  const shown = clampCount(limit, items.length);
  const windowSize = Number.isFinite(maxVisible) ? Math.max(0, Math.trunc(maxVisible)) : shown;
  const start = Math.max(0, shown - windowSize);
  return {
    visible: items.slice(start, shown),
    start,
    shown,
    hidden: items.length - shown,
  };
}

/** 再开一批;清单变短时直接把窗口收口到真实件数 */
export function nextListLimit(shown: number, total: number, batch: number): number {
  const current = clampCount(shown, total);
  const step = Number.isFinite(batch) ? Math.max(1, Math.trunc(batch)) : 1;
  return Math.min(total, current + step);
}

/** 前翻一批;第一批是地板,清单变短时仍收口到真实件数 */
export function previousListLimit(shown: number, total: number, batch: number): number {
  const current = clampCount(shown, total);
  if (!Number.isFinite(batch) || batch <= 0) return current;
  const step = Math.max(1, Math.trunc(batch));
  const firstPage = Math.min(current, step);
  // 末页常是短批(66 = 24 + 24 + 18);退要回到上一页边界 48,不是盲目减 24 到 42。
  const previousPage = Math.floor((current - 1) / step) * step;
  return Math.max(firstPage, previousPage);
}

/**
 * 续开后,新露出的第一件在当前 visible 数组里的索引。
 *
 * 可见窗大于一批时,第一次续开是追加 —— 焦点若回到 visible[0],键盘用户仍停在旧内容;
 * 窗口滑走时才该从 0 开始。界面只负责按这个索引聚焦,别各自猜。
 */
export function firstNewVisibleIndex(
  shownBefore: number,
  shownAfter: number,
  maxVisible: number,
): number {
  const before = Number.isFinite(shownBefore) ? Math.max(0, Math.trunc(shownBefore)) : 0;
  const normalizedAfter = Number.isFinite(shownAfter)
    ? Math.max(0, Math.trunc(shownAfter))
    : before;
  if (normalizedAfter <= before) return 0;
  const after = normalizedAfter;
  const windowSize = Number.isFinite(maxVisible) ? Math.max(0, Math.trunc(maxVisible)) : after;
  const start = Math.max(0, after - windowSize);
  return Math.max(0, before - start);
}
