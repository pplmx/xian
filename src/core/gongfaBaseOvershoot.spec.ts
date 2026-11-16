/**
 * 功法基座里**允许**越过装备上限的那几处 —— 把「有意越界」钉成名单。
 *
 * ## 由来（第 402 轮，从一条旧结论里翻出来的）
 *
 * `docs/development.md` 第 4113 行有一条 2023 年左右的结论：
 *
 * > 92 部功法里有 9 处越过装备上限,而 **8 处是 `cultivationSpeed`**:
 * > 混元无极经 0.500 / 神霄九变 0.400 / 道祖本源经 0.500 / 玄仙御气经 0.360 /
 * > 御虚仙典 0.340 … 装备上限 0.32
 * >
 * > **这 8 处不是缺陷。** 高境界主修的修炼速度本就该压过静态词条 ——
 * > 那是修仙游戏的核心曲线。所以「功法基座 vs 装备上限」这条线**不该加判据**:
 * > 它会把设计意图误报成越界。
 *
 * 结论是对的,而**它里面的数字已经不对了**:本轮复算是 **6 处**,不是 8 处。
 * 少掉的两处不是被谁改对了 —— 是数据在几十轮里增删过,而没有任何东西盯着这个数。
 *
 * ## 故「不该加判据」这句要打个折扣
 *
 * 那条结论反对的是「一刀切地要求基座 ≤ 装备上限」—— 那个确实会误报。
 * 但它顺带也关掉了**另一个本可以做的问题**:
 *
 * ```text
 *   不该问   每一部的基座都 ≤ 装备上限吗          （会误报设计意图）
 *   该问     越过上限的那几部，都是「高境界主修」吗  （这才是设计意图本身）
 * ```
 *
 * 第二条正是这条判据。它不禁止越界,它要求越界**符合那个理由**:
 *
 * ① 每一处越界都必须是**仙品或神品**(低品阶基座越界不是「核心曲线」,是超模);
 * ② 每一处越界都必须**门槛够高**(≥ 真仙,即 major 9 —— 那之前玩家还没进入
 *    「主修压过静态词条」的阶段);
 * ③ 名单钉住 —— 新增一处越界必须来这里登记,并确认它符合 ①②。
 *
 * ③ 是给「数据悄悄增删」准备的:旧结论里那个数会烂,是因为没人拿着它。
 * 钉成名单之后,新加一部越界的功法会立刻红,而改名单的人会被这段注释
 * 问一句「它符合那两条理由吗」。
 *
 * ## 为什么还是留了名单而不是纯规则
 *
 * 纯规则(①②)已能挡住「低品阶 / 低门槛越界」。名单多出来的价值是**数量可见**:
 * 从 6 变成 16 时,光靠 ①② 不会红(假设新加的都是神品主修),而名单会。
 * 越界功法多到某个程度,「核心曲线」这个说法就站不住了 —— 那是数值问题,该有人看一眼。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { AFFIXES } from "@/data/affixes";
import { QUALITIES } from "@/data/qualities";
import type { StatMods } from "@/types";

/** 装备池里 `cultivationSpeed` 的最高档(词条 max 是百分点数值,除以 100 换成小数口径) */
function equipCap(): number {
  return Math.max(...AFFIXES.filter((a) => a.key === "cultivationSpeed").map((a) => a.max)) / 100;
}

/** 基座 cultivationSpeed 越过装备上限的功法 */
function overreaching(): {
  name: string;
  type: string;
  quality: string;
  minRealm: number;
  value: number;
}[] {
  const cap = equipCap();
  return GONGFA.filter(
    (g) => ((g.baseMods as StatMods | undefined)?.cultivationSpeed ?? 0) > cap,
  ).map((g) => ({
    name: g.name,
    type: g.type,
    quality: g.quality,
    minRealm: g.minRealm,
    value: (g.baseMods as StatMods).cultivationSpeed!,
  }));
}

/**
 * 已知的越界名单 —— **新增一处就要来这里登记**。
 *
 * 登记时请确认它符合文件头那两条:品阶仙/神、门槛 ≥ 9 境。
 */
const KNOWN_OVERSHOOT = [
  "御虚仙典",
  "玄仙御气经",
  "神霄九变",
  "混元无极经",
  "真灵不昧诀",
  "道祖本源经",
] as const;

describe("功法基座 · 允许越界，但只许那一个理由", () => {
  it("越界的每一部都是仙品或神品 —— 低品阶越界不是「核心曲线」，是超模", () => {
    const bad: string[] = [];
    for (const g of overreaching()) {
      const rank = QUALITIES.findIndex((q) => q.id === g.quality);
      if (rank < 7) bad.push(`${g.name}(${QUALITIES[rank]?.name ?? g.quality})`);
    }
    expect(
      bad,
      `这些功法的基座修炼速度越过了装备上限，而品阶不是仙品/神品 —— ` +
        `低品阶越界拿不到「高境界主修本就该压过静态词条」这个理由：${bad.join(" / ")}`,
    ).toEqual([]);
  });

  it("越界的每一部门槛都不低于真仙（major 9）", () => {
    /*
     * 「主修压过静态词条」是**后期**的曲线。一个 3 境就能拿到的功法若能越过
     * 装备上限，那玩家在装备系统还没铺开的阶段就已经不需要它了。
     */
    const bad = overreaching()
      .filter((g) => g.minRealm < 9)
      .map((g) => `${g.name}(minRealm ${g.minRealm})`);
    expect(bad, `这些低门槛功法越过了装备上限：${bad.join(" / ")}`).toEqual([]);
  });

  it("名单钉住 —— 新增越界功法必须来这里登记", () => {
    const now = overreaching()
      .map((g) => g.name)
      .sort();
    const known = [...KNOWN_OVERSHOOT].sort();
    expect(
      now,
      "越过装备上限的功法名单变了 —— 若这是有意的(高境界主修核心曲线)，把它加进 KNOWN_OVERSHOOT；" +
        "若不是，那是数值越界",
    ).toEqual(known);
  });

  it("数量还在「核心曲线」说得通的范围内", () => {
    /*
     * 旧结论说「92 部里 8 处」，本轮实测 6 处。这条钉的是**比例**:
     * 越界者占全部功法的比重不该失控 —— 若哪天变成 30 部，那就不再是
     * 「高境界主修的那几部」，而是整张表都超模了。
     *
     * 阈值取 10%:6/92 ≈ 6.5%，留一点余量。
     */
    const ratio = overreaching().length / GONGFA.length;
    expect(
      ratio,
      `越界的功法占 ${(ratio * 100).toFixed(1)}%（${overreaching().length}/${GONGFA.length}）—— ` +
        "这个比例已经不像「高境界主修的那几部」了",
    ).toBeLessThan(0.1);
  });

  it("装备上限本身要是个合理的小数口径 —— 防止单位搞错", () => {
    /*
     * 这条是给我自己踩的坑写的:第一版复算时我拿词条的 `max`（32，百分点数值）
     * 直接与功法的 `baseMods`（0.5，小数）比，得出「0 处越界」的结论 ——
     * 差点把一条正确的旧结论判成「前提已失效」。
     *
     * 词条的 min/max 是百分点数值，功法 mods 是小数。这条判据把这个换算钉住，
     * 让下一个人（或下一个我）不必再猜一次。
     */
    const cap = equipCap();
    expect(
      cap,
      `装备上限算出来是 ${cap} —— 若 > 1 说明单位没换算（词条是百分点数值）`,
    ).toBeLessThan(1);
    expect(cap, "装备上限算出来太小 —— 词条表可能变了").toBeGreaterThan(0.05);
  });
});
