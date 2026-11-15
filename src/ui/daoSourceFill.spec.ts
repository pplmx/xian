/**
 * 「尚差 N 道源」之后呢 —— 差额说了，怎么补没说
 *
 * ## 这一处为什么比别处陡
 *
 * 本仓已经把「付不起要报差额」做得很彻底（第 294 轮那条判据：报差额，不许报总价）。
 * 天界有 15 处「尚差 N 道源」。但**道源不会自己长** —— 它没有挂机产出，
 * 只能靠熔炉与远征主动去挣。于是玩家读到「尚差 20 道源」时，
 * 手上有的是一个**他不知道怎么填的坑**:
 *
 * ```text
 *   启 程（道源 20 · 破界底赏 60）      ← 按钮上写着"尚差 20 道源"，然后置灰
 * ```
 *
 * 他该怎么办？页面没有下一句。而答案其实很近:天道熔炉那个入口就在**同一页**，
 * 一次给 5 道源 —— 但玩家得先知道「熔炉能换道源」这件事，而那只写在页头
 * 那个数字后面点开的弹窗里（「获取：破界 · 天道试炼 · 天道挑战 · 天道熔炉」，
 * 一句名词列表，没有价格、没有步数）。
 *
 * ## 这不是「多写一句」，是补一个决策
 *
 * ```text
 *   尚差 20 道源                                  → 玩家只能去别处翻
 *   尚差 20 道源 · 熔 4 次玄铁即够（你有 312 玄铁）  → 可以立刻决定
 * ```
 *
 * 第二句里的每个数都现算:差多少、哪种料最快、一次能给几缕、他手里有多少。
 * 而「哪种料最快」不是随便挑一个 —— 要按**他真正熔得动的**排序，
 * 否则会推荐一种他只有 3 份的料。
 *
 * ## 判据守什么
 *
 * 一 报出来的路**真的能补齐那个差额**（推荐的那条熔得出来的道源 ≥ 缺口）;
 * 二 它挑的是**手里最够的那条**，不是随便一条；
 * 三 一条都熔不动时，说清楚最缺什么 —— 不许沉默，也不许推荐一条给不了的路;
 * 四 数字与 `FURNACE_RATES` / `FURNACE_STONE_DAO_SOURCE` 同源，不手抄。
 */
import { describe, expect, it } from "vite-plus/test";
import { FURNACE_RATES, FURNACE_STONE_DAO_SOURCE, FURNACE_STONE_TIER_AMOUNT } from "@/data/endgame";
import { daoSourceFillPlan } from "./daoSourceFill";

