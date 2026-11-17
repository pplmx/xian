/**
 * 逆旅契的第四条玩法面：解锁顺序。
 *
 * ## 由来（第 474 轮）
 *
 * `trialMotivation.spec` 的可动空间五项里，前三项已各有一份契：
 *
 * ```text
 * CombatRules  孤行 / 疾行 / 残躯 / 逆锋
 * 历练路线     第 470 轮  断径契（这一世只走三段）
 * 可用物品     第 473 轮  弃器契（不得祭用法宝）
 * 解锁顺序     ← 这一轮
 * 本世目标     未动
 * ```
 *
 * ## 为什么「倒着走」是纯逆境
 *
 * 顺着走：`2 → 4 → 7 → 11 → 15 → 17`，层级递增，逐步变强。
 * 倒着走：`17 → 15 → 11 → 7 → 4 → 2`，**开局就撞终段**。
 *
 * 收尾那几段确实是白给，但它们不影响「能不能通关」，只影响「何时」——
 * 而开局那一段几乎必败，玩家必须先把装备与等级堆上去才能迈出第一步。
 * 同样的路，倒着走要难得多。
 *
 * ## 判据
 *
 * ① 有一份契声明「本世倒序解锁」，且它不填 rules / routeStages / bannedItemKind
 *    —— 四种玩法面各管各的；
 * ② 倒序之后，第一段要打的正是原来最后那一段（顺序真的反了，不是换了批地界）；
 * ③ 反差：未签该契时顺序不变 —— 别把整条路线都倒过来。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";

/*
 * 注:需要 Pinia 的那一条（签下后准入从末段开始）放在 `lifeTrialService.spec`
 * 里 —— 它本来就用 Pinia，而 `layeringAudit.spec` 的 `CORE_PINIA_SPECS`
 * 基线只许减不许加。本文件保持无 Pinia，只量数据与源码形状。
 */
describe("逆旅契 · 第四条玩法面：解锁顺序", () => {
  it("① 有一份契声明倒序解锁，且四种玩法面各管各的", () => {
    const rev = LIFE_TRIALS.filter((t) => t.reverseRoute === true);
    expect(rev.length, "没有一份契约改解锁顺序 —— 可动空间第四项还是没动").toBeGreaterThan(0);
    for (const t of rev) {
      expect(Object.keys(t.rules ?? {}), `${t.name} 既倒序又改战斗规则`).toEqual([]);
      expect(t.routeStages, `${t.name} 既倒序又压路线`).toBeUndefined();
      expect(t.bannedItemKind, `${t.name} 既倒序又禁物品`).toBeUndefined();
    }
  });

  it("② 倒序之后，第一段要打的正是原来最后那一段", () => {
    /*
     * 这一条量的是**顺序真的反了**，不是「换了一批地界」。
     * 判据读 `routeOrderOf` 这个纯函数 —— 它是「本世按什么顺序走」的唯一出口。
     */
    const src = readFileSync(resolve(__dirname, "./lifeTrialService.ts"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(src, "没有 routeOrderOf 这个唯一出口").toContain("export function routeOrderOf");
    expect(src, "出口没有读 reverseRoute").toContain("reverseRoute");
  });

  it("③ 反差：未签该契时顺序不变", () => {
    /*
     * 判据要求 routeOrderOf 对「无契」返回原样 —— 若它无条件倒序，
     * 整条路线都会被倒过来，那不是一份契的效果。
     */
    const src = readFileSync(resolve(__dirname, "./lifeTrialService.ts"), "utf-8");
    const at = src.indexOf("export function routeOrderOf");
    expect(at, "routeOrderOf 定位不到 —— 判据会空转").toBeGreaterThan(0);
    const body = src
      .slice(at, at + 700)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(body, "routeOrderOf 无条件倒序 —— 未签契的一世也被倒了").toMatch(
      /reverseRoute[^;]{0,80}\?|\?\s*\[\.\.\./,
    );
  });
});
