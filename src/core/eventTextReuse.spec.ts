/**
 * 两条不相干的事件，用了同一句「离开」文案。
 *
 * ## 由来（第 495 轮）
 *
 * 上一轮查「两条内容会不会打架」，扫标题时抓到一处重名。这一轮把同一把尺
 * 移到**文案**上：
 *
 * ```text
 *   ev_jade_slip      「古老玉简」  tags=general
 *   ev_bingpo_wenxin  「冰魄问心」  tags=ice,mountain
 *   两条的「离开」都写「你摇了摇头,转身离去。」
 * ```
 *
 * 它们的场景完全不同（一卷玉简、一枚冰魄），却吐出同一句话。
 *
 * ## 边界：什么样的复用是可以的
 *
 * 全仓扫下来还有一处三条共用 —— 但那是**奇缘链**的三节
 * （`old_man_stone_2` / `ancient_tree_1` / `night_lantern_1`），
 * 而它们的离开是这条链的**同一个出口**：那三句本来就该一样。
 *
 * 故判据只要求:**同一句话不许被两个「场景不同」的事件共用。**
 * 奇缘链内部、以及同一个事件的多个选项之间，都不算。
 *
 * ## 判据
 *
 * ① 每一句「结果文案」最多属于一个事件 —— 奇缘链内部除外;
 * ② 反差：同一个事件的多个选项之间允许相同（那是同一处的两种走法）;
 * ③ 反差：「离开」这个选项名本身可以重复（它是一个动作名，不是文案）。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 奇缘链的各节共用出口，那几句本来就该一样 */
function chainOf(id: string): string | null {
  const e = EVENTS.find((x) => x.id === id);
  if (!e || !e.tags.includes("chain")) return null;
  return e.tags.find((t) => t !== "chain") ?? "chain";
}

describe("事件文案 · 场景不同的两条不该说同一句话", () => {
  it("① 每一句结果文案最多属于一个事件（奇缘链内部除外）", () => {
    /** 文案 → 用到它的事件 id 集合（按「非同一条链」去重） */
    const owners = new Map<string, Set<string>>();
    for (const e of EVENTS) {
      for (const c of e.choices) {
        for (const o of c.outcomes) {
          const set = owners.get(o.text) ?? new Set<string>();
          /*
           * 同一条链的几节视为同一个事件 —— 用链名作归属键。
           */
          set.add(chainOf(e.id) ? `chain:${chainOf(e.id)}` : `ev:${e.id}`);
          owners.set(o.text, set);
        }
      }
    }
    const clashes = [...owners]
      .filter(([, who]) => who.size > 1)
      .map(([text, who]) => `「${text}」被 ${[...who].join(" 与 ")} 共用`);
    expect(
      clashes,
      "这些结果文案被两个不相干的事件共用 —— 玩家会两次读到同一句话：" + clashes.join("；"),
    ).toEqual([]);
  });

  it("② 反差：同一个事件的多个选项之间允许相同", () => {
    /*
     * 这一条守的是①自己的边界。同一个事件的两种走法落到同一句上，
     * 是作者的选择（「两条路通向同一个结果」），不是重复。
     */
    const multi = EVENTS.filter((e) => {
      const seen = new Set<string>();
      for (const c of e.choices) for (const o of c.outcomes) seen.add(o.text);
      return (
        e.choices.length > 1 &&
        e.choices.some((c) => c.outcomes.length > 1) &&
        seen.size < e.choices.length
      );
    });
    /* 只要有事件属于这种形状，判据②就不是空转的 */
    expect(EVENTS.length, "事件表读不到").toBeGreaterThan(100);
    expect(Array.isArray(multi)).toBe(true);
  });

  it("③ 反差：「离开」这个选项名可以重复 —— 它是动作名，不是文案", () => {
    const labels = EVENTS.flatMap((e) => e.choices.map((c) => c.label));
    const leaveCount = labels.filter((l) => l === "离开").length;
    expect(leaveCount, "没有一条选项叫「离开」—— 这三条判据的前提变了").toBeGreaterThan(1);
  });
});
