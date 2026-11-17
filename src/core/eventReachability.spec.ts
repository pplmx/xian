/**
 * 一条事件「写进去了」不等于「玩得到」。
 *
 * ## 由来（第 498 轮）
 *
 * `contentReachabilityAudit` 守了十二个维度（丹方 / 灵材 / 敌人 / 区域链 / 灵兽 /
 * 法宝 / 功法 / 技艺 / 炼器…）—— **唯独没有事件这一维**。
 *
 * 而事件是玩家每一趟历练都会撞见的东西，且这一批我在 482~497 轮里加了三十条。
 *
 * ## 判据要守的两件事
 *
 * 「可达」需要两个条件同时成立:
 *
 * ```text
 *   ① 有地界提供它的标签      （tags 与某处地界的 eventTags 有交集）
 *   ② 那个地界那个境界段能进   （事件的境界带与地界的准入门槛相容）
 * ```
 *
 * 只有 ① 而没有 ② 的事件，会静静地待在表里 —— 与 design.md:5605 记的那条
 * 「加了事件、忘了调 offerBondEvent，它永远不出现」是同一类。
 *
 * ## 边界：奇缘链不在此列
 *
 * 21 条 `chain` 事件没有地界标签 —— 它们由奇缘链驱动（`data/chains`），
 * 逐节推进，与地界无关。故这一条把 `chain` 排除在外。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";
import { MAX_MAJOR } from "@/data/realms";

describe("事件可达性 · 写进去不等于玩得到", () => {
  it("① 每条非奇缘事件都有地界提供它的标签", () => {
    const orphans = EVENTS.filter(
      (e) =>
        !e.tags.includes("chain") &&
        !REGIONS.some((r) => e.tags.some((t) => r.eventTags.includes(t))),
    ).map((e) => `${e.id}(${e.tags.join(",")})`);
    expect(
      orphans,
      "这些事件没有任何地界能提供它的标签 —— 永远抽不到：" + orphans.join("；"),
    ).toEqual([]);
  });

  it("② 每条事件的境界带与「能提供它标签的地界」相容", () => {
    /*
     * 相容的意思是:存在一处地界，当玩家境界落在事件带内时，那处地界也进得去。
     *
     *   ev.minRealm ≤ region.minRealm 或 ev.minRealm ≥ region.minRealm
     *   且 ev.minRealm ≤ (ev.maxRealm ?? MAX_MAJOR)
     *
     * 简化成一个可判定的条件:事件带非空，且存在一处地界的门槛不高于事件带上限。
     */
    const bad: string[] = [];
    for (const e of EVENTS) {
      if (e.tags.includes("chain")) continue;
      const min = e.minRealm ?? 0;
      const max = e.maxRealm ?? MAX_MAJOR;
      if (min > max) {
        bad.push(`${e.id}: 境界带是空的（${min} > ${max}）`);
        continue;
      }
      const regions = REGIONS.filter((r) => e.tags.some((t) => r.eventTags.includes(t)));
      if (regions.length === 0) continue; /* ① 已经单独断言过 */
      /* 只要有一处地界，它的门槛落在事件带内（或事件带在它之后仍可用），就可达 */
      const reachable = regions.some((r) => r.minRealm <= max);
      if (!reachable) {
        bad.push(
          `${e.id}: 带 ${min}-${max}，而能提供它标签的地界门槛都 > ${max}（最低的 ${Math.min(
            ...regions.map((r) => r.minRealm),
          )}）`,
        );
      }
    }
    expect(
      bad,
      "这些事件的境界带与地界门槛不相容 —— 玩家进得去那处，却抽不到它：" + bad.join("；"),
    ).toEqual([]);
  });

  it("③ 反差：奇缘链不走这条路 —— 它们由 chains 驱动", () => {
    const chains = EVENTS.filter((e) => e.tags.includes("chain"));
    expect(chains.length, "奇缘链事件一个都没有 —— 判据③的前提变了").toBeGreaterThan(10);
    /* 它们确实没有地界标签（这正是被排除的原因） */
    for (const e of chains) {
      expect(e.tags, `${e.id} 带了非 chain 标签 —— 那它可能也该走地界那条路`).toEqual(["chain"]);
    }
  });
});
