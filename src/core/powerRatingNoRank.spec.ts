/**
 * 「读的是构筑形状,不是战力名次」—— 这句断言没人守着。
 *
 * ## 断言在哪里
 *
 * 构筑页两处这么写:
 *
 * ```text
 * 读的是构筑形状,不是战力名次;点一维看词条来路。
 * 实战面 · 只报方向
 * ```
 *
 * 而 `core/powerRating.ts` 的头注把取舍讲得更清楚:
 *
 * > 战力总数继续存在,但降级为"综合参考";五维星级承担"读懂构筑形状"的职责…
 * > 星级基于词条合计的定性分段,**不做精确排名** —— 两个 4 星构筑谁强,
 * > 由环境与相性决定。
 *
 * ## 缺口
 *
 * `powerRating.spec` 有八条用例:五维齐全、星级分化、贡献之和 = 得分、阈值同源……
 * 但**没有一条**守着「不排名次」。
 *
 * 而这条取舍最容易被一次「顺手」改掉:星级是定性分段,而 `score` 是连续的 ——
 * 想给玩家一个「战力 3210 / 全服第 47」的读数,最自然的写法就是把 `scores` 一加权
 * 求和、再排个序。那一刻界面上那句「不是战力名次」变成假话,而八条既有用例全绿 ——
 * 它们守的是「分段对不对」,不是「有没有多出一个排名」。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 `PowerRating` 的返回形状里**没有总分字段**(只有五维各自的收获与阈值);
 *   二 源码里没有把五维合成一个数再排序的写法。
 *
 * 这是形状判据:不去逐条读实现,而是钉住那份产出不得长出一个「总分/名次」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ratePower } from "@/core/powerRating";

/** 允许出现在战力分解结果上的键 —— 五维 + 解释用的阈值 + 展开用的明细 */
const RATING_KEYS = new Set([
  "attack",
  "survival",
  "speed",
  "recovery",
  "mechanics",
  "labels",
  "thresholds",
]);

describe("战力分解 · 只报形状,不排名次", () => {
  it("结果里没有总分 / 名次一类的字段", () => {
    const r = ratePower({ mods: {} } as never);
    const extra = Object.keys(r).filter((k) => !RATING_KEYS.has(k));
    expect(
      extra,
      `战力分解多出了「${extra.join(", ")}」—— 界面上那句「不是战力名次」会变成假话`,
    ).toEqual([]);
  });

  it("源码里没有把五维合成一个数", () => {
    const src = readSource("src/core/powerRating.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /*
     * 五维各自有 score(用来跨阈值定星级),但**不许再合成一个总分**:
     * 形如 `total` / `overall` / 把 5 个 score 相加再赋给某个字段。
     */
    expect(src, "出现了总分字段 —— 那正是「不做精确排名」要挡的东西").not.toMatch(
      /\b(total|overall|composite|rank)\w*\s*[:=]/i,
    );
  });

  it("反空转:五维与阈值仍在(判据不是因为它本来就空才绿)", () => {
    const r = ratePower({ mods: {} } as never);
    for (const dim of ["attack", "survival", "speed", "recovery", "mechanics"]) {
      expect(r, `缺了 ${dim} 这一维`).toHaveProperty(dim);
    }
    expect(r, "阈值要留着 —— 界面用它解释「为什么是这个星」").toHaveProperty("thresholds");
  });
});
