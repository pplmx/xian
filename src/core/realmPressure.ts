/**
 * 境界压制 —— 低境闯高境内容时的统一战斗规则。
 *
 * 它不封入口:绝对三维、法宝、功法与临场 build 仍可让低境修士赢下高境地界,
 * 只是必须付出更高代价。压制按「目标境界 - 玩家境界」连续增重,到五境封顶,
 * 避免跨太多境时被无限乘积变成数学上不可达的硬墙。
 */
import type { FoeOrigin, FoeOriginPart } from "@/types";
import { MAX_MAJOR, REALMS } from "@/data/realms";
import {
  REALM_PRESSURE_CAP_GAP,
  REALM_PRESSURE_DAMAGE_BONUS_PER_GAP,
  REALM_PRESSURE_DAMAGE_REDUCTION_PER_GAP,
  REALM_PRESSURE_ENEMY_SCALE_PER_GAP,
} from "@/data/constants";

export { REALM_PRESSURE_CAP_GAP } from "@/data/constants";

export interface RealmPressure {
  active: boolean;
  /** 实际差了几个大境界(玩家高于目标时为 0) */
  gap: number;
  /** 参与数值换算的差境数(封顶后的值) */
  effectiveGap: number;
  capped: boolean;
  playerMajor: number;
  targetMajor: number;
  playerRealmName: string;
  targetRealmName: string;
  /** 敌方攻防血统一倍率 */
  enemyScale: number;
  /** 敌方伤害增幅 */
  damageBonus: number;
  /** 敌方伤害减免 */
  damageReduction: number;
  label: string;
  summary: string;
  guidance: string;
}

function majorName(major: number): string {
  const m = normalizedMajor(major);
  return REALMS[m]?.name ?? "未知";
}

function normalizedMajor(major: number): number {
  if (!Number.isFinite(major)) return 0;
  return Math.max(0, Math.min(MAX_MAJOR, Math.trunc(major)));
}

/** 把境界差折成一份可同时给战斗、战前提示与战报读取的压制账。 */
export function realmPressure(playerMajor: number, targetMajor: number): RealmPressure {
  const player = normalizedMajor(playerMajor);
  const target = normalizedMajor(targetMajor);
  const gap = Math.max(0, target - player);
  const effectiveGap = Math.min(REALM_PRESSURE_CAP_GAP, gap);
  const active = effectiveGap > 0;
  const capped = gap > REALM_PRESSURE_CAP_GAP;
  const enemyScale = 1 + REALM_PRESSURE_ENEMY_SCALE_PER_GAP * effectiveGap;
  const damageBonus = REALM_PRESSURE_DAMAGE_BONUS_PER_GAP * effectiveGap;
  const damageReduction = REALM_PRESSURE_DAMAGE_REDUCTION_PER_GAP * effectiveGap;
  const playerRealmName = majorName(player);
  const targetRealmName = majorName(target);
  const capText = capped ? `，数值按 ${REALM_PRESSURE_CAP_GAP} 境封顶` : "";
  const summary = active
    ? `${playerRealmName}闯${targetRealmName}（境界差 ${gap}${capText}）：` +
      `敌三维 ×${enemyScale.toFixed(2)} · 增伤 +${Math.round(damageBonus * 100)}% · ` +
      `减伤 +${Math.round(damageReduction * 100)}%`
    : "境界相宜，无额外压制";
  return {
    active,
    gap,
    effectiveGap,
    capped,
    playerMajor: player,
    targetMajor: target,
    playerRealmName,
    targetRealmName,
    enemyScale,
    damageBonus,
    damageReduction,
    label: active ? `境界压制·差 ${gap} 境${capped ? "（封顶）" : ""}` : "无境界压制",
    summary,
    guidance: `境界压制不封路：法宝、功法与绝对三维够强仍可硬闯。差距越大压制越重，最多按 ${REALM_PRESSURE_CAP_GAP} 境计；金丹闯元婴记 1 境差，每缩小一境便减一档。`,
  };
}

/** 把压制写成来源明细的一项 —— 三维倍率与增伤减伤都从同一份 readout 来。 */
export function realmPressurePart(pressure: RealmPressure): FoeOriginPart {
  return {
    label: "境界压制",
    ratio: pressure.enemyScale,
    damageBonus: pressure.damageBonus,
    damageReduction: pressure.damageReduction,
  };
}

/** 把压制并入凡界敌人的既有来源账;无压制时原样返回,不自造一项 ×1。 */
export function applyRealmPressure(origin: FoeOrigin, pressure: RealmPressure): FoeOrigin {
  if (!pressure.active) return origin;
  const part = realmPressurePart(pressure);
  return {
    ...origin,
    label: origin.label ? `${origin.label} · ${part.label}` : part.label,
    ratio: origin.ratio * part.ratio,
    damageBonus: origin.damageBonus + pressure.damageBonus,
    damageReduction: origin.damageReduction + pressure.damageReduction,
    parts: [...origin.parts, part],
    note: pressure.guidance,
  };
}
