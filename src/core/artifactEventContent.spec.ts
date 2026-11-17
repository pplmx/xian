/**
 * 法宝只在两处事件里出现过 —— 而它是四十九条内容的入口。
 *
 * ## 由来（第 492 轮）
 *
 * 上一轮补了寿元（2 → 7）。按同一把尺再量:
 *
 * ```text
 * artifact 2 · gongfa 8 · pill 10 · pet 21 · equipment 29
 * ```
 *
 * `artifact` 现在是最少的一处。而法宝有 **49 件**、每件有 9 级祭炼 ——
 * 它是本作内容量第二大的收藏线（仅次于装备），却只有两条事件能把它送出来:
 *
 * ```text
 *   虚空裂缝「探手其中」  35% 摸到一件
 *   酒仙「拾葫芦归还」    30% 得一件
 * ```
 *
 * 其余全靠战斗掉落（`core/loot` 的 `acquireArtifact`）。
 *
 * ## 判据
 *
 * ① 三条都在表里，且都带 `artifact` 效果；
 * ② 每条给法宝的那一档**带条件**——不是「点一下就有」；
 * ③ 反差：三条的标签不重（各自落在不同的地界类型上），别都挤在 `general`。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

const NEW_IDS = ["ev_gujing_canbao", "ev_jiangren_yizhen", "ev_xingxiu_yiwu"];

describe("法宝 · 补三则", () => {
  it("① 三条都在表里，且都带 artifact 效果", () => {
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      const has = e!.choices.some((c) =>
        c.outcomes.some((o) => o.effects.some((f) => f.type === "artifact")),
      );
      expect(has, `${id} 没有法宝效果 —— 那它不属于这一批`).toBe(true);
    }
  });

  it("② 给法宝的那一档带条件，不是「点一下就有」", () => {
    /*
     * 判法:含 artifact 效果的选项，其 outcomes 不能全是「必给的」——
     * 要么权重合计里有一档不给，要么同一选项内另有代价（受伤）。
     */
    for (const id of NEW_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      for (const c of e.choices) {
        const gives = c.outcomes.some((o) => o.effects.some((f) => f.type === "artifact"));
        if (!gives) continue;
        const total = c.outcomes.reduce((s, o) => s + o.weight, 0);
        const giveWeight = c.outcomes
          .filter((o) => o.effects.some((f) => f.type === "artifact"))
          .reduce((s, o) => s + o.weight, 0);
        const someFail = giveWeight < total;
        const someCost = c.outcomes.some((o) =>
          o.effects.some((f) => f.type === "buff" && (f as { id?: string }).id === "injury"),
        );
        expect(
          someFail || someCost,
          `${id} 的「${c.label}」只要点就给法宝，且没有任何坏结果 —— 那是白拿`,
        ).toBe(true);
      }
    }
  });

  it("③ 三条的标签不重 —— 各自落在不同的地界类型上", () => {
    const tagSets = NEW_IDS.map((id) => {
      const e = EVENTS.find((x) => x.id === id)!;
      return e.tags.filter((t) => t !== "general").join(",");
    });
    expect(new Set(tagSets).size, `三条的标签撞了：${tagSets.join(" / ")}`).toBe(NEW_IDS.length);
  });
});
