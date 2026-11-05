/**
 * 灵兽谱 · 按命途聚 —— 同一种走法排在一起,才比得出来。
 *
 * ## 缺口:四十只灵兽、按品阶降序,六种走法被打散
 *
 * 灵兽的性格决定历练的走法(`data/petTraits` 六种)。玩家在谱上要做的判断是
 * 「同一种走法里,哪只数值最合」—— 而谱原本只按「相伴中 → 已结缘 → 品阶降序」排,
 * 同一种性格的灵兽散落在四十行里,想比较就得从头扫一遍再心算归堆。
 *
 * 判据守的是一件很朴素的事:**同一种命途的灵兽在谱上必须挨着**。
 * 按品阶排做不到这一点(品阶高的先,性格与它无关);按命途聚才做得到。
 *
 * ## 两条是门查出来的,不是坐在桌前想出来的
 *
 * `scripts/layout-check.mjs` 的灵兽谱探针在真浏览器里跑第一遍就红了两处:
 *
 *   一 新号或收藏均衡时,两条命途的「已拥有几只」**打平**,排序当场退化成按品阶 ——
 *      贪宝与谨慎的灵兽一行行交错,「按命途聚」只在收藏悬殊时才成立(见下面的定序用例);
 *   二 **未逢的**灵兽凭高品阶插进已结缘者中间,而谱上「伴 / 曾 / 契 / 未」本是同一份
 *      相伴史 —— 未结缘的那一段该自成一条榜(按品阶降序),不该混进伙伴里。
 *
 * `core/petFateOrder` 只决定「怎么排」,不重抄性格表(名字与定序仍在 data/petTraits)。
 */
import { describe, expect, it } from "vite-plus/test";
import { orderPetsByFate, fateOwnedCounts, type FateSortRow } from "./petFateOrder";

/**
 * 造一行:只为排序测试服务,不入档。
 *
 * `depthRank` 与界面同一把尺(相伴中 3 > 曾相伴 2 > 已结缘 1 > 未结缘 0)。这里**按
 * owned/active 推一个自洽的默认值** —— 一个 `owned: false` 却 depthRank 1 的行是假数据,
 * 它测出来的排序在真界面上不成立。深浅本身当被测对象时再显式传。
 */
function row(
  id: string,
  personality: string,
  qualityRank: number,
  opts: Partial<FateSortRow> = {},
): FateSortRow {
  const owned = opts.owned ?? true;
  const active = opts.active ?? false;
  return {
    id,
    personality,
    qualityRank,
    depthRank: active ? 3 : owned ? 1 : 0,
    active,
    owned,
    ...opts,
  };
}

/** 命途该是一段连续区间:返回该命途在排好的谱上占的跨度 */
function spanOf(ordered: string[], prefix: string): number {
  const at = ordered.map((id, i) => ({ id, i })).filter((x) => x.id.startsWith(prefix));
  return at.at(-1)!.i - at[0]!.i + 1;
}

