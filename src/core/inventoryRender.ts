/**
 * 背包藏品列表的渲染窗口。
 *
 * 装备不会因为清单长就失去价值,但也没必要让 300 张卡在第一帧一起进 DOM:
 * 每张卡除了图标与名字,还有佩戴、锁定、共鸣、品阶、强化等多枚角标。先放一批,
 * 玩家滚到底再续开,既保留同一份排序与详情入口,也把常态渲染量收在有限区间。
 */
export const INVENTORY_RENDER_BATCH = 40;

export interface InventoryWindow<T> {
  visible: T[];
  shown: number;
  hidden: number;
}

function clampCount(value: number, total: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(total, Math.max(0, Math.trunc(value)));
}

/** 当前窗口:`limit` 只影响渲染,不改变传入的完整清单与排序 */
export function inventoryWindow<T>(items: readonly T[], limit: number): InventoryWindow<T> {
  const shown = clampCount(limit, items.length);
  return {
    visible: items.slice(0, shown),
    shown,
    hidden: items.length - shown,
  };
}

/** 再开一批;清单变短时直接把窗口收口到真实件数 */
export function nextInventoryLimit(shown: number, total: number): number {
  const current = clampCount(shown, total);
  return Math.min(total, current + INVENTORY_RENDER_BATCH);
}
