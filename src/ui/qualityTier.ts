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
 * 品阶色直接落在自己的 6% 晕染上时，精品石青在夜间手机实测只有 4.45:1；神品
 * 朱砂甚至只有 4.49:1。这里让凡品回到正文墨色，其余品阶都向墨色收 20% ——
 * 色相仍由原品阶色承担，字却不会被随机货架抽到某一档时跌破 AA。
 */
export function qualityTextColor(quality: QualityId): string {
  const def = qualityDef(quality);
  if (def.rank === 0) return "var(--color-ink)";
  return `color-mix(in srgb, ${def.color} 80%, var(--color-ink) 20%)`;
}
