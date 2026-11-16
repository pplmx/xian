/**
 * 秘境覆盖到后半程 —— 玄仙到道祖不该是空白。
 *
 * ## 缺口（第 421 轮）
 *
 * 补之前,十五处秘境的 `minMajor` 只覆盖 3~9:
 *
 * ```text
 *   凡境册  8 处   3, 3, 4, 4, 5, 6, 7, 8        ← 逐境铺开
 *   天界册  7 处   9, 9, 9, 9, 9, 9, 9           ← 全挤在 9 境
 *   10~20          0 处                          ← 玄仙到道祖，十一境全空
 * ```
 *
 * 境界一共 21 个,而后半程**一半以上的境界**里这个玩法整个消失了。
 *
 * ## 那句话是无据的
 *
 * `contentDensity.spec` 里有一条判据标题写着「秘境只有两阶是设计,不是漏做」——
 * 而它的**判据体只打印了那一列,没有任何断言**,设计文档里也搜不到这条裁决。
 * 故那句话是标题里的自称,不是证据。这一轮按「缺内容」处理,补了三处。
 *
 * ## 判据
 *
 * ① 每一段境界都有秘境可去 —— 按八境一段切,不留空段;
 * ② 后半程（>= 10 境）至少有 3 处,且分布在不同境界上;
 * ③ 三处的规则各不相同 —— 补内容不是把数字调大,是各换一条要改打法的规则;
 * ④ 反空转:秘境总数与覆盖的境界数都够得着这条判据。
 */
import { describe, expect, it } from "vite-plus/test";
import { SECRET_REALMS } from "@/data/secretRealms";
import { realmDef, MAX_MAJOR } from "@/data/realms";

/** 秘境覆盖到的境界集合 */
function coveredMajors(): Set<number> {
  return new Set(SECRET_REALMS.map((r) => r.minMajor));
}

describe("秘境 · 后半程也要有地方可去", () => {
  it("每一段境界都有秘境 —— 不留空段", () => {
    /*
     * 按八境一段切:0~7 / 8~15 / 16~20。秘境从 3 境才开始（前两境是引气筑基,
     * 那时玩家还没长出能进秘境的本事），故第一段从 3 起算。
     *
     * 防的是「某一整段空着」—— 那一段里的玩家没有这个玩法。
     */
    const covered = coveredMajors();
    const gaps: string[] = [];
    const bands: [number, number][] = [
      [3, 8],
      [9, 15],
      [16, MAX_MAJOR],
    ];
    for (const [lo, hi] of bands) {
      const any = [...covered].some((m) => m >= lo && m <= hi);
      if (!any) gaps.push(`${lo}~${hi} 境（${realmDef(lo).name} ~ ${realmDef(hi).name}）`);
    }
    expect(
      gaps,
      "这些境界段里一处秘境都没有 —— 那一段的玩家没有这个玩法:" + gaps.join("、"),
    ).toEqual([]);
  });

  it("后半程（10 境以上）至少三处，且分布在不同境界", () => {
    const late = SECRET_REALMS.filter((r) => r.minMajor >= 10);
    expect(
      late.length,
      `10 境以上只有 ${late.length} 处秘境 —— 后半程占二十一个境界里的一半以上，` +
        "这个玩法不该在那儿消失",
    ).toBeGreaterThanOrEqual(3);
    /*
     * 而且不该全挤在同一个境界上 —— 那等于「有一段有、其余段还是空」。
     */
    const majors = new Set(late.map((r) => r.minMajor));
    expect(
      majors.size,
      `后半程的 ${late.length} 处秘境只落在 ${majors.size} 个境界上 —— 分布要铺开`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("后半程那几处，规则各不相同 —— 补内容不是把数字调大", () => {
    /*
     * 三处各是一种「后半程才配得上」的难法:护盾无用 / 治疗近乎无效 / 攻强命薄。
     * 若它们的 `rules` 一模一样,那只是三道数值更高的同一关。
     */
    const late = SECRET_REALMS.filter((r) => r.minMajor >= 10);
    const shapes = late.map((r) =>
      Object.keys(r.rules ?? {})
        .sort()
        .join(","),
    );
    expect(
      new Set(shapes).size,
      `后半程这 ${late.length} 处的规则只有 ${new Set(shapes).size} 种形状 —— 玩法没有区分`,
    ).toBeGreaterThanOrEqual(Math.min(3, late.length));
  });

  it("反空转：秘境总数与覆盖的境界都够这条判据用", () => {
    expect(SECRET_REALMS.length, "秘境太少 —— 上面几条量不出趋势").toBeGreaterThanOrEqual(15);
    expect(coveredMajors().size, "覆盖的境界太少").toBeGreaterThanOrEqual(6);
  });
});
