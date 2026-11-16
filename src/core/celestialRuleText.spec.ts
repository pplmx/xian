/**
 * 天界世界的 `ruleText` 必须把 `rules` 里**每一条数值规则**都说出来。
 *
 * ## 缺口（第 399 轮）
 *
 * 星陨天的 `rules` 有五项，而 `ruleText` 只交代了三件事：
 *
 * ```text
 *   rules                                    ruleText（修前）
 *   enemyAtkMult: 1.25     敌人攻击 +25%      一个字没提
 *   healMult:     0.75     治疗效率 -25%      一个字没提
 *   maxRounds:    26                         「回合紧迫(上限 26 回合)」 ✓
 *   playerExtraMods: critRate .1/critDamage .5 「重装与反震反得其道」 —— 无数字
 *   enemyExtraMods: critRate .15             「敌方会心率 +15%」 ✓
 * ```
 *
 * 玩家读这一界时就少了两条最影响打法的信息：**挨得更重、还不能靠回血磨**。
 * 那一界被描述成一个「回合短、会心多」的地方，而实际上它同时也在削续航 ——
 * 带着一套续航流进来的人，是照着错的信息做的决定。
 *
 * ## 为什么这条判据此前不存在
 *
 * 道途（`data/endgame.DAO_PATHS`）有一族完整的 `ruleText` 判据 ——
 * `daoPathCoverage.spec` 第 210 行那句注释还记着实测事故：
 *
 * > 实测:`ruleText` 曾写「自身造成伤害 -12%」而 `rules` 是 -0.1
 *
 * **同一个形状，在天界世界这一侧一条都没有。** 两者都由 `rules`（真值）+
 * `ruleText`（给玩家读的）两半组成，而只有一半有人守。
 *
 * ## 判据守什么
 *
 * ① `rules` 里每个**数值型**的伤害/治疗/回合/护盾规则，`ruleText` 都要报出来；
 * ② 报出来的数必须与 `rules` 对得上（这是与①不同的另一半 —— 报了但报错更糟）；
 * ③ 只查这两类规则，不查 `playerExtraMods` / `enemyExtraMods` 的每一键 ——
 *    那些是词条，`ruleText` 用整句描述（「重装与反震反得其道」），
 *    逐键要求会把写作变成填空题。但**含数字的**那几个要报（见①的实现）。
 *
 * 修前实测：星陨天漏 2 条，赤炎天 `maxRounds` 只写「骤减」不写数。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";

/**
 * 必须被 `ruleText` 报出来的数值规则 —— 键 → 那一条文案里该出现的判据。
 *
 * 判据做成函数而不是字面量，是因为「+25%」与「0.75」两种写法都可能对：
 * 前者是加成口径，后者是倍率口径。只要文案里出现了其中一个等价说法就算报过。
 */
const MUST_DISCLOSE: { key: string; accepts: (v: number) => number[] }[] = [
  // 敌人攻击 +25% ← enemyAtkMult 1.25
  { key: "enemyAtkMult", accepts: (v) => [Math.round((v - 1) * 100), v] },
  // 治疗效率 -25% ← healMult 0.75
  { key: "healMult", accepts: (v) => [Math.round((1 - v) * 100), Math.round(v * 100), v] },
  // 回合上限 26 ← maxRounds 26（这是绝对值，不是倍率）
  { key: "maxRounds", accepts: (v) => [v] },
  // 护盾上限 25% ← shieldCapRatio 0.25
  { key: "shieldCapRatio", accepts: (v) => [Math.round(v * 100), v] },
];

