/**
 * 际遇选项的花费提示 —— 石头是梯度放缩的,手写的「需要灵石」从不带数。
 * 同一花费报一个数,竞拍高低价报区间;结算有免费出路的选项写「可能」。
 */
import type { EventChoice } from "@/types";
import { stoneByTier } from "@/core/formulas";
import {
  FORTUNE_RECIPE_FALLBACK_PAGE,
  FORTUNE_RECIPE_FALLBACK_WUDAO,
  FORTUNE_RECIPE_MASTERY,
} from "@/data/constants";
import { formatGN, formatNum, formatPercent } from "@/utils/format";
import { useResourcesStore } from "@/stores/resources";
import { toNum } from "@/utils/gnum";

function stoneCosts(choice: EventChoice): number[] {
  const out: number[] = [];
  for (const o of choice.outcomes) {
    for (const e of o.effects) {
      if (e.type === "stone" && e.tierAmount < 0) out.push(-e.tierAmount);
    }
  }
  return out;
}

/** 奇缘授方的收益与保底 —— 有 recipe 效果的选项在按下前就把两种去向摊开 */
function recipeHintText(choice: EventChoice): string {
  const total = choice.outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.weight), 0);
  const recipeWeight = choice.outcomes.reduce(
    (sum, outcome) =>
      sum +
      (outcome.effects.some((effect) => effect.type === "recipe")
        ? Math.max(0, outcome.weight)
        : 0),
    0,
  );
  if (recipeWeight <= 0 || total <= 0) return "";
  const chance = formatPercent(recipeWeight / total, 0);
  return `${chance} 得未学丹方 · 掌握 +${formatPercent(
    FORTUNE_RECIPE_MASTERY,
    0,
  )} · 已识尽则悟道 ${formatNum(FORTUNE_RECIPE_FALLBACK_WUDAO)} · 残页 ${formatNum(
    FORTUNE_RECIPE_FALLBACK_PAGE,
  )}`;
}

export function choiceHintText(choice: EventChoice, tier: number): string {
  const costs = stoneCosts(choice);
  const recipeHint = recipeHintText(choice);
  const payers = choice.outcomes.filter((o) =>
    o.effects.some((e) => e.type === "stone" && e.tierAmount < 0),
  ).length;
  if (costs.length === 0) {
    if (choice.cond?.type === "stone")
      return [`需备灵石 ${formatGN(stoneByTier(tier, choice.cond.tierAmount))}`, recipeHint]
        .filter(Boolean)
        .join(" · ");
    return [choice.hint, recipeHint].filter(Boolean).join(" · ");
  }
  const lo = Math.min(...costs);
  const hi = Math.max(...costs);
  const verb = payers === choice.outcomes.length ? "花费灵石" : "可能花费灵石";
  const spend =
    lo === hi
      ? `${verb} ${formatGN(stoneByTier(tier, lo))}`
      : `${verb} ${formatGN(stoneByTier(tier, lo))}–${formatGN(stoneByTier(tier, hi))}`;
  const gate = choice.cond?.type === "stone" ? choice.cond.tierAmount : 0;
  // 门槛高于最高花费时,只有身上备足才能走这条 —— 这个「备足」不是花费,必须单列
  const reserve = gate > hi ? ` · 需备足 ${formatGN(stoneByTier(tier, gate))}` : "";
  // 手写 hint 若只说了「要灵石」,被算出来的数字替掉;说了别的(「额外之财归你」)则保留
  const extra = choice.hint && !choice.hint.includes("灵石") ? `${choice.hint} · ` : "";
  return `${extra}${spend}${reserve}${recipeHint ? ` · ${recipeHint}` : ""}`;
}

/**
 * 付不起时列出的灵石缺口 —— 际遇选项的 stone 门槛(cond.type==="stone")
 * 在结算前就置灰(choiceAvailable),玩家看不出差多少,只知「不能选」。
 * 这里现算余额与门槛的差(AGENTS「付不起要置灰并列出差额」),返回空串则付得起。
 */
export function stoneShortHint(choice: EventChoice, tier: number): string {
  const cond = choice.cond;
  if (cond?.type !== "stone") return "";
  const need = toNum(stoneByTier(tier, cond.tierAmount));
  const have = toNum(useResourcesStore().spiritStone);
  if (have >= need) return "";
  return `尚差 ${formatGN(need - have)} 石`;
}