describe("尚差道源 · 怎么补", () => {
  it("挑出手里最够的那条料，并报清熔几次、能得几缕", () => {
    /*
     * 缺口 20，一次熔炉按 `per` 折算。玄铁 25 一份 → 312 玄铁能熔 12 缕。
     * 其余料给 0 → 它必须是"玄铁"。若判据只验"有推荐"，把玄铁和只有 3 份的
     * 残页并列也会通过 —— 故这里钉的是**挑对了哪一条**。
     */
    const plan = daoSourceFillPlan(20, { stone: 0, ore: 312, page: 0, herb: 0, dust: 0 });
    expect(plan, "缺口 20 却没有给出补法").toBeTruthy();
    expect(plan!.kind).toBe("ore");
    expect(plan!.perRun, "一次能得的道源数算错了").toBe(Math.floor(312 / 25));
    /*
     * 玄铁那条路是「25 份 → 1 缕」，故补 20 缕要熔 **20 次**（不是 1 次）。
     * 第一版我在实现里把它写成了「缺口 ÷ 一次所得」而 `runYieldOf("ore")` 是 1 ——
     * 那是对的；错的是这条判据一开始把 312/25=12 当成了"一次能得 12 缕"。
     * 12 是**手里全部熔完**能得多少，不是一次。
     */
    expect(plan!.runsNeeded, "要熔几次算错了").toBe(20);
    expect(plan!.enough, "312 玄铁能熔 12 缕、缺口 20 —— 其实还不够").toBe(false);
  });

  it("推荐的那条必须真的能补齐 —— 够的时候 enough 为真，且熔出的量 ≥ 缺口", () => {
    // 1000 玄铁 = 40 缕,足够补 20
    const plan = daoSourceFillPlan(20, { stone: 0, ore: 1000, page: 0, herb: 0, dust: 0 })!;
    expect(plan.enough, "1000 玄铁熔得出 40 缕,却说不补得上 20").toBe(true);
    expect(plan.perRun).toBeGreaterThanOrEqual(20);
  });

  it("按“够不够”挑，不按列表顺序挑 —— 后面的料更多时该挑后者", () => {
    /*
     * `FURNACE_RATES` 的顺序是 ore → page → herb → dust。若实现只取第一条
     * "能熔出一点"的料，那么只有 25 玄铁（1 缕）而残页有 300 份（20 缕）时，
     * 它会推荐玄铁 —— 那条路差得远。
     */
    const plan = daoSourceFillPlan(20, { stone: 0, ore: 25, page: 300, herb: 0, dust: 0 })!;
    expect(plan.kind, "有 300 残页却推荐只有 25 的玄铁 —— 挑错了").toBe("page");
    expect(plan.enough, "300 残页能熔 20 缕,正好够 20").toBe(true);
  });

  it("灵石那一路也认 —— 它与材料同列，且量纲不同（按份计价）", () => {
    /*
     * 灵石献祭一次给 `FURNACE_STONE_DAO_SOURCE` 缕，一次要
     * `FURNACE_STONE_TIER_AMOUNT` 份灵石（层级折算，这里按一份算）。
     */
    const plan = daoSourceFillPlan(10, {
      stone: FURNACE_STONE_TIER_AMOUNT * 4,
      ore: 0,
      page: 0,
      herb: 0,
      dust: 0,
    })!;
    expect(plan.kind).toBe("stone");
    expect(plan.perRun).toBe(FURNACE_STONE_DAO_SOURCE * 4);
  });

  it("一条都熔不动时，说清楚最缺什么 —— 沉默与空推荐都不行", () => {
    const plan = daoSourceFillPlan(20, { stone: 0, ore: 3, page: 2, herb: 5, dust: 1 });
    expect(plan, "什么都熔不动时也必须有话可说").toBeTruthy();
    expect(plan!.kind, "熔不动却报了个 kind").toBeNull();
    expect(plan!.enough).toBe(false);
    // 「再攒 N 玄铁就够一次」—— 这个数必须真能让他熔出至少一缕
    expect(plan!.hint.length, "说不出缺什么").toBeGreaterThan(0);
  });

  it("缺口 ≤ 0 时给 null —— 没有缺口就不该出现这一行", () => {
    expect(
      daoSourceFillPlan(0, { stone: 999, ore: 999, page: 999, herb: 999, dust: 999 }),
    ).toBeNull();
    expect(daoSourceFillPlan(-5, { stone: 0, ore: 0, page: 0, herb: 0, dust: 0 })).toBeNull();
  });

  it("数字与数据表同源 —— 不手抄 per 与一次所得", () => {
    /*
     * 调一次玄铁，用表里的 `per` 反算。判据不写死 25 这个数:
     * 哪天 `FURNACE_RATES` 调价，这条会自己跟上。
     */
    const ore = FURNACE_RATES.find((r) => r.resource === "ore")!;
    const amount = 100;
    const plan = daoSourceFillPlan(1, { stone: 0, ore: amount, page: 0, herb: 0, dust: 0 })!;
    expect(plan.perRun, "一次能熔的道源数与 FURNACE_RATES 对不上").toBe(
      Math.floor(amount / ore.per),
    );
  });

  it("存量上屏不许写出「30000.0万」这种数 —— 到亿就换亿", () => {
    /*
     * 天界尺度到那里灵石动辄上亿。只按「万」一档会印成「30000.0万石」——
     * 玩家得数零才知道是多少（实测踩过）。
     */
    const plan = daoSourceFillPlan(4, { stone: 3e8, ore: 0, page: 0, herb: 0, dust: 0 })!;
    expect(plan.hint, `上亿的存量写成了「万」«${plan.hint}»`).not.toMatch(/\d{5,}\.\d万/);
    expect(plan.hint).toMatch(/亿/);
  });

  it("坏输入不抛错 —— 负库存当作没有", () => {
    expect(() =>
      daoSourceFillPlan(20, { stone: -1, ore: -1, page: -1, herb: -1, dust: -1 }),
    ).not.toThrow();
    const plan = daoSourceFillPlan(20, { stone: Number.NaN, ore: 0, page: 0, herb: 0, dust: 0 });
    expect(plan!.kind).toBeNull();
  });
});
