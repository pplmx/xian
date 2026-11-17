/**
 * 第九份逆旅契：动「你会遇到谁」。
 *
 * ## 由来（第 506 轮）
 *
 * 第 505 轮把 `AXIS_COVERAGE` 从手写表改成从字段推之后，`untouchedAxes()`
 * 只剩一格:
 *
 * ```text
 *   产生平时没有的战斗     ← encounter
 * ```
 *
 * 八份契分别动了构筑、历练路线、可用物品、解锁顺序、本世目标，
 * **没有一份动「你会遇到谁」**。这一份补上它。
 *
 * ## 这份契做什么
 *
 * `extraEnemyTier` —— 每一场战斗的敌人，层级 +N。
 *
 * 为什么这是纯逆境而不是奖励:
 *
 * ```text
 *   同层级   t12 的敌人，玩家 t12 满配打起来是 1.0 倍
 *   +2 层    t14 的敌人，血量与攻击按层级曲线抬 —— 同样的构筑要难得多
 * ```
 *
 * 它不改玩家任何属性、不发任何资源、不进 StatMods —— 只改「你遇到谁」。
 *
 * ## 与已有一份契的边界
 *
 * `逆锋契`（rules.enemyAtkMult / enemyHpMult）也是让敌人更强，但它的形状是
 * **乘一个倍率**（+30% 攻 / +20% 血）；这一份换的是**整个敌人**（层级 +2）。
 * 前者是「同一只更凶」，后者是「来的是另一只」。两者不互斥也不重复 ——
 * 但为免混淆，判据③要求这一份**不许同时填 rules**。
 */
import { describe, expect, it } from "vite-plus/test";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { touchedAxesOf } from "@/core/trialMotivation";

describe("逆旅契 · 动「遭遇」的那一份", () => {
  it("① 存在一份只改遭遇的契", () => {
    const encounter = LIFE_TRIALS.filter((t) => t.extraEnemyTier !== undefined);
    expect(encounter.length, "没有一份契动「你会遇到谁」").toBe(1);
    const t = encounter[0]!;
    expect(t.extraEnemyTier, "层级加成必须是正数 —— 只许加难").toBeGreaterThan(0);
    /* 它不许同时挂 rules —— 那是「同一只更凶」，与「来的是另一只」是两件事 */
    expect(t.rules, `${t.name} 同时填了 rules —— 两份契的形状会混成一样`).toBeUndefined();
  });

  it("② 它确实把 encounter 那一格填上", () => {
    const t = LIFE_TRIALS.find((x) => x.extraEnemyTier !== undefined)!;
    expect(touchedAxesOf(t), "这份契没被算进 encounter").toContain("encounter");
  });

  it("③ 全维度覆盖：七格全满", () => {
    /*
     * 这一条是第 505 轮那个结论的验收 —— 八份契把六格填了，
     * 加上这一份，`untouchedAxes()` 应当为空。
     */
    const covered = new Set<string>();
    for (const t of LIFE_TRIALS) for (const a of touchedAxesOf(t)) covered.add(a);
    const missing = ["build", "region", "order", "encounter", "goal", "record", "node"].filter(
      (a) => !covered.has(a as never),
    );
    expect(missing, "这些决策维度仍然没有契覆盖：" + missing.join("、")).toEqual([]);
  });
});

describe("逆旅契 · 异途契真的换了对手", () => {
  it("④ 层级 +1 的敌人，三维确实更高 —— 不是换了个名字", async () => {
    const { powerScale } = await import("@/core/formulas");
    /*
     * `makeEnemySnap` 的三维都是 `mulN(powerScale(tier), …)` ——
     * 同一只敌人抬高层级，唯一的差别就是 powerScale。
     * 故直接比它:比值 > 1 就是「真的换了对手」。
     */
    const { ratio: gnRatio } = await import("@/utils/gnum");
    /* GNum 是 {m,e} 结构，比值走 gnum 的 ratio 再转成数 */
    const ratio = gnRatio(powerScale(11), powerScale(10));
    expect(ratio, "层级 +1 之后强度没变 —— 那这份契什么都没做").toBeGreaterThan(1);
  });

  it("⑤ 反差：+1 落在「满配打得过、裸装打不过」的那一档，不是必败", async () => {
    const { powerScale } = await import("@/core/formulas");
    const { ratio: gnRatio } = await import("@/utils/gnum");
    const ratio = gnRatio(powerScale(11), powerScale(10));
    /* 抬幅要在可玩区间:太高就成必败，太低就等于没加 */
    expect(ratio, `层级 +1 让强度 ×${ratio.toFixed(2)} —— 太陡则不可玩`).toBeLessThan(3);
    expect(ratio, `层级 +1 只让强度 ×${ratio.toFixed(2)} —— 太浅则等于没加`).toBeGreaterThan(1.2);
  });
});
