/**
 * 灵根牌面 · 把「亲近」说成数
 *
 * ## 缺口:一份写了数字的收益表,界面只念得出形容词
 *
 * `data/linggenAffinity` 的 `ELEMENT_AFFINITY` 表里每一项都有实打实的倍率:
 *
 * ```text
 *   gongfaWeight  2.2（特殊根 2.6 / 混沌 3.0）  —— 同源功法被参悟到的权重
 *   fortuneWeight 2.5（特殊根 2.8 / 混沌 3.2）  —— 同源机缘撞见的权重
 *   relief        护盾回填 0.5 / 生机回填 0.5 / 正面对冲减弱 0.35 …
 * ```
 *
 * 界面只说「草木功法亲近你」「你懂得以柔卸力」。那是**定性形容词**,而本仓的
 * 决策信息纪律写的是:「不能只给定性形容词（『皆有裨益』『更容易』不算数）」。
 *
 * 于是玩家读不出:亲近是 1.1 倍还是 3 倍?渡劫那一线到底能卸掉多少?
 * 这些数全都在数据表里现成,只是没有一处把它们念出来。
 *
 * ## 为什么可以露,而五行仍「不分高低」
 *
 * `core/elementNeutral.spec` 承诺的是**五行不进战力、不进属性合并** —— 它禁的是
 * 「火系攻击 +5%」那类数值高低。而 `gongfaWeight` / `fortuneWeight` 是**倾向**
 * (更容易遇到,不是更强),`relief` 是**减免**(渡劫时的一线生机)。
 * `elementNeutral.spec` 的注释里已经把这四处逐一点名,并说它们
 * 「都是倾向 / 减免 / 更顺,没有一处是更强」。故露出来不违反那条承诺 ——
 * 恰恰是把它说清楚:两条权重**倍的都是「更容易遇到,不是只有你能遇到」**。
 *
 * ## 只读表,不重算
 *
 * 倍率与减免一律从 `ELEMENT_AFFINITY` 现读(可由调用方注入表格,便于验「没写时不编」),
 * 不在界面手抄一遍数字 —— 手抄的那份在改平衡时会立刻变成谎话。
 */
import type { ElementId } from "@/types";
import { ELEMENT_AFFINITY, type ElementAffinity } from "@/data/linggenAffinity";

/** 一条解法通道的读数(已译成人话) */
export interface ElementReliefGain {
  /** 通道名(护盾回填 / 生机回填 …) */
  label: string;
  /** 百分比读数,如 50 */
  percent: number;
  /** 一句读全的话,如「护盾回填 50%」 */
  text: string;
}

/** 某一系的收益简报 */
export interface ElementGainRow {
  element: ElementId;
  /** 同源功法权重倍率 */
  gongfaWeight: number;
  /** 同源机缘权重倍率 */
  fortuneWeight: number;
  /** 渡劫那一线;该系没有通道时为 null */
  relief: ElementReliefGain | null;
}

/**
 * 解法通道的中文名 —— 与 `core/linggenAffinity` 的 `TribulationRelief` 字段一一对应。
 *
 * 放在这里而不是散在视图里:同一个字段在渡劫面板、人物页、图鉴三处要同一个叫法。
 */
const RELIEF_LABEL: Record<string, string> = {
  shieldRestore: "护盾回填",
  healRestore: "生机回填",
  frontLoadEase: "正面对冲减弱",
  burstTierBonus: "劫威削去",
  reductionToResist: "雷罚分担",
};

/** 内部数值 → 百分比读数。`burstTierBonus` 本来就是整数档(1 = 一档),两种口径分开。 */
function reliefOf(relief: Partial<Record<string, number>> | undefined): ElementReliefGain | null {
  if (!relief) return null;
  /*
   * 只报**第一个**非零通道 —— 每个元素眼下只配一条(混沌是唯一配了四条的),
   * 而混沌的多条要逐条报全,故这里按表中键序全部收下、拼成一句话。
   * 一条都没有时返回 null:表里没写就不许硬造一句。
   */
  const parts: ElementReliefGain[] = [];
  for (const [key, value] of Object.entries(relief)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    const label = RELIEF_LABEL[key] ?? key;
    /*
     * `burstTierBonus` 是**档数**(1 档),不是比率 —— 写成百分比会是「劫威削去 100%」,
     * 那是把一档说成全部。其余四项都是 0~1 的比率。
     */
    const percent = key === "burstTierBonus" ? value : Math.round(value * 100);
    parts.push({
      label,
      percent,
      text: key === "burstTierBonus" ? `${label} ${percent} 档` : `${label} ${percent}%`,
    });
  }
  if (parts.length === 0) return null;
  // 混沌的多条合成一句,只留一个 `text` 供界面直接印
  return {
    label: parts.map((p) => p.label).join(" / "),
    percent: parts[0]!.percent,
    text: parts.map((p) => p.text).join(" · "),
  };
}

/**
 * 由灵根元素算出逐系收益简报。
 *
 * 按元素去重(同系重复不该印两行)、剔掉认不得的 id、空输入返回空数组 ——
 * 三种过滤都收在这一处,视图不再自己判一遍。
 */
export function elementGains(
  elements: readonly ElementId[],
  table: Record<string, ElementAffinity> = ELEMENT_AFFINITY,
): ElementGainRow[] {
  const seen = new Set<ElementId>();
  const rows: ElementGainRow[] = [];
  for (const element of elements) {
    if (seen.has(element)) continue;
    const aff = table[element];
    if (!aff) continue;
    seen.add(element);
    rows.push({
      element,
      gongfaWeight: aff.gongfaWeight,
      fortuneWeight: aff.fortuneWeight,
      relief: reliefOf(aff.relief as Partial<Record<string, number>>),
    });
  }
  return rows;
}
