/**
 * 道途深化(Phase 21)—— 剑意 / 杀意 / 长生印 / 天机透视的纯逻辑
 * 长生印在 CombatRules.perRounds 中实现;此处承载剑道纯度与逐胜叠层
 */
import type { StatMods } from "@/types";
import type { BuildDetection } from "./buildDetect";
import { modOf } from "./statsCalc";
import { STYLE_MATURE_AFFINITY } from "./buildDetect";

/** 纯度判据里「主流派成形」那一项的名字 —— 百分比从阈值现算,不手写「60%」 */
const MATURE_PURITY_NAME = `主流派成形(契合 ≥${Math.round(STYLE_MATURE_AFFINITY * 100)}%)`;

/** 剑意每层加成 */
export const SWORD_LAYER_MODS: StatMods = { damageBonus: 0.04, critRate: 0.02 };
/** 剑道远征逐胜叠层 */
export const SWORD_PER_WIN: StatMods = { damageBonus: 0.04, critRate: 0.02 };
/** 杀伐远征逐胜叠层 */
export const SLAUGHTER_PER_WIN: StatMods = { damageBonus: 0.05 };

/** 剑意纯度判定的各项(检查当期值该不该给这一层) */
type PurityCheck = {
  name: string;
  test: (mods: StatMods, artifactCount: number, build: BuildDetection | null) => boolean;
};
const PURITY_CHECKS: PurityCheck[] = [
  {
    name: MATURE_PURITY_NAME,
    test: (_mods, _art, build) => (build?.affinity ?? 0) >= STYLE_MATURE_AFFINITY,
  },
  {
    name: "道路纯粹(无副体系)",
    test: (_mods, _art, build) => build !== null && build.secondary === undefined,
  },
  { name: "法宝不过一件", test: (_mods, art, _build) => art <= 1 },
  {
    name: "不修回血之术",
    test: (mods, _art, _build) => modOf(mods, "lifesteal") + modOf(mods, "regenPerRound") < 0.02,
  },
];

/** 剑意纯度总层数 —— 判定条数与界面「/N 层」同读这一枚(改一条就变,不手抄) */
export const SWORD_PURITY_MAX_LAYERS = PURITY_CHECKS.length;

export interface SwordPurity {
  layers: number;
  /** 各项纯度判定(供 UI 解释「为什么是这几层」) */
  checks: { name: string; ok: boolean }[];
}

/**
 * 剑意纯度(0~4 层):道途越纯,剑意越盛
 * ①主流派成形以上 ②不涉副体系 ③法宝不过一件 ④不修回血之术
 */
export function swordPurity(
  mods: StatMods,
  artifactCount: number,
  build: BuildDetection | null,
): SwordPurity {
  const checks = PURITY_CHECKS.map((c) => ({
    name: c.name,
    ok: c.test(mods, artifactCount, build),
  }));
  return { layers: checks.filter((c) => c.ok).length, checks };
}

/** 将词条按层数叠加(不改原对象) */
export function stackedMods(base: StatMods, layer: StatMods, n: number): StatMods {
  if (n <= 0) return base;
  const out: StatMods = { ...base };
  for (const k in layer) {
    const key = k as keyof StatMods;
    out[key] = (out[key] ?? 0) + (layer[key] ?? 0) * n;
  }
  return out;
}

/**
 * 杀伐道「速战之赏」的三档 —— **阈值与赏格只写这一处**。
 *
 * 界面要报「当前哪一档、离下一档还差多少」,若在视图里再写一遍 12/18/24,
 * 改一处就分叉。故把阶梯摊成一张表,判定与读数同读它。
 *
 * `perFight` 是**每场均回合数**;`bonus` 是道源加成。
 * 表按「越严越先」排:命中第一条即返回。
 */
export const SLAUGHTER_SPEED_TIERS = [
  { maxPerFight: 12, bonus: 0.25 },
  { maxPerFight: 18, bonus: 0.15 },
  { maxPerFight: 24, bonus: 0.08 },
] as const;

/** 杀伐道速战之赏:远征总回合越短,道源加成越高(至多 +25%) */
export function slaughterSpeedBonus(totalRounds: number, fights: number): number {
  return slaughterSpeedTierOf(totalRounds, fights)?.bonus ?? 0;
}

/**
 * 当前落在速战阶梯的哪一档,以及**离下一档还差多少**。
 *
 * 界面此前只报一个「(含杀伐速战之赏)」的 toast 尾巴 —— 玩家永远不知道
 * 自己差几回合能跳档。这一层把「已经拿到哪档、再快多少能进下一档」算出来。
 *
 * 返回值:
 * - `bonus` 当前档的赏格(0 表示一档都没进);
 * - `next` 下一档(已是最高档或进不去时为 null);
 * - `perFight` 每场均回合(界面要报它,玩家才知道"差多少");
 * - `nextGapPerFight` 离下一档还需把每场均回合压到多少以内(无下一档时 null)。
 */
export function slaughterSpeedTierOf(
  totalRounds: number,
  fights: number,
): {
  bonus: number;
  perFight: number;
  next: { maxPerFight: number; bonus: number } | null;
} | null {
  const safeFights = Math.max(1, fights);
  const perFight = Math.max(0, totalRounds) / safeFights;
  const hit = SLAUGHTER_SPEED_TIERS.find((t) => perFight < t.maxPerFight);
  if (hit) {
    // 已是最高档(命中第一条)则没有下一档
    const idx = SLAUGHTER_SPEED_TIERS.indexOf(hit);
    const next = idx > 0 ? SLAUGHTER_SPEED_TIERS[idx - 1]! : null;
    return { bonus: hit.bonus, perFight, next: next ? { ...next } : null };
  }
  // 一档都没进:下一档是最后一条(最容易的那档)
  const lowest = SLAUGHTER_SPEED_TIERS[SLAUGHTER_SPEED_TIERS.length - 1]!;
  return { bonus: 0, perFight, next: { ...lowest } };
}
