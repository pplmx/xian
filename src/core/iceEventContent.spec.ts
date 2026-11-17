/**
 * 冰系事件补三则 —— 而「补了」不等于「玩得到」。
 *
 * ## 由来（第 482 轮）
 *
 * 前几轮一直在找缺口，这一轮改为**直接加内容**（上一轮的判断：
 * 这一仓经过四百多轮打磨，缺口已经很少）。
 *
 * 选中的是标签密度最低的那一处:
 *
 * ```text
 * 标签      地界数   事件数   密度
 * ice        3        4      1.3     ← 最低
 * sword      1        4      4.0
 * fire       1        5      5.0
 * ```
 *
 * `ice` 对应寒潭幽窟 / 昆仑雪岭 / 冰原等明确地界，却只有四则事件。
 *
 * ## 判据要守什么
 *
 * 「加了三条事件」这句话本身没有价值 —— 判据要守的是它们**真的能被玩到**:
 * ① 三条都在事件表里，且有 ice 标签；
 * ② 各自的境界带与**能到那些地界的境界**对得上（否则写了也不会被抽到）；
 * ③ 每条至少两个选项 —— 单选项事件不是决策，只是一个按钮;
 * ④ 反差：不许为了凑数把效果写成无代价的大额奖励。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";

const NEW_IDS = ["ev_hanchao_diaobing", "ev_bingpo_wenxin", "ev_xueji_yinshi"];

describe("冰系事件 · 补三则，且要真的玩得到", () => {
  it("① 三条都在事件表里，且带 ice 标签", () => {
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 ice 标签 —— 它不会在冰系地界出现`).toContain("ice");
    }
  });

  it("② 境界带与「能到那些地界的境界」对得上", () => {
    /*
     * 事件的 `minRealm`/`maxRealm` 与地界的 `minRealm` 是两套数 ——
     * 若事件写 minRealm 9（仙界起），而带 ice 标签的地界全在人间界，
     * 那它永远不会被抽到。这一条把它们对起来。
     */
    const iceRegions = REGIONS.filter((r) => r.eventTags.includes("ice"));
    expect(iceRegions.length, "没有带 ice 标签的地界 —— 判据会空转").toBeGreaterThan(0);
    const lowestRealm = Math.min(...iceRegions.map((r) => r.minRealm));
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(
        e.minRealm ?? 0,
        `${id} 的最低境界 ${e.minRealm ?? 0} 高于所有冰系地界的门槛 ${lowestRealm} —— 抽不到它`,
      ).toBeLessThanOrEqual(lowestRealm + 4);
    }
  });

  it("⑤ 它们是「冰系」内容，不是贴了冰标签的通用事件", () => {
    /*
     * ## 这一条是我自己的第一版写砸了才加的
     *
     * 三条初稿都带 `general` 标签 —— 而 `general` 让它们可出现在**全部 44 处地界**:
     *
     * ```text
     *   初稿  ["general","ice","water"]  → 44 处（含赤炎火域、九幽魔渊）
     *   改后  ["ice","water"]            → 4 处（寒潭幽窟、幽冥海、昆仑雪岭、蜃楼幻海）
     * ```
     *
     * 那不是「补冰系内容」，那是给全图加了三个到处都能撞见的事件。
     *
     * 判据:它们可出现的地界数必须**明显少于**全图 —— 且必须都在带冰/山/水的地界里。
     */
    const all = REGIONS.length;
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      const hit = REGIONS.filter((r) => e.tags.some((t) => r.eventTags.includes(t)));
      expect(
        hit.length,
        `${id} 能出现在 ${hit.length}/${all} 处 —— 它已经是通用事件，不是冰系内容`,
      ).toBeLessThan(all / 2);
      /*
       * 反差:每一处都要有冰/山/水之一 —— 不许靠 `dark`、`fire` 这类标签混进来。
       */
      const wrong = hit.filter(
        (r) => !["ice", "mountain", "water"].some((t) => r.eventTags.includes(t)),
      );
      expect(
        wrong.map((r) => r.name),
        `${id} 落到了与冰无关的地界`,
      ).toEqual([]);
    }
  });

  it("③ 每条至少两个选项 —— 单选项不是决策", () => {
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.choices.length, `${id} 只有一个选项`).toBeGreaterThanOrEqual(2);
    }
  });

  it("④ 反差：不许无代价地给大额奖励", () => {
    /*
     * 每一条效果都必须落在「有得有失」的结构里:
     * 带 `stone`/`equipment`/`pill` 这类实物的选项，其**同一选项内**必须
     * 至少有一个非全胜的结果（权重 < 100 或带 `buff`/`injury`）——
     * 否则它就是一个「点了就白拿」的按钮，稀释了事件的决策感。
     */
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      const lootChoices = e.choices.filter((ch) =>
        ch.outcomes.some((out) =>
          out.effects.some((f) =>
            ["stone", "equipment", "pill", "material", "recipe"].includes(f.type),
          ),
        ),
      );
      expect(lootChoices.length, `${id} 一个给东西的选项都没有 —— 那它不必存在`).toBeGreaterThan(0);
      for (const ch of lootChoices) {
        const allWin =
          ch.outcomes.length === 1 &&
          ch.outcomes.every((o) => o.weight >= 100) &&
          ch.outcomes.every((o) => o.effects.every((f) => f.type !== "buff"));
        expect(allWin, `${id} 的「${ch.label}」是无代价白拿 —— 那不是决策`).toBe(false);
      }
    }
  });
});
