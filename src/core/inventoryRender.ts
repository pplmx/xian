import { listWindow, nextListLimit, previousListLimit } from "./listRender";

/**
 * 背包与坊市的每批件数。四列下 32 件正好八行,已远超一屏;
 * 40 件里若混入带品阶章/共鸣标的卡,实测峰值会到 754 DOM,越过 700 的背包预算。
 */
export const INVENTORY_RENDER_BATCH = 32;

/** 背包一次只留一批:80 张卡实测 1048 DOM,已越过 800 的背包首帧预算。 */
export const INVENTORY_RENDER_WINDOW = INVENTORY_RENDER_BATCH;

/** 坊市是短横条/弹窗行,不比整张装备卡;两批可见仍能守在 1100 DOM 内。 */
export const MARKET_RENDER_WINDOW = INVENTORY_RENDER_BATCH * 2;

/** 当前窗口:`limit` 只影响渲染,不改变传入的完整清单与排序 */
export function inventoryWindow<T>(
  items: readonly T[],
  limit: number,
  maxVisible = INVENTORY_RENDER_WINDOW,
) {
  return listWindow(items, limit, maxVisible);
}

/** 再开一批;清单变短时直接把窗口收口到真实件数 */
export function nextInventoryLimit(
  shown: number,
  total: number,
  batch = INVENTORY_RENDER_BATCH,
): number {
  return nextListLimit(shown, total, batch);
}

/** 前翻一批;第一批是地板 */
export function previousInventoryLimit(
  shown: number,
  total: number,
  batch = INVENTORY_RENDER_BATCH,
): number {
  return previousListLimit(shown, total, batch);
}
