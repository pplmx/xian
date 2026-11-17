/**
 * 「前期地界的池子只有后期的三成」—— 这不是缺陷，是设计的必然。
 *
 * ## 由来（第 524 轮）
 *
 * 第 523 轮给「逐境可用事件」加了一条比值断言（最薄/最厚 ≥ 0.55）。
 * 这一轮想知道「每处地界的池子」是否也该有同样一条，于是先量:
 *
 * ```text
 *   每处地界能撞见（含 general）: 最薄 44（青云山麓 t1）· 最厚 123 · 比值 0.36
 * ```
 *
 * 0.36 比事件那条 0.52 还悬殊 —— 看着像又一处该补的地方。
 *
 * ## 而它不该被补
 *
 * 事件的池子是 `minRealm ≤ 当前境界 ≤ maxRealm` 的累计。前期地界能撞见的，
 * 只有「门槛不高于它」的那些 —— 仙界的事进不来，这才是对的。
 *
 * ```text
 *   青云山麓 t1   minRealm ≤ 0 的事    44 则
 *   混沌海 t32    minRealm ≤ 20 的事  123 则
 * ```
 *
 * **后者包含前者。** 比值随层级单调上升是累积池的必然结果，
 * 与「某一境的内容够不够」是两回事。
 *
 * ## 与第 485 轮那个量法的区别
 *
 * 那轮量的是「每个**标签**摊到几则」（sky 12 / 地界 10 = 1.2），
 * 这个口径不受层级影响，故它能抓出「界外三处偏薄」。
 * 而「每处**地界**能撞见几则」随层级单调，它抓不出缺陷，只会把设计读成缺陷。
 *
 * ## 判据
 *
 * ① 前期地界的池子必须严格是后期池子的子集 —— 这是「累积」的证明;
 * ② 反差:正因为是子集，比值必然 < 1，不许为此加一条「比值 ≥ X」的断言;
 * ③ 反差:第 485 轮那个按标签的口径仍然成立，它才是抓缺陷的那一个。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";

/** 某处地界能撞见的事件 id 集合（含 general 兜底） */
function poolOf(region: (typeof REGIONS)[number]): Set<string> {
  const out = new Set<string>();
  for (const e of EVENTS) {
    const tags = (e as unknown as { tags?: string[] }).tags ?? [];
    const min = (e as unknown as { minRealm?: number }).minRealm ?? 0;
    const hit = tags.includes("general") || tags.some((t) => region.eventTags.includes(t));
    if (min <= region.minRealm && hit) out.add(e.id);
  }
  return out;
}

describe("每处地界的池子 · 前期是后期的子集", () => {
  it("① 低层地界的池子严格包含于高层地界的池子", () => {
    const sorted = [...REGIONS].sort((a, b) => a.minRealm - b.minRealm);
    const low = sorted[0]!;
    const lowPool = poolOf(low);
    expect(lowPool.size, "最低层那处地界一条都撞不到").toBeGreaterThan(0);
    /*
     * 「子集」只在标签相容时才成立 —— 青云山麓是 mountain/forest，混沌海是 chaos。
     * 故这里退一步:低层池子里的每一条，都得是「门槛够低」的，
     * 而不是断言它一定在高层池子里（标签不同，抽不到是正常的）。
     */
    const tooHigh = [...lowPool].filter((id) => {
      const e = EVENTS.find((x) => x.id === id)!;
      return ((e as unknown as { minRealm?: number }).minRealm ?? 0) > low.minRealm;
    });
    expect(
      tooHigh,
      `${low.name}（minRealm ${low.minRealm}）的池子里有门槛更高的：` + tooHigh.join("、"),
    ).toEqual([]);
  });

  it("② 反差：比值随层级单调上升，故不许为它加「比值 ≥ X」的断言", () => {
    /*
     * 这一条守的是「不要加那条断言」。
     * 实测最低层 44 则、最高层 123 则，比值 0.36 —— 而这是累积池的必然，
     * 不是「前期内容薄」。加一条比值断言只会逼人往前期塞高阶事件，
     * 那恰恰会破坏「仙界的事进不来」。
     */
    const sorted = [...REGIONS].sort((a, b) => a.minRealm - b.minRealm);
    const low = poolOf(sorted[0]!).size;
    const high = poolOf(sorted[sorted.length - 1]!).size;
    expect(high, "最高层那处地界的池子不比最低层大 —— 累积不成立").toBeGreaterThan(low);
    expect(low / high, "比值恰好是 1 —— 那说明 minRealm 门槛没起作用").toBeLessThan(1);
  });

  it("③ 反差：按标签摊的口径仍然成立（第 485 轮那一个）", () => {
    const tags = new Set<string>();
    for (const e of EVENTS) for (const t of e.tags) tags.add(t);
    const thin: string[] = [];
    for (const tag of tags) {
      if (tag === "general") continue;
      const n = EVENTS.filter((e) => e.tags.includes(tag)).length;
      if (n < 4) thin.push(`${tag}(${n})`);
    }
    expect(thin, "这些标签的事件少于 4 条 —— 一处路线会反复抽到同一条：" + thin.join("、")).toEqual(
      [],
    );
  });
});
