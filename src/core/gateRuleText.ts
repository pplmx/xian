/**
 * 行军一指 —— 把一部 CombatRules 的数值摊成一行
 *
 * 八门(奇门/择门)每门带一份真实结算的 CombatRules,但选门界面一度只给定性 desc;
 * 契约(pacts)那边早就用 ruleText 同源披露。此处把 rules 的每个生效字段派生为一行
 * 文案,与结算同源、不手写 —— 规则加字段,只要不是空值这里就自动多出一行。
 */
import type { CombatRules } from "@/types";
import { formatPercent, formatSignedPercent } from "@/utils/format";
import { modsText } from "@/data/statNames";

/** 倍率字段(m≈1 即无改动) → 自己的/敌方的 攻势/气血/治疗 增贬 */
function multLine(parts: string[], m: number | undefined, label: string): void {
  if (m == null || m === 1) return;
  parts.push(`${label} ${formatSignedPercent(m - 1)}`);
}

/** 每 N 回合的周期增益 */
function perRoundsLine(p: NonNullable<CombatRules["perRounds"]>): string {
  const seg = [`每 ${p.interval} 回合`];
  if (p.playerHealPct > 0) seg.push(`回 ${formatPercent(p.playerHealPct, 0)} 气血`);
  if (p.playerShieldPct > 0) seg.push(`护盾 ${formatPercent(p.playerShieldPct, 0)}`);
  if (p.enemyAtkGrowth > 0) seg.push(`敌方攻势 ${formatSignedPercent(p.enemyAtkGrowth)}`);
  return seg.join(" · ");
}

/** 这部规则的行军数值串(没有生效字段则返回空串) */
export function gateRuleSummary(rules: CombatRules): string {
  const parts: string[] = [];
  multLine(parts, rules.playerAtkMult, "攻势");
  multLine(parts, rules.enemyAtkMult, "敌方攻势");
  multLine(parts, rules.enemyHpMult, "敌方气血");
  multLine(parts, rules.healMult, "治疗");
  if (rules.playerStartHpPct != null)
    parts.push(`以 ${formatPercent(rules.playerStartHpPct, 0)} 气血开战`);
  if (rules.maxRounds != null) parts.push(`回合上限 ${rules.maxRounds}`);
  if (rules.playerExtraMods) {
    const t = modsText(rules.playerExtraMods);
    if (t) parts.push(`额外 ${t}`);
  }
  if (rules.perRounds) parts.push(perRoundsLine(rules.perRounds));
  return parts.join(" · ");
}
