/**
 * 九份契，全部被标成「只改数值」。
 *
 * ## 由来（第 507 轮）
 *
 * 这一轮先把四份契里写着 `rules: {}` 的空对象删了 —— 它们的注释明写
 * 「不动一条战斗规则」，而一个空规则对象在语义上仍然是「有一份规则」，
 * 让 `isPurelyAdverse({})` 恒真、让 `ruleDistance` 读到 0。
 *
 * 删完之后看 `trialProfiles()` 的输出，又发现第二件事:
 *
 * ```text
 *   孤行契  surface=numbers    治疗 25%              ← 确实是数值
 *   断径契  surface=numbers    这一世只有三段路       ← 这是内容
 *   弃器契  surface=numbers    不得祭用任何法宝       ← 这是内容
 *   逆行契  surface=numbers    路线由末段向首段推进   ← 这是内容
 *   异途契  surface=numbers    每场敌人层级 +1        ← 这是内容
 * ```
 *
 * `ChangeSurface` 的两个值是这么定义的:
 *
 * ```text
 *   numbers   只改数值（乘区、上限）
 *   content   改内容构成（有什么敌人、有什么可用、去哪些地方）
 * ```
 *
 * 而后四份**正是**「有什么敌人 / 有什么可用 / 去哪些地方」。
 * 而 `content` 这个值全仓只有虚界（对照组）在用 —— 九份契一个都没用上。
 *
 * ## 为什么这不只是标签问题
 *
 * `surface` 是「这一份动的是哪一层」的答案。玩家读到的差别、以及以后
 * 任何按 surface 做聚合的地方（比如「内容型 vs 数值型的动机够不够」），
 * 都会因为这一个字段而全错。
 *
 * ## 判据
 *
 * ① 动了玩法面的契（routeStages / bannedItemKind / reverseRoute / extraEnemyTier / vowGoal），
 *    surface 必须是 content;
 * ② 反差：只改 rules 的契仍是 numbers;
 * ③ 反差：`vowGoal` 也算 content —— 它换的是「这一世做什么」，不是数值。
 */
import { describe, expect, it } from "vite-plus/test";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { trialProfiles } from "@/core/motivationType";

/** 这一份契动了内容构成吗 */
function changesContent(t: (typeof LIFE_TRIALS)[number]): boolean {
  return (
    t.routeStages !== undefined ||
    t.bannedItemKind !== undefined ||
    t.reverseRoute !== undefined ||
    t.extraEnemyTier !== undefined ||
    t.vowGoal !== undefined
  );
}

describe("逆旅契 · surface 说的是「动的是哪一层」", () => {
  it("① 动了玩法面的契，surface 必须是 content", () => {
    const profiles = trialProfiles();
    const wrong: string[] = [];
    for (const t of LIFE_TRIALS) {
      const p = profiles.find((x) => x.id === t.id);
      if (!p) continue;
      const want = changesContent(t) ? "content" : "numbers";
      if (p.surface !== want) {
        wrong.push(
          `${t.name}: 标成 ${p.surface}，而它动的是${want === "content" ? "内容构成" : "数值"}`,
        );
      }
    }
    expect(wrong, "这些契的 surface 标错了：" + wrong.join("；")).toEqual([]);
  });

  it("② 反差：只改 rules 的契仍是 numbers", () => {
    const rulesOnly = LIFE_TRIALS.filter((t) => t.rules && !changesContent(t));
    expect(rulesOnly.length, "没有只改 rules 的契 —— 判据②的前提变了").toBeGreaterThan(0);
    const profiles = trialProfiles();
    for (const t of rulesOnly) {
      expect(profiles.find((x) => x.id === t.id)?.surface, `${t.name}`).toBe("numbers");
    }
  });

  it("③ 反差：vowGoal 也算 content", () => {
    const goal = LIFE_TRIALS.filter((t) => t.vowGoal !== undefined);
    expect(goal.length, "没有带 vowGoal 的契").toBeGreaterThan(0);
    const profiles = trialProfiles();
    for (const t of goal) {
      expect(
        profiles.find((x) => x.id === t.id)?.surface,
        `${t.name} 换了目标，不算内容那算什么`,
      ).toBe("content");
    }
  });
});
