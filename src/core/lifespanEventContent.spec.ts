/**
 * 寿元是修仙的核心压力，而它只出现在三处事件里。
 *
 * ## 由来（第 491 轮）
 *
 * 前几轮「查缺口」已经走空（灵兽链路、道侣事件、丹方等级逐条核过）。
 * 这一轮换成第 482~487 轮那条稳定的路:**直接加内容**。
 *
 * 量的是「事件效果的分布」:
 *
 * ```text
 * material 175 · buff 130 · nothing 134 · exp 109 · stone 34
 * equipment 29 · pet 21 · pill 10 · gongfa 8 · artifact 2 · lifespan 2
 * ```
 *
 * `lifespan` 与 `artifact` 并列最少。而寿元在修仙里是**最核心的压力** ——
 * 整部作品的「一世」就是以它计的。152 个事件里只有三处能改寿元。
 *
 * ## 判据
 *
 * ① 新增四则都在表里，且都带 `lifespan` 效果；
 * ② **人间界用 `years`，界外用 `pct`** —— 数据文件里那条注释讲过为什么:
 *    「界外的寿元以亿载计:一株仙桃写的必须是『当前境界寿元的几成』,
 *     不是『八百年』—— 对一位金仙来说,八百年连一次吐纳都算不上。」
 * ③ 反差：给寿元的选项不能是纯白拿 —— 至少有一条结果是坏的。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

const NEW_IDS = ["ev_shouyan_zhi", "ev_xushi_canpian", "ev_jiedan_tingyan", "ev_xianren_xushou"];

describe("寿元 · 补四则", () => {
  it("① 四则都在表里，且都带 lifespan 效果", () => {
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      const hasLifespan = e!.choices.some((c) =>
        c.outcomes.some((o) => o.effects.some((f) => f.type === "lifespan")),
      );
      expect(hasLifespan, `${id} 没有任何寿命效果 —— 那它不属于这一批`).toBe(true);
    }
  });

  it("② 人间界用 years，界外用 pct", () => {
    /*
     * 这条不是形式主义:对一位金仙来说「+800 年」等于零,
     * 而对炼气期修士来说「+5% 寿元」也等于零。两个刻度不能混。
     */
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      const min = e.minRealm ?? 0;
      for (const c of e.choices) {
        for (const o of c.outcomes) {
          for (const f of o.effects) {
            if (f.type !== "lifespan") continue;
            if (min >= 9) {
              expect(
                f.pct,
                `${id}(境${min}) 用 years 给寿元 —— 界外的寿元以亿载计，绝对值等于零`,
              ).toBeGreaterThan(0);
              expect(f.years, `${id} 两个刻度都写了`).toBeUndefined();
            } else {
              expect(
                f.years,
                `${id}(境${min}) 用 pct 给寿元 —— 人间界的寿元以年计，百分比太小`,
              ).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("③ 反差：给寿元的选项不能是纯白拿", () => {
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      for (const c of e.choices) {
        const grants = c.outcomes.some((o) =>
          o.effects.some((f) => f.type === "lifespan" && (f.years ?? f.pct ?? 0) > 0),
        );
        if (!grants) continue;
        const allWin = c.outcomes.every(
          (o) =>
            o.effects.some((f) => f.type === "lifespan" && (f.years ?? f.pct ?? 0) > 0) &&
            !o.effects.some((f) => f.type === "buff" && (f as { id?: string }).id === "injury"),
        );
        expect(allWin, `${id} 的「${c.label}」每一次都给寿元且不受伤 —— 那是白拿`).toBe(false);
      }
    }
  });
});
