/**
 * 奖励里的 `titleId` / `pillId` 必须真实存在 —— 否则那条奖励会静默消失。
 *
 * ## 由来（第 259 轮）
 *
 * `core/progress.ts` 发赏时是这样写的:
 *
 * ```ts
 * if (bundle.pillId && acquirePill(bundle.pillId, 1)) { … }
 * if (bundle.titleId && titleDef(bundle.titleId)) { … }
 * ```
 *
 * 两个条件都**对未知 id 返回假**，于是整段跳过 —— 玩家拿不到那枚丹药、那个名号，
 * 而**没有任何提示说他少了什么**。反过来，如果那个 id 拼错成另一个存在的 id，
 * 他会拿到**错的**奖励，同样没有提示。
 *
 * 类型系统救不了:两个字段都是 `string`,不是字面量联合。
 * `dataIntegrity.spec` 管的是「区域引用的敌人与首领」,不管这两个。
 *
 * ## 这条判据守什么
 *
 * 把全仓所有 `RewardBundle` 里的 `titleId` / `pillId` 收集起来（成就、主线任务、
 * 事件结果），要求每一个都能在 `TITLES` / `PILLS` 里找到。
 *
 * 它只查**引用完整性**,不查奖励是否平衡 —— 那是各自模块的事。
 */
import { describe, expect, it } from "vite-plus/test";
import { ACHIEVEMENTS } from "@/data/achievements";
import { MAIN_QUESTS } from "@/data/quests";
import { EVENTS, FORTUNE_EVENTS } from "@/data/events";
import { PILLS } from "@/data/pills";
import { TITLES } from "@/data/titles";
import type { RewardBundle } from "@/types";

/** 全仓所有会发出去的奖励包 —— 新增发赏来源时把那一处加进来。 */
function allRewardBundles(): { where: string; reward: RewardBundle }[] {
  const out: { where: string; reward: RewardBundle }[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.reward) out.push({ where: `成就 ${a.id}`, reward: a.reward });
  }
  for (const q of MAIN_QUESTS) {
    if (q.reward) out.push({ where: `主线 ${q.id}`, reward: q.reward });
  }
  /*
   * 事件不用 `RewardBundle`,而是 `choices[].outcomes[].effects[]`;
   * 其中的丹药是 `{ type: "pill", id?, count }` —— `id` 缺省表示「按境界随机」,
   * 那种情况没有 id 可查,跳过。
   */
  for (const e of [...EVENTS, ...FORTUNE_EVENTS]) {
    for (const c of e.choices ?? []) {
      for (const o of c.outcomes ?? []) {
        for (const eff of o.effects ?? []) {
          if (eff.type === "pill" && eff.id) {
            out.push({ where: `事件 ${e.id}`, reward: { pillId: eff.id } as RewardBundle });
          }
        }
      }
    }
  }
  return out;
}

describe("奖励引用 · 发出的称号与丹药都必须真的存在", () => {
  it("扫得到足够多的奖励包（防空转）", () => {
    const bundles = allRewardBundles();
    expect(bundles.length, "一个奖励包都没扫到 —— 字段名或导出名变了").toBeGreaterThan(50);
    const withTitle = bundles.filter((b) => b.reward.titleId).length;
    const withPill = bundles.filter((b) => b.reward.pillId).length;
    expect(
      withTitle + withPill,
      "一个带 titleId / pillId 的奖励都没有 —— 这条判据会永远绿",
    ).toBeGreaterThan(10);
  });

  it("每个 titleId 都指向真实称号", () => {
    const known = new Set(TITLES.map((t) => t.id));
    const bad = allRewardBundles()
      .filter((b) => b.reward.titleId && !known.has(b.reward.titleId))
      .map((b) => `${b.where}→${b.reward.titleId}`);
    expect(
      bad,
      "这些奖励发的是不存在的称号 —— 玩家拿不到，也没有任何提示:" + bad.join(" / "),
    ).toEqual([]);
  });

  it("每个 pillId 都指向真实丹药", () => {
    const known = new Set(PILLS.map((p) => p.id));
    const bad = allRewardBundles()
      .filter((b) => b.reward.pillId && !known.has(b.reward.pillId))
      .map((b) => `${b.where}→${b.reward.pillId}`);
    expect(
      bad,
      "这些奖励发的是不存在的丹药 —— 玩家拿不到，也没有任何提示:" + bad.join(" / "),
    ).toEqual([]);
  });

  it("称号与丹药的 id 集合本身不含重复（重复会让 byId 表静默覆盖）", () => {
    const titleIds = TITLES.map((t) => t.id);
    const pillIds = PILLS.map((p) => p.id);
    expect(new Set(titleIds).size, "称号 id 有重复").toBe(titleIds.length);
    expect(new Set(pillIds).size, "丹药 id 有重复").toBe(pillIds.length);
  });
});
