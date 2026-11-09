/**
 * 转世弹窗 · 前世今生并排:同一个天平,两边都得看得见
 *
 * ## 缺口:弹窗只摊开了「来世抽到什么」,没摊开「换掉了什么」
 *
 * 「来世根骨」那一章把来世灵根、资质地板、一根资质的期望都写清了 —— 玩家知道
 * 下一手大概是什么水平。但灵根是**重掷**的:真正要权衡的是「我手里这副会不会被换掉」。
 * 弹窗一个字都没说本世的灵根是什么,于是玩家只能凭记忆比较,而记忆正好在这一刻最不可靠
 * (`ReincarnationDialog` 只在本世寿元耗尽时出现,离上一次看人物页可能过了几天)。
 *
 * ## 只比同一类量
 *
 * 灵根强弱由两件事决定:**根数**(越少倍率越高,单根 1.6 对五根 0.9)与**均资质**
 * (`growthMult` 用的口径)。两者都在 `LinggenProfile` 上现成,不需要新算法。
 * 故对照只报这两样,配一句「比这一世 …」的差,不编一个综合评分 ——
 * 评分是第二套价值判断,会与引擎的成长倍率分叉。
 *
 * ## 措辞:是「换掉」不是「失去」
 *
 * 转世是主动选择,不是惩罚。文案例现在写「随皮囊散去」而不是「会失去」:
 * 同一件事,一个词让它像收获,另一个让它像损失。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { linggenCompare } from "./linggenCompare";

const dlg = () => readSource("src/components/character/ReincarnationDialog.vue");

/*
 * 夹具走**引擎同一份算式**(均资质 / 60 × 根数系数),不手写一个常数 ——
 * 手写的话「均资质涨了、倍率也涨」这类关系在夹具里就不成立,判据会测到一片假绿。
 * 系数取自 `linggenGen` 的 COUNT_FACTOR 口径(单 1.6 / 双 1.35 / 三 1.15 / 四 1.0 / 五 0.9)。
 */
const COUNT_MULT: Record<number, number> = { 1: 1.6, 2: 1.35, 3: 1.15, 4: 1.0, 5: 0.9 };
const profile = (grades: string, aptitudes: number[]) => {
  const avg = aptitudes.reduce((a, b) => a + b, 0) / aptitudes.length;
  return {
    gradeName: grades,
    growthMult: Math.round((avg / 60) * (COUNT_MULT[aptitudes.length] ?? 1) * 100) / 100,
    roots: aptitudes.map((aptitude) => ({ element: "water" as const, aptitude })),
  };
};

describe("灵根对照 · 纯函数", () => {
  it("两边都有 → 报根数、均资质与两个差", () => {
    const cmp = linggenCompare(profile("真灵根", [63, 44]), profile("天灵根", [92]));
    expect(cmp).not.toBeNull();
    expect(cmp!.from.count).toBe(2);
    expect(cmp!.to.count).toBe(1);
    expect(cmp!.from.average).toBeCloseTo(53.5, 5);
    expect(cmp!.to.average).toBe(92);
    expect(cmp!.averageDelta, "均资质差").toBeCloseTo(38.5, 5);
    expect(cmp!.countDelta, "根数差(少一根是好事)").toBe(-1);
  });

  it("任一侧缺失 → 返回 null,不印半张对照", () => {
    expect(linggenCompare(undefined, profile("天灵根", [92]))).toBeNull();
    expect(linggenCompare(profile("真灵根", [63]), undefined)).toBeNull();
  });

  it("一侧没有根 → 也返回 null(空牌面比不出东西)", () => {
    expect(linggenCompare(profile("真灵根", []), profile("天灵根", [92]))).toBeNull();
  });

  it("坏资质(NaN)不比 —— 与灵根牌面同一套口径", () => {
    expect(linggenCompare(profile("真灵根", [Number.NaN]), profile("天灵根", [92]))).toBeNull();
  });

  it("算的是均值,不是最强那一根", () => {
    const cmp = linggenCompare(profile("杂灵根", [95, 40, 40, 40, 40]), profile("天灵根", [95]));
    expect(cmp!.from.average).toBeCloseTo(51, 5);
    expect(cmp!.to.average).toBe(95);
  });
});

describe("灵根对照 · 倍率差的显示口径", () => {
  /*
   * `multDeltaText` 是显示点的定小数位,不是百分比换算 —— 全库的百分比换算统走
   * `formatPercent`(`uiLayering.spec` 逐文件扫 `Math.round(..*100)`),故这里
   * 用 `toFixed(2)` 后削零,含符号与「-0.00 削成空串」两个坑。
   */
  it("差值显示:两位、削尾零、带符号,零不写成 «+»", () => {
    const src = dlg();
    const at = src.indexOf("const multDeltaText");
    expect(at, "找不到 multDeltaText").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("const floorBrief"));
    expect(block, "倍率差要走 toFixed(2) 后削零").toContain("toFixed(2)");
    expect(block, "削零后是空串/-0 时要补回 0").toMatch(/"0"/);
    expect(block, "别在这一步乘 100 —— 那是百分比换算,该走 formatPercent").not.toContain("* 100");
  });
});

