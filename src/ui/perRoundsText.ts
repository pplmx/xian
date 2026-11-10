/**
 * 「每隔 N 回合」这条规则的人话 —— **两侧都要说**,不能只说代价。
 *
 * ## 缺口
 *
 * `CombatRules.perRounds` 是**双向**机制:每个周期玩家回血 + 给盾,敌人攻势也涨。
 *
 * ```ts
 * if (perRounds && round % perRounds.interval === 0) {
 *   healSelf(p, mulN(p.snap.maxHp, perRounds.playerHealPct));
 *   gainShield(p, mulN(p.snap.maxHp, perRounds.playerShieldPct));
 *   e.atkRamp += perRounds.enemyAtkGrowth;
 * }
 * ```
 *
 * 而出发前的「危局」那一行只报了涨的那一半(「每 5 回合敌人杀意渐涨,战局越晚越凶」)——
 * 同一段规则被说成了**纯损失**。
 *
 * 这条规则属于哪两处:
 * - **长生道**的核心(章法:「长生印:每五回合得一印,恢复 4% 气血、凝 4% 护盾——
 *   越拖越强」);
 * - **奇门「休门」**那一格的规则(「每三回合回一口气,但敌人攻势更盛」)。
 *
 * 而实测它是**净赚**的:5 世界 × 6 构筑 × 30 局,带 `perRounds` 的净胜场
 * +10~+28(触发数千次)。玩家若只看「敌人杀意渐涨」,会以为带这个规则吃亏,
 * 从而在道途/门的选择上做反。
 *
 * ## 口径
 *
 * - **先所得、后代价**,因为这是这条规则的真实形状(「越拖越强,但敌人也在变凶」);
 * - **周期词只写一次**(在句首的「每 N 回合」),后面的代价说「每次」——
 *   避免「每轮」被读成「每一回合」;
 * - **不替某一条道途起专名**:「每印」只在长生道说得通,奇门没有印的概念,
 *   故规则层不用它;
 * - 纯惩罚型(`playerHealPct` 与 `playerShieldPct` 都为 0)退回原来的单句 ——
 *   那时确实没有收益可说,编一句「越拖越强」就是撒谎。
 */
import type { CombatRules } from "@/types";

/** `perRounds` 的那一段(从 CombatRules 里取,避免两处各写一份形状) */
export type PerRoundsRule = NonNullable<CombatRules["perRounds"]>;

/**
 * 把 `perRounds` 摊成一句人话。
 *
 * 入参是规则本身,不读 store —— 纯函数,可直接测。
 */
export function perRoundsLine(pr: PerRoundsRule): string {
  const gain: string[] = [];
  if (pr.playerHealPct > 0) gain.push(`回 ${Math.round(pr.playerHealPct * 100)}% 气血`);
  if (pr.playerShieldPct > 0) gain.push(`凝 ${Math.round(pr.playerShieldPct * 100)}% 护盾`);
  const costText =
    pr.enemyAtkGrowth > 0 ? `敌人攻势亦每次 +${Math.round(pr.enemyAtkGrowth * 100)}%` : "";

  if (gain.length === 0) {
    // 纯惩罚型:没有收益可说,不许编「越拖越强」
    return `每 ${pr.interval} 回合敌人杀意渐涨,战局越晚越凶`;
  }
  const gainText = `每 ${pr.interval} 回合${gain.join("、")}`;
  return `${gainText} —— 越拖越强${costText ? `;${costText},战局越晚越凶` : ""}`;
}
