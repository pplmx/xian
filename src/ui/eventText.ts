/**
 * 际遇选项的花费提示 —— 石头是梯度放缩的,手写的「需要灵石」从不带数。
 * 同一花费报一个数,竞拍高低价报区间;结算有免费出路的选项写「可能」。
 */
import type { EventChoice } from "@/types";
import { expFromSecs, stoneByTier } from "@/core/formulas";
import {
  FORTUNE_RECIPE_FALLBACK_PAGE,
  FORTUNE_RECIPE_FALLBACK_WUDAO,
  FORTUNE_RECIPE_MASTERY,
  INSTANT_EXP_LAYER_CAP,
} from "@/data/constants";
import { buffDef } from "@/data/buffs";
import { artifactDef } from "@/data/artifacts";
import { gongfaDef } from "@/data/gongfa";
import { petDef } from "@/data/pets";
import { pillDef } from "@/data/pills";
import { QUALITIES } from "@/data/qualities";
import { REALMS } from "@/data/realms";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { usePlayerStore } from "@/stores/player";
import { formatDuration, formatGN, formatNum, formatPercent, formatYears } from "@/utils/format";

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

export type EventForecastTone = "gain" | "risk" | "neutral";

export interface EventOutcomeForecast {
  chance: string;
  text: string;
  tone: EventForecastTone;
}

interface ForecastLine {
  text: string;
  tone: EventForecastTone;
}

function effectLine(
  effect: EventChoice["outcomes"][number]["effects"][number],
  tier: number,
): ForecastLine | null {
  const player = usePlayerStore();
  switch (effect.type) {
    case "stone": {
      const value = stoneByTier(tier, Math.abs(effect.tierAmount));
      return {
        text: `灵石 ${effect.tierAmount >= 0 ? "+" : "-"}${formatGN(value)}`,
        tone: effect.tierAmount < 0 ? "risk" : "gain",
      };
    }
    case "exp": {
      const value = expFromSecs(
        player.expReq,
        effect.secs,
        player.cultPerSec,
        INSTANT_EXP_LAYER_CAP,
      );
      return { text: `修为 +${formatGN(value)}`, tone: "gain" };
    }
    case "material":
      return {
        text: `${RESOURCE_LABELS[effect.id]} +${formatNum(effect.amount)}`,
        tone: effect.amount >= 0 ? "gain" : "risk",
      };
    case "equipment": {
      const floor = QUALITIES[effect.minQualityRank ?? 0]?.name;
      return {
        text: floor ? `${floor}以上器物` : "随境界器物",
        tone: "gain",
      };
    }
    case "pill": {
      const count = Number.isFinite(effect.count) ? Math.max(0, Math.floor(effect.count)) : 0;
      const name = effect.id ? pillDef(effect.id)?.name : null;
      return { text: `${name ? `丹药「${name}」` : "随机丹药"} ×${count}`, tone: "gain" };
    }
    case "recipe":
      return {
        text:
          `未学丹方 · 掌握 +${formatPercent(FORTUNE_RECIPE_MASTERY, 0)} · ` +
          `识尽则悟道 ${formatNum(FORTUNE_RECIPE_FALLBACK_WUDAO)}、残页 ${formatNum(
            FORTUNE_RECIPE_FALLBACK_PAGE,
          )}`,
        tone: "gain",
      };
    case "gongfa": {
      const name = effect.id ? gongfaDef(effect.id)?.name : null;
      return { text: name ? `功法《${name}》` : "一门未习功法", tone: "gain" };
    }
    case "artifact": {
      const name = effect.id ? artifactDef(effect.id)?.name : null;
      return { text: name ? `法宝「${name}」` : "当前境界法宝", tone: "gain" };
    }
    case "buff": {
      const def = buffDef(effect.id);
      if (!def) return { text: "未知状态", tone: "neutral" };
      const prefix = def.kind === "injury" ? "陷入" : "获得";
      return {
        text: `${prefix}「${def.name}」 · ${formatDuration(def.durationSec)}`,
        tone: def.kind === "injury" ? "risk" : "gain",
      };
    }
    case "lifespan": {
      const years =
        effect.pct !== undefined
          ? Math.round((REALMS[player.major]?.lifespanYears ?? 0) * effect.pct)
          : (effect.years ?? 0);
      return { text: `寿元 +${formatYears(years)}`, tone: "gain" };
    }
    case "pet": {
      const name = effect.id ? petDef(effect.id)?.name : null;
      return { text: name ? `灵兽「${name}」` : "一只未结缘灵兽", tone: "gain" };
    }
    case "nothing":
      return null;
  }
}

/**
 * 一个选项的可能去向 —— 权重、效果与门限都读引擎那一份 EventChoice。
 *
 * 单分支不写「100%」，避免把确定的事伪装成抽奖；三档权重同源折算成百分比。
 * 效果无法在按下前确定具体件名时，只报到玩家能核对的层级（随境界器物 / 随机丹药）。
 */
export function choiceOutcomeForecasts(choice: EventChoice, tier: number): EventOutcomeForecast[] {
  const weighted = choice.outcomes.map((outcome) => ({
    outcome,
    weight: Math.max(0, outcome.weight ?? 1),
  }));
  const total = weighted.reduce((sum, outcome) => sum + outcome.weight, 0);
  const visible =
    total <= 0 ? weighted.slice(0, 1) : weighted.filter((outcome) => outcome.weight > 0);
  return visible.map(({ outcome, weight }) => {
    const lines = outcome.effects
      .map((effect) => effectLine(effect, tier))
      .filter((line): line is ForecastLine => line !== null);
    const tone = lines.some((line) => line.tone === "risk")
      ? "risk"
      : lines.some((line) => line.tone === "gain")
        ? "gain"
        : "neutral";
    return {
      chance: choice.outcomes.length > 1 && total > 0 ? formatPercent(weight / total, 0) : "",
      text: lines.map((line) => line.text).join(" · ") || "无事发生",
      tone,
    };
  });
}