describe("灵兽谱 · 按命途聚", () => {
  it("同一种命途的灵兽在排好的谱上挨着,不被别的命途插队", () => {
    const rows = [
      row("a1", "greedy", 2),
      row("b1", "steady", 8),
      row("a2", "greedy", 7),
      row("b2", "steady", 3),
      row("a3", "greedy", 5),
    ];
    const ordered = orderPetsByFate(rows).map((r) => r.id);
    expect(spanOf(ordered, "a"), "greedy 三只之间夹进了别的命途").toBe(3);
    expect(spanOf(ordered, "b"), "steady 两只之间夹进了别的命途").toBe(2);
  });

  it("热度打平时按 data/petTraits 的定序排,两段不许交错(真浏览器查出来的那一处)", () => {
    // 贪宝一只、谨慎一只 —— 热度相等,若只靠热度键,品阶会把两段绞在一起
    const rows = [
      row("g1", "greedy", 2),
      row("c1", "cautious", 9),
      row("g2", "greedy", 7),
      row("c2", "cautious", 3),
    ];
    const ordered = orderPetsByFate(rows).map((r) => r.id);
    expect(spanOf(ordered, "g"), "贪宝两只之间夹进了谨慎的灵兽").toBe(2);
    expect(spanOf(ordered, "c"), "谨慎两只之间夹进了贪宝的灵兽").toBe(2);
    // 定序来自数据层:贪宝写在谨慎之前
    expect(ordered[0], "同热度时该按 data/petTraits 的先后,贪宝段在前").toMatch(/^g/);
  });

  it("命途之间按「已拥有几只」降序 —— 收藏多的走法先浮上来", () => {
    // greedy 拥有 3 只,steady 拥有 1 只 → greedy 段应排在 steady 段之前
    const rows = [
      row("s1", "steady", 9),
      row("g1", "greedy", 1),
      row("g2", "greedy", 2),
      row("g3", "greedy", 3),
    ];
    const ordered = orderPetsByFate(rows).map((r) => r.id);
    expect(ordered[0], "拥数最多的 greedy 段该在最前").toMatch(/^g/);
    expect(ordered.at(-1), "拥数最少的 steady 沉底").toBe("s1");
  });

  it("已结缘的整段在未结缘之前 —— 未逢的那几只自成一条榜,不混进伙伴中间", () => {
    const rows = [
      row("lockHigh", "greedy", 9, { owned: false }),
      row("ownLow", "greedy", 1),
      row("lockMid", "steady", 5, { owned: false }),
      row("ownMid", "steady", 4),
    ];
    const ordered = orderPetsByFate(rows).map((r) => r.id);
    // 已契段:两只各属一种命途(热度打平)→ 按数据层定序,贪宝的 ownLow 在前
    // 未契段:按品阶降序成榜 → lockHigh(9) 在 lockMid(5) 之前
    expect(ordered, "未结缘的不该排在已结缘之前").toEqual([
      "ownLow",
      "ownMid",
      "lockHigh",
      "lockMid",
    ]);
  });

  it("未逢那一段只看品阶 —— 全是「???」,按命途聚了也看不见", () => {
    const rows = [
      row("l1", "cautious", 3, { owned: false }),
      row("l2", "greedy", 9, { owned: false }),
      row("l3", "greedy", 1, { owned: false }),
    ];
    // 9 > 3 > 1:这一段的读法是「下一步想要哪一只」,命途在此说不上一句话
    expect(orderPetsByFate(rows).map((r) => r.id)).toEqual(["l2", "l1", "l3"]);
  });

  it("同一命途里,同行深一点的在前(曾相伴 > 已结缘)", () => {
    const rows = [
      row("just", "greedy", 8, { depthRank: 1 }),
      row("was", "greedy", 3, { depthRank: 2 }),
      row("also", "greedy", 6, { depthRank: 1 }),
    ];
    expect(
      orderPetsByFate(rows).map((r) => r.id),
      "唤作过伴的那只该在只结过缘的之前",
    ).toEqual(["was", "just", "also"]);
  });

  it("同一段同行史里才轮到品阶降序", () => {
    const rows = [
      row("low", "greedy", 1, { depthRank: 1 }),
      row("high", "greedy", 8, { depthRank: 1 }),
      row("mid", "greedy", 4, { depthRank: 1 }),
    ];
    expect(orderPetsByFate(rows).map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  it("相伴中的那只永远置顶,哪怕它的命途收藏最少、品阶最低", () => {
    const rows = [
      row("g1", "greedy", 8),
      row("g2", "greedy", 7),
      row("g3", "greedy", 6),
      row("s1", "steady", 1, { active: true }),
    ];
    expect(orderPetsByFate(rows)[0]!.id, "相伴的那只不在第一 —— 谱一打开就找不到它").toBe("s1");
  });

  it("未结缘的灵兽不参与命途热度统计 —— 不然空走法会挤掉正在用的", () => {
    const rows = [
      row("own1", "greedy", 5, { owned: true }),
      row("lock1", "steady", 8, { owned: false }),
      row("lock2", "steady", 7, { owned: false }),
      row("lock3", "steady", 6, { owned: false }),
    ];
    const counts = fateOwnedCounts(rows);
    expect(counts["steady"], "未结缘的三只不该让 steady 热度超过 greedy").toBeUndefined();
    expect(counts["greedy"]).toBe(1);
    // steady 一只没拥有,应当沉到 greedy 之后
    expect(orderPetsByFate(rows)[0]!.id).toBe("own1");
  });

  it("不改入参 —— computed 的产物不该被就地打乱", () => {
    const rows = [row("b", "greedy", 1), row("a", "greedy", 8)];
    const before = rows.map((r) => r.id);
    orderPetsByFate(rows);
    expect(
      rows.map((r) => r.id),
      "orderPetsByFate 就地改了入参",
    ).toEqual(before);
  });

  it("反空转:同命途同品阶仍给出确定的顺序(id 为稳定键)", () => {
    // 两行完全同key,若 sort 不稳定,两次调用可能给出不同顺序 —— 用 id 兜底
    const rows = [row("z", "greedy", 5), row("a", "greedy", 5)];
    expect(orderPetsByFate(rows).map((r) => r.id)).toEqual(["a", "z"]);
  });
});