describe("天界世界 · ruleText 要把 rules 说全", () => {
  it("每条数值规则都在 ruleText 里报出来了", () => {
    const missing: string[] = [];
    let checkedRules = 0;
    for (const w of CELESTIAL_WORLDS) {
      const text = (w.ruleText ?? []).join(" ");
      for (const { key, accepts } of MUST_DISCLOSE) {
        const v = (w.rules as Record<string, unknown>)[key];
        if (typeof v !== "number") continue;
        checkedRules += 1;
        if (!accepts(v).some((n) => text.includes(String(n)))) {
          missing.push(`${w.name}: rules.${key}=${v} 但 ruleText 一字未提`);
        }
      }
    }
    // 防空转:真的量到了若干条数值规则
    expect(checkedRules, "一条数值规则都没量到 —— 判据在空转").toBeGreaterThan(6);
    expect(
      missing,
      "这些规则藏在 rules 里而玩家读不到 —— 带错构筑进这一界的人，是照着错的信息做的决定：" +
        missing.join(" / "),
    ).toEqual([]);
  });

  it("报出来的数要与 rules 对得上 —— 报了但报错更糟", () => {
    /*
     * ①查「有没有报」，这一条查「报得对不对」。
     *
     * 两者不是一回事:`daoPathCoverage` 那次事故就是后者 ——
     * 「自身造成伤害 -12%」而 `rules` 是 -0.1，报是报了，差两个百分点。
     *
     * 这里的做法:对每条的每个候选数值，算一遍「文案里出现这个数」之后
     * **反推回去**是否与 rules 相等。只对能唯一反推的键做（maxRounds 是绝对值，
     * 反推无意义，跳过）。
     */
    const problems: string[] = [];
    for (const w of CELESTIAL_WORLDS) {
      const text = (w.ruleText ?? []).join(" ");

      // 敌人攻击:文案里出现「敌人攻击 +N%」时，N 必须等于 (mult-1)*100
      const atk = (w.rules as { enemyAtkMult?: number }).enemyAtkMult;
      if (typeof atk === "number") {
        const m = /敌人攻击 \+(\d+)%/.exec(text);
        if (m && Number(m[1]) !== Math.round((atk - 1) * 100)) {
          problems.push(
            `${w.name}: 文案说敌人攻击 +${m[1]}%，rules 是 +${Math.round((atk - 1) * 100)}%`,
          );
        }
      }

      // 治疗:文案里出现「治疗效率 -N%」时，N 必须等于 (1-mult)*100
      const heal = (w.rules as { healMult?: number }).healMult;
      if (typeof heal === "number") {
        const m = /治疗效率-? ?[-−]?(\d+)%/.exec(text);
        if (m && Number(m[1]) !== Math.round((1 - heal) * 100)) {
          problems.push(
            `${w.name}: 文案说治疗 -${m[1]}%，rules 折算是 -${Math.round((1 - heal) * 100)}%`,
          );
        }
      }
    }
    expect(problems, problems.join(" / ")).toEqual([]);
  });

  it("同一组世界里，口径要一致 —— 不许一个报数、一个只说形容词", () => {
    /*
     * 修前的形状:星陨天报「上限 26 回合」（有数），而赤炎天的同类规则写
     * 「回合上限骤减」（只有形容词）。同一个字段，两种写法，
     * 玩家在两者之间读到的东西不对等 —— 一个能算，一个只能猜。
     *
     * 这一条钉**这个字段**的口径统一，不涉及其它规则。
     */
    const withRounds = CELESTIAL_WORLDS.filter(
      (w) => typeof (w.rules as { maxRounds?: number }).maxRounds === "number",
    );
    expect(withRounds.length, "没有世界设了 maxRounds —— 这条判据的前提不成立了").toBeGreaterThan(
      1,
    );
    const vague: string[] = [];
    for (const w of withRounds) {
      const rounds = (w.rules as { maxRounds: number }).maxRounds;
      const text = (w.ruleText ?? []).join(" ");
      if (!text.includes(String(rounds)))
        vague.push(`${w.name}: maxRounds=${rounds} 但文案里没有这个数`);
    }
    expect(vague, `这些世界只说「回合紧」，不说紧到多少：${vague.join(" / ")}`).toEqual([]);
  });
});
