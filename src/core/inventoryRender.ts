import { listWindow, nextListLimit } from "./listRender";

/** 背包与坊市的每批件数:每张装备卡都带多枚状态角标,40 件已足够撑住一屏。 */
export const INVENTORY_RENDER_BATCH = 40;

/** 当前窗口:`limit` 只影响渲染,不改变传入的完整清单与排序 */
export const inventoryWindow = listWindow;

/** 再开一批;清单变短时直接把窗口收口到真实件数 */
export function nextInventoryLimit(
  shown: number,
  total: number,
  batch = INVENTORY_RENDER_BATCH,
): number {
  return nextListLimit(shown, total, batch);
}
