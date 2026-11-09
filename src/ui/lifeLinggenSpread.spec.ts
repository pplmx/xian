/**
 * 历世灵根横向对照 —— 十世履历摆在一起,才看得出「攒宿慧换来了什么」
 *
 * ## 缺口:每一世都记了,但没有一处能横向比
 *
 * 转世灵根那两轮把每一世的灵根记进了 `LifeRecord.linggen`(见 `ui/lifeLinggen`),
 * 历世履历逐行也印得出来。但玩家真正会问的问题不是「第三世是什么根」,
 * 而是 —— **「我这一路抽到的根,在变好吗」**。
 *
 * 逐行读十世要自己心算十次,而这件事有现成的答案:
 *
 *   · 资质地板随宿慧上浮(`aptitudeFloorNow`),每一世的期望资质是**单调上升**的
 *   · 根数越少倍率越高(`COUNT_FACTOR`) —— 单根 1.6 对五根 0.9
 *   · 品阶名字来自根数与均资质(`gradeName`)
 *
 * 于是「我的灵根在变好吗」可以被回答成一句:首世与末世的期望资质差多少、
 * 最好的那一世是哪一世。这不是新机制,是把已经记下的数据摆成一眼能读的形状。
 *
 * ## 只算已记下的,不补造
 *
 * 老存档的 `LifeRecord` 没有 linggen 那一栏(`ui/lifeLinggen` 会返回 null)。
 * 那些世**不进对照** —— 与「历世履历不许凭空印一行」同一条规矩。一世的灵根
 * 都没记时,整块对照不出。
 *
 * ## 单世的数据点也要能读
 *
 * 只转过一世时「首世 vs 末世」是同一个数,说「涨了 0」等于废话。
 * 故简报要区分三档:未记 / 只有一世 / 两世以上可对照。
 */
import { describe, expect, it } from "vite-plus/test";
import { lifeLinggenSpread } from "./lifeLinggenSpread";
import type { LifeRecord } from "@/data/samsara";

/*
 * 造一世的归档 —— 走**真实的 LifeRecord 形状**,不是给 spread 喂它自己那个中间结构。
 * 判据若拿内部结构当输入,测的就只是「这段代码自己跟自己对得上」,
 * 而线上真正的输入是存档里的 LifeRecord。
 */
const pt = (index: number, grade: string, aptitudes: number[]): LifeRecord =>
  ({
    index,
    major: 3,
    realmLabel: "金丹境",
    age: 200,
    themeId: null,
    themeResult: null,
    insight: 20,
    linggen: {
      gradeName: grade,
      roots: aptitudes.map((aptitude) => ({ element: "water", aptitude })),
    },
    at: 1,
  }) as LifeRecord;

describe("历世灵根 · 横向对照", () => {
  it("一世都没记 → 整块不出,不印一张空表", () => {
    const spread = lifeLinggenSpread([]);
    expect(spread.state).toBe("none");
    expect(spread.points).toEqual([]);
  });

  it("只记了一世 → 有那一世,但不编「涨了 0」", () => {
    const spread = lifeLinggenSpread([pt(1, "杂灵根", [40, 45])]);
    expect(spread.state).toBe("single");
    expect(spread.points).toHaveLength(1);
    expect(spread.delta, "只有一世时不该给出差值 —— 说「涨了 0」等于废话").toBeNull();
  });

  it("两世以上 → 给出首末差值与最大值那一世", () => {
    const spread = lifeLinggenSpread([
      pt(1, "杂灵根", [40, 44, 45]), // 均 43
      pt(2, "真灵根", [63, 44]), // 均 53.5
      pt(3, "天灵根", [92]), // 均 92
    ]);
    expect(spread.state).toBe("spread");
    expect(spread.first?.index).toBe(1);
    expect(spread.last?.index).toBe(3);
    expect(spread.delta, "首末均值差").toBeCloseTo(92 - 43, 5);
    expect(spread.best?.index, "最好的一世是天灵根那一世").toBe(3);
    expect(spread.best?.average).toBe(92);
  });

  it("按世序排,不按传入顺序 —— 履历本来就是倒排的", () => {
    const spread = lifeLinggenSpread([pt(3, "天灵根", [92]), pt(1, "杂灵根", [40])]);
    expect(spread.points.map((p) => p.index)).toEqual([1, 3]);
    expect(spread.first?.index).toBe(1);
    expect(spread.last?.index).toBe(3);
  });

  it("最好的那一世打平时取**更早**的那一世 —— 先到先得,不奖励重复", () => {
    const spread = lifeLinggenSpread([pt(1, "真灵根", [80]), pt(2, "真灵根", [80])]);
    expect(spread.best?.index, "打平时该取更早那一世").toBe(1);
  });

  it("差值可以为负 —— 后来的世抽得更差是合法结果,不许夹成 0", () => {
    const spread = lifeLinggenSpread([pt(1, "天灵根", [95]), pt(2, "杂灵根", [40, 42, 44])]);
    expect(spread.delta).toBeLessThan(0);
  });

  it("坏值(负世、NaN 资质)不进对照 —— 与历世履历同一套口径", () => {
    const spread = lifeLinggenSpread([
      { ...pt(1, "杂灵根", [40]), index: -3 },
      { ...pt(2, "真灵根", [Number.NaN]) },
      pt(3, "道灵根", [70]),
    ]);
    expect(
      spread.points.map((p) => p.index),
      "负世与坏资质都该被剔掉",
    ).toEqual([3]);
  });

  it("平均资质按根数算,不按「最强那一根」—— 五根灵根不该被一根高分冒充", () => {
    const spread = lifeLinggenSpread([
      pt(1, "杂灵根", [95, 40, 40, 40, 40]),
      pt(2, "天灵根", [95]),
    ]);
    expect(spread.points[0]!.average, "五根均值 (95+40×4)/5").toBeCloseTo(51, 5);
    expect(spread.points[1]!.average).toBe(95);
    expect(spread.best?.index, "单根 95 该赢过五根里只有一根 95").toBe(2);
  });
});
