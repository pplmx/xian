/**
 * 随身所知五行 —— 每一行各折多少宿慧
 *
 * ## 缺口
 *
 * 修仙录「随身所知」列五行，抬头都是「达成数 / 总数」:
 *
 * ```text
 *   材  认得灵材   12 / 16 味
 *   方  通晓丹方    8 / 54 张
 *   谱  读通器谱    3 / 288 张
 *   敌  洞悉敌手    5 / 140 种
 *      技艺进度     动了 4 项 · 折宿慧 9      ← 只有这一行报了折算
 * ```
 *
 * 而 `samsaraService.loreInsight` 对五项各有一套权重:灵材每味 3 点(通晓再 +5)、
 * 丹方每张 4 点、器谱每张 1 点、技艺熟练度之和 ÷ 20、敌手每种 2 点。
 *
 * 于是玩家读「通晓丹方 8 / 54 张」时不知道这 8 张折了 **32 点宿慧**
 * （四项里仅次于技艺的那一份）;读「读通器谱 3 / 288」也不知道只折 3 点。
 * **权重差 4 倍，而界面长得一模一样。**
 *
 * 这不是新缺口，是同一处漏了四行 —— 上一轮补「技艺进度」时给那一行报了
 * 「折宿慧 9」，却没想到上面四行也该报。这比全都不报更糟:玩家会以为
 * 只有技艺折宿慧。
 *
 * ## 一份权重，两处读
 *
 * 本文件是**唯一的折算实现**，`samsaraService.loreInsight` 也调它。
 * 若界面另写一套，玩家把五行加起来会与抬头那个数对不上（「不做两本账」）。
 *
 * ## 这一层只算，不读 store
 */
import {
  INSIGHT_PER_BLUEPRINT,
  INSIGHT_PER_ENEMY,
  INSIGHT_PER_MATERIAL,
  INSIGHT_PER_MATERIAL_MASTERED,
  INSIGHT_PER_RECIPE,
  INSIGHT_SKILL_DIV,
} from "@/data/samsara";
import { LORE_MAX } from "@/data/materials";
import { ENEMY_LORE_MAX } from "@/core/loreThresholds";
import { SKILL_IDS, skillLevelFromExp } from "@/data/crafting";
import { isBlueprintMastered } from "@/core/blueprintMastery";

/** 折算所需的认知快照 —— 与 `samsaraService.LoreSnapshot` 同形 */
export interface LoreInsightSnapshot {
  materialLore: Readonly<Record<string, number>>;
  recipeLore: Readonly<Record<string, number>>;
  blueprintLore: Readonly<Record<string, number>>;
  skillExp: Readonly<Record<string, number>>;
  enemyLore: Readonly<Record<string, number>>;
}

/** 五项各折多少宿慧（未取整 —— 取整发生在总数那一层） */
export interface LoreInsightByKind {
  material: number;
  recipe: number;
  blueprint: number;
  skill: number;
  enemy: number;
}

/** 坏值（NaN / Infinity / 负）当作没折过 */
function num(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

const EMPTY: LoreInsightByKind = { material: 0, recipe: 0, blueprint: 0, skill: 0, enemy: 0 };

/**
 * 按项折算宿慧。
 *
 * 每一项的判定与 `loreInsight` 原先写在同一处，现在只此一份:
 *   灵材  认知 ≥1 记 3 点，=LORE_MAX 再记 5 点（「认得」与「通晓用法」两回事）
 *   丹方  掌握度 ≥1 每张 4 点
 *   器谱  满掌握（`isBlueprintMastered`）每张 1 点
 *   技艺  九项熟练度之和 ÷ INSIGHT_SKILL_DIV
 *   敌手  认知 = ENEMY_LORE_MAX 每种 2 点
 */
export function loreInsightByKind(snap: LoreInsightSnapshot): LoreInsightByKind {
  let material = 0;
  for (const v of Object.values(snap.materialLore ?? {})) {
    const lore = num(v);
    if (lore >= 1) material += INSIGHT_PER_MATERIAL;
    if (lore >= LORE_MAX) material += INSIGHT_PER_MATERIAL_MASTERED;
  }

  let recipe = 0;
  for (const v of Object.values(snap.recipeLore ?? {})) {
    if (num(v) >= 1) recipe += INSIGHT_PER_RECIPE;
  }

  let blueprint = 0;
  for (const v of Object.values(snap.blueprintLore ?? {})) {
    if (isBlueprintMastered(num(v))) blueprint += INSIGHT_PER_BLUEPRINT;
  }

  let skillSum = 0;
  for (const id of SKILL_IDS) {
    skillSum += skillLevelFromExp(num(snap.skillExp?.[id]));
  }
  const skill = skillSum / INSIGHT_SKILL_DIV;

  let enemy = 0;
  for (const v of Object.values(snap.enemyLore ?? {})) {
    if (num(v) >= ENEMY_LORE_MAX) enemy += INSIGHT_PER_ENEMY;
  }

  if (material + recipe + blueprint + skill + enemy === 0) return EMPTY;
  return { material, recipe, blueprint, skill, enemy };
}
