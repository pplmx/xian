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
  state: "active" | "companion" | "owned" | "locked";
  mark: string;
  label: string;
}

/** 双契总览的一册:当前选择、收藏刻度与下一程都走同一份读数。 */
export interface NameBeastChoice<T extends string = string> {
  id: T;
  label: string;
  mark: string;
  eyebrow: string;
  currentName: string;
  count: number;
  total: number;
  ratio: number;
  note: string;
  complete: boolean;
  dot?: boolean;
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

/**
 * 灵兽行的「伴 / 曾 / 契 / 未」。
 *
 * 四档与图鉴 (`ui/codex` 的 `PET_STAGE_NAMES`) 对齐 —— 此前这里只收
 * `{ owned, active }`,于是**曾经相伴、此刻不随行**的灵兽落回「已结缘」,
 * 那段同行在名册里根本不存在。而 `quests.petCompanions` 的注释明写着它是
 * 「曾相伴/相伴中」档的**唯一来源**,图鉴照做了,名册没读。
 *
 * 底线与 `petStage` 同一条:没结的缘不认相伴标记 —— 旧档里留着标记也不发明一段相遇。
 */
export function petEntryState(row: {
  owned: boolean;
  active: boolean;
  wasCompanion?: boolean;
}): NameBeastEntryState {
  if (!row.owned) return { state: "locked", mark: "未", label: "未结缘" };
  if (row.active) return { state: "active", mark: "伴", label: "相伴中" };
  if (row.wasCompanion) return { state: "companion", mark: "曾", label: "曾相伴" };
  return { state: "owned", mark: "契", label: "已结缘" };
}
