import type { QualityId } from "@/types";
import { qualityDef } from "@/data/qualities";

/**
 * 品阶的三档视觉强度 —— 九档颜色线性排下来,玩家记不住哪色是哪档;
 * 折成三档晕染(凡良精 / 灵玄地 / 天仙神),档与档之间拉开,档内一致,
 * 这才是可记忆的视觉语言。ItemCell(格匣)与 EquipmentCard(装备格)同源调用,
 * 不许各自写一份强度 —— 两本账就会漂。
 *
 * 阈值取 rank:≤2 常见、3-5 进阶、≥6 稀有(天/仙/神)。
 * 稀有档另有 QualitySeal 角章作形状线索 —— 色弱玩家不靠颜色也能分档。
 */
export function qualityTierStyle(quality: QualityId): { border: number; bg: number } {
  const rank = qualityDef(quality).rank;
  if (rank >= 6) return { border: 0.85, bg: 0.13 };
  if (rank >= 3) return { border: 0.55, bg: 0.1 };
  return { border: 0.33, bg: 0.06 };
}

/** 稀有档(天/仙/神)—— 该盖品阶角章的那批 */
export function isRareQuality(quality: QualityId): boolean {
  return qualityDef(quality).rank >= 6;
}

/**
 * 品阶名当正文时的字色。
 *
 * 凡品原用 ink-soft，直接落在纸面尚可；一旦叠上自己 6% 的品阶晕染，夜间手机
 * 实测只剩 4.45:1。良品的石绿也离边界太近，85/15 时只剩 4.46:1。这里让凡品
 * 回到正文墨色，并把良品向墨色收到 75/25；晕染仍用品阶原色，不把同行的说明与
 * 价格一起推过 AA 线。
 */
export function qualityTextColor(quality: QualityId): string {
  const def = qualityDef(quality);
  if (def.rank === 0) return "var(--color-ink)";
  if (def.rank === 1) {
    return `color-mix(in srgb, ${def.color} 75%, var(--color-ink) 25%)`;
  }
  return def.color;
}
