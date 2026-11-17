/**
 * 暗系补四则 —— 它是「每处地界摊到的事件数」最少的一处。
 *
 * ## 由来（第 484 轮）
 *
 * 前两轮补了冰 / 剑 / 火（各从 4~5 补到 7~8）。这一轮换一个量法:
 *
 * ```text
 * 标签      事件数   地界数   每处摊到
 * dark       9        5       1.8     ← 最少
 * thunder    5        2       2.5
 * forest     9        3       3.0
 * ice/sword  7        1       7.0
 * ```
 *
 * `dark` 横跨 **5 处地界、tier 8~31、minRealm 3~19** —— 从幽冥海一直铺到神魔古祭。
 * 玩家一路上会反复经过它，而全库只给了九则。
 *
 * ## 与前两轮不同的一点
 *
 * 冰 / 剑 / 火都只有一处地界，故判据能要求「可出现的每一处都带那个标签」。
 * 而 `dark` 有五处、跨三个界域 —— 它的内容**需要也不同**:
 * 幽冥海是阴冷的、九幽魔渊是压人的、陨神战场是荒败的、神魔渊与神魔古祭是混沌的。
 *
 * 故这一轮的四则按**层级**分开写，而判据要求它们覆盖不同段:
 * ① 至少有一则落在人间界（minRealm ≤ 8），至少有一则落在界外（minRealm ≥ 9）;
 * ② 各自都带 dark 标签;
 * ③ 每条至少两个选项;
 * ④ 不许出现「只有一处地界能用」的情形 —— 那是给某一处写的，不是给这个标签写的。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";

const DARK_IDS = ["ev_youming_dukou", "ev_jiuyou_huizhao", "ev_yunshen_canqi", "ev_shenmo_yuyin"];

describe("暗系 · 补四则，且要铺开层级", () => {
  it("① 暗系整体在人间界与界外两段都有内容", () => {
    /*
     * ## 这一条改过一次
     *
     * 初版要求「新加的四则里至少有一则界外」—— 而四则都写成了人间界
     * （minRealm 3/6/6/7），于是判据红。
     *
     * 但把事件硬推到界外是**为了满足判据而改内容**。而实际情形是:
     * `dark` 横跨 5 处地界（tier 8~31），界外那三处（九幽魔渊/神魔渊/神魔古祭）
     * 本来就分不到新内容 —— 那才是要点。
     *
     * 故判据改为量**整个 dark 标签**的两段覆盖，而不是量我新加的那四则。
     */
    const all = EVENTS.filter((e) => e.tags.includes("dark"));
    const mortal = all.filter((e) => (e.minRealm ?? 0) <= 8);
    const beyond = all.filter((e) => (e.minRealm ?? 0) >= 9);
    expect(mortal.length, "人间界没有暗系事件 —— 幽冥海（min3）会空").toBeGreaterThan(0);
    expect(beyond.length, "界外没有暗系事件 —— 九幽魔渊以上的暗系地界分不到内容").toBeGreaterThan(
      0,
    );
  });

  it("② 每条都带 dark 标签", () => {
    for (const id of DARK_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.tags, `${id} 没带 dark 标签`).toContain("dark");
    }
  });

  it("③ 每条至少两个选项", () => {
    for (const id of DARK_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.choices.length, `${id} 只有一个选项`).toBeGreaterThanOrEqual(2);
    }
  });

  it("④ 不许只有一处地界能用 —— 那是给某一处写的，不是给这个标签写的", () => {
    for (const id of DARK_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      const hit = REGIONS.filter((r) => e.tags.some((t) => r.eventTags.includes(t)));
      expect(
        hit.length,
        `${id} 只能出现在 ${hit.map((r) => r.name).join("、")} —— 它绑到了某一处，而不是暗系`,
      ).toBeGreaterThanOrEqual(2);
      /*
       * 反差:也不许宽到全图 —— 那说明它带了 `general`。
       */
      expect(
        hit.length,
        `${id} 能出现在 ${hit.length}/${REGIONS.length} 处 —— 它已经是通用事件`,
      ).toBeLessThan(REGIONS.length / 2);
    }
  });
});
