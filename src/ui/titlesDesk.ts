/**
 * 名号与灵兽的展示装配。
 *
 * 两册的事实仍分别来自 `core/titleProgress`、称号/灵兽数据与玩家当前选择；
 * 这里只把「几成已收」「这一行处于哪一态」翻成卷首与名册共用的读数，
 * 避免组件里同时维护计数、进度条与三套状态文案。
 */

export interface NameBeastMeter {
  owned: number;
  total: number;
  ratio: number;
  complete: boolean;
}

export interface NameBeastEntryState {
  state: "active" | "owned" | "locked";
  mark: string;
  label: string;
}

function finiteCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function nameBeastMeter(owned: number, total: number): NameBeastMeter {
  const safeTotal = finiteCount(total);
  const safeOwned = Math.min(safeTotal, finiteCount(owned));
  return {
    owned: safeOwned,
    total: safeTotal,
    ratio: safeTotal > 0 ? safeOwned / safeTotal : 0,
    complete: safeTotal > 0 && safeOwned === safeTotal,
  };
}

/** 名号行的「佩 / 藏 / 未」只看当前佩戴与拥有状态。 */
export function titleEntryState(row: { owned: boolean; worn: boolean }): NameBeastEntryState {
  if (row.worn) return { state: "active", mark: "佩", label: "佩戴中" };
  if (row.owned) return { state: "owned", mark: "藏", label: "已收藏" };
  return { state: "locked", mark: "未", label: "未获得" };
}

/** 灵兽行的「伴 / 契 / 未」只看当前相伴与结缘状态。 */
export function petEntryState(row: { owned: boolean; active: boolean }): NameBeastEntryState {
  if (row.active) return { state: "active", mark: "伴", label: "相伴中" };
  if (row.owned) return { state: "owned", mark: "契", label: "已结缘" };
  return { state: "locked", mark: "未", label: "未结缘" };
}
