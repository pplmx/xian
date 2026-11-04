import type { QualityId } from "@/types";
import { qualityDef } from "@/data/qualities";

/**
 * 品阶的视觉强度 —— 九档颜色线性排下来,玩家记不住哪色是哪档;
 * 折成三档晕染(凡良精 / 灵玄地 / 天仙神),档与档之间拉开,档内一致,
 * 这才是可记忆的视觉语言。
 *
 * 真正消费这份强度的只有**器评帖**(它写进 --equip-edge / --equip-wash 两个变量)。
 * 行囊的格匣走 ledger 模式(细线网格),刻意不铺品阶色 —— 那是账目式版面,
 * 铺上色会让一整屏格子花掉。故强度不是"处处生效"的,这一点写在调用点上也一样。
 *
 * 阈值取 rank:≤2 常见、3-5 进阶、≥6 稀有(天/仙/神)。
 * 稀有档另有 QualitySeal 角章作形状线索 —— 色弱玩家不靠颜色也能分档。
 *
 * ## 稀有段内部再分三层(为什么破了自己「档内一致」的规矩)
 *
 * 天 6 / 仙 7 / 神 8 原本全落在同一个 `{0.85, 0.13}` 上 —— 同一圈边、同一层底。
 * 而这三档恰是玩家真正会摆在一起比的东西:行囊里同时有仙品与神品时,
 * 界面上那一圈边一模一样,差别只剩名字与颜色。
 *
 * 故**只在最贵的那一段内部分层**(0.85 → 0.92 → 1.00),另两段不动。
 * 不把九档各给一个值:那就又回到「记不住」,而档内一致正是为了让玩家
 * 只记三段。选稀有段破例,是因为那里分辨意愿最强、件数最少
 * (天 0 / 仙 1 / 神 5,见 data/artifacts 的分布)。
 *
 * 顶格就是 1.00:再往上只能靠阴影与动效,那是另一套语言(QualitySeal 的阴文章、
 * animate-glow-pulse 的呼吸),留给以后。
 */
const RARE_LADDER: Record<number, { border: number; bg: number }> = {
  6: { border: 0.85, bg: 0.13 }, // 天 —— 原值,已发到玩家眼里的那一档不变
  7: { border: 0.92, bg: 0.17 }, // 仙
  8: { border: 1, bg: 0.22 }, // 神
};

export function qualityTierStyle(quality: QualityId): { border: number; bg: number } {
  const rank = qualityDef(quality).rank;
  const rare = RARE_LADDER[rank];
  if (rare) return rare;
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