describe("灵根对照 · 决策真值是倍率,不是根数", () => {
  /*
   * 缺口:第一版对照只报了「根数 2 → 3 多 1 根」与均资质。而根数越多倍率越**低**
   * (`COUNT_FACTOR` 单根 1.6 / 五根 0.9),故「多 1 根」读起来像变好,实际是变差。
   * 真正要权衡的量是 `growthMult` —— 引擎已经在 `LinggenProfile` 上算好
   * (均资质 / 60 × 根数系数,混沌灵根再乘 1.5)。界面读它,不许自己乘一遍。
   */
  it("两侧都带引擎算好的倍率与倍率差", () => {
    const cmp = linggenCompare(profile("真灵根", [63, 44]), profile("天灵根", [92]));
    expect(cmp!.from.mult).toBeCloseTo(1.2, 2); // 53.5 / 60 × 1.35
    expect(cmp!.to.mult).toBeCloseTo(2.45, 2); // 92 / 60 × 1.6
    expect(cmp!.multDelta, "倍率差才是变好/变差的答案").toBeCloseTo(2.45 - 1.2, 2);
  });

  it("根数变多但倍率变低时,倍率差为负 —— 「多 1 根」不许被当成变好", () => {
    // 两枚根、均资质 90 → 2.03;三枚根、均资质 90 → 1.73(根数多一根,倍率反而低)
    const cmp = linggenCompare(profile("真灵根", [90, 90]), profile("真灵根", [90, 90, 90]));
    expect(cmp!.countDelta).toBe(1);
    expect(cmp!.multDelta, "根数多了但倍率降了 —— 这正是玩家需要看见的").toBeLessThan(0);
  });

  it("倍率读的是引擎字段,不在这里重算 —— 混沌灵根的特殊加成不许丢", () => {
    const chaos = {
      gradeName: "混沌灵根",
      // 引擎给混沌的是 COUNT_FACTOR[1] × 1.5:界面若自己按根数乘,会少算这 1.5
      growthMult: 9.9,
      roots: [{ element: "chaos" as const, aptitude: 99 }],
    };
    const cmp = linggenCompare(profile("杂灵根", [50, 50, 50]), chaos);
    expect(cmp!.to.mult, "读的必须是引擎给的数,不是「均值/60×系数」重算的").toBe(9.9);
  });

  it("倍率缺失或不是有限数 → 整块不出", () => {
    const good = profile("天灵根", [92]);
    expect(linggenCompare({ ...good, growthMult: Number.NaN }, good)).toBeNull();
    expect(
      linggenCompare({ ...good, growthMult: undefined as unknown as number }, good),
    ).toBeNull();
  });
});

describe("转世弹窗 · 把对照接进「来世根骨」", () => {
  it("读到本世灵根,与来世并排 —— 不只是来世那一手", () => {
    const src = dlg();
    expect(src, "要取本世灵根").toContain("player.linggen");
    expect(src, "要读那个对照 computed").toContain("linggenCompare(");
    expect(src, "要有稳定落点给判据与浏览器门").toContain("data-reincarnation-linggen-cmp");
  });

  it("对照在「来世根骨」那一章里,不在别处", () => {
    const src = dlg();
    const at = src.indexOf("data-reincarnation-linggen-cmp");
    expect(at, "找不到对照落点").toBeGreaterThan(0);
    const chapter = src.slice(
      src.indexOf('data-reincarnation-chapter="choice-roots"'),
      src.indexOf('data-reincarnation-chapter="choice-roots"') + 9000,
    );
    expect(chapter, "对照该落在「来世根骨」这一章里").toContain("data-reincarnation-linggen-cmp");
  });

  it("把倍率印出来 —— 「多 1 根」旁边必须有能判升跌的数", () => {
    const src = dlg();
    const at = src.indexOf("data-reincarnation-linggen-cmp");
    const near = src.slice(Math.max(0, at - 900), at + 1800);
    expect(near, "对照里要印修行倍率").toMatch(/multDelta|from\.mult|\.mult\b/);
  });

  it("倍率走 multText,不自己 toFixed —— 同一章首已有 multText 的写法", () => {
    /*
     * 章首 fact 写的是 `修行 ${multText(view.nextLinggen.growthMult)}` → 「修行 ×1.86」,
     * 而对照第一版用 `toFixed(2)` 印「×1.20」—— 同一个数在**同一章**里两种精度,
     * 正是 `ui/multText` 文件头点名要收掉的那种分化。
     */
    const src = dlg();
    const at = src.indexOf("data-reincarnation-linggen-cmp");
    const near = src.slice(Math.max(0, at - 900), at + 1800);
    expect(near, "对照里的倍率要走 multText").toContain("multText(");
    expect(near, "倍率不许自己 toFixed —— 那会与章首的写法分叉").not.toMatch(
      /mult\.toFixed\(|multDelta\.toFixed\(/,
    );
  });

  it("措辞用「换掉」不用「失去」—— 转世是主动选择,不是惩罚", () => {
    const src = dlg();
    const at = src.indexOf("data-reincarnation-linggen-cmp");
    const near = src.slice(Math.max(0, at - 900), at + 1200);
    for (const banned of ["失去灵根", "损失", "会失去"]) {
      expect(near, `对照写成了损失口径(「${banned}」)—— 转世是主动选择`).not.toContain(banned);
    }
  });
});
