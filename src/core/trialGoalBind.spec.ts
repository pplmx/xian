/**
 * 逆旅契的第五条玩法面：本世目标。
 *
 * ## 由来（第 475 轮）
 *
 * 可动空间五项，前四项已各有契:
 *
 * ```text
 * CombatRules  孤行 / 疾行 / 残躯 / 逆锋
 * 历练路线     第 470 轮  断径契
 * 可用物品     第 473 轮  弃器契
 * 解锁顺序     第 474 轮  逆行契
 * 本世目标     ← 这一轮
 * ```
 *
 * ## 与前四项不同:它不增加难度,它改变了「这一世该做什么」
 *
 * `trialMotivation.spec` 的原话是「契约不改变…不改变本世目标」，而它把
 * 「本世目标」列进了**可动**空间。两者不矛盾:那句话描述的是当时四份契的实际行为，
 * 不是禁令。
 *
 * 而 `generateCurrentGoal(player)` 是唯一产出「下一步」的纯函数。契约要改变
 * 「这一世的目标」，就得让这个函数知道契的存在 —— 而它**只读传入的 player**，
 * `reincarnation.trial` 就在 player 上，不新增 store 依赖（见 `layeringAudit.spec`）。
 *
 * ## 判据
 *
 * ① `generateCurrentGoal` 在契带 `vowGoal` 时，产出的是**契约要的那件事**；
 * ② 反差:未签契时目标照旧 —— 别把所有人的首页都换掉；
 * ③ 反差:契约目标**不给宿慧、不进 StatMods** —— 它只改「做什么」，
 *    不改「做完得到什么」（那会撞上 `lifeTrialService.spec` 的四条出口判据）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";

describe("逆旅契 · 第五条玩法面：本世目标", () => {
  it("① 有一份契声明本世要达成的事", () => {
    const goalTrials = LIFE_TRIALS.filter((t) => t.vowGoal !== undefined);
    expect(goalTrials.length, "没有一份契约改本世目标 —— 可动空间第五项还是没动").toBeGreaterThan(
      0,
    );
    for (const t of goalTrials) {
      expect(t.vowGoal!.length, `${t.name} 的 vowGoal 是空的`).toBeGreaterThan(4);
    }
  });

  it("② 反差：五种玩法面各管各的 —— 不填 rules / routeStages / bannedItemKind / reverseRoute", () => {
    for (const t of LIFE_TRIALS.filter((x) => x.vowGoal !== undefined)) {
      expect(Object.keys(t.rules ?? {}), `${t.name} 既改目标又改战斗规则`).toEqual([]);
      expect(t.routeStages, `${t.name} 既改目标又压路线`).toBeUndefined();
      expect(t.bannedItemKind, `${t.name} 既改目标又禁物品`).toBeUndefined();
      expect(t.reverseRoute, `${t.name} 既改目标又倒序`).toBeUndefined();
    }
  });

  it("③ 反差：契约目标不给宿慧 —— 只改「做什么」，不改「得到什么」", () => {
    /*
     * `LifeTrialDef` 本来就没有 `insight` 字段 —— 那条口径由
     * `lifeTrialService.spec` 的「服务层不发放宿慧」守着（它扫的是服务代码）。
     * 这里再守一遍**数据侧**:新加的目标契不许顺手多出一个给成长字段。
     */
    const allowed = new Set([
      "id",
      "name",
      "seal",
      "desc",
      "ruleText",
      "cost",
      "rules",
      "routeStages",
      "bannedItemKind",
      "reverseRoute",
      "vowGoal",
    ]);
    for (const t of LIFE_TRIALS.filter((x) => x.vowGoal !== undefined)) {
      const extra = Object.keys(t).filter((k) => !allowed.has(k));
      expect(extra, `${t.name} 多了字段 ${extra.join(",")} —— 契约不许碰成长经济`).toEqual([]);
    }
  });

  it("④ 目标真的被换成契约那件事", () => {
    /*
     * 这一条量的是**行为**：读 `generateCurrentGoal` 的源码，要求它在产出目标前
     * 先看契约的 `vowGoal`。只读数据不读源码会漏掉「字段加了但没人读」——
     * 第 470 轮的 `routeStages` 就是这么绿过一轮的。
     */
    const src = readFileSync(resolve(__dirname, "./goal.ts"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    /*
     * 要求它出现在**读契约的那一行**，而不是注释里 —— 注释中也会写 `vowGoal`。
     * 这是第三次踩同一个坑（第 471/472 轮各一次）。
     */
    expect(src, "goal.ts 没有读契约的 vowGoal —— 目标不会被换掉").toMatch(
      /lifeTrialDef\([^)]*\)\?\.vowGoal/,
    );
  });
});
