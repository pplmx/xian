/**
 * 际遇选项的花费提示 —— 石头是梯度放缩的,手写的「需要灵石」从不带数。
 * 同一花费报一个数,竞拍高低价报区间;结算有免费出路的选项写「可能」。
 */
import type { EventChoice } from "@/types";
import { stoneByTier } from "@/core/formulas";
import { formatGN } from "@/utils/format";

function stoneCosts(choice: EventChoice): number[] {
  const out: number[] = [];
  for (const o of choice.outcomes) {
    for (const e of o.effects) {
      if (e.type === "stone" && e.tierAmount < 0) out.push(-e.tierAmount);
    }
  }
  return out;
}

export function choiceHintText(choice: EventChoice, tier: number): string {
  const costs = stoneCosts(choice);
  const payers = choice.outcomes.filter((o) =>
    o.effects.some((e) => e.type === "stone" && e.tierAmount < 0),
  ).length;
  if (costs.length === 0) {
    if (choice.cond?.type === "stone")
      return `需备灵石 ${formatGN(stoneByTier(tier, choice.cond.tierAmount))}`;
    return choice.hint ?? "";
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
  return `${extra}${spend}${reserve}`;
}
