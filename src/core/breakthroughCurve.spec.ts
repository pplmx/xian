/**
 * 突破成功率那条曲线：**裸身越来越难，而加成越来越值钱**。
 *
 * ## 这件事此前没有任何人说破
 *
 * 大关成功率是 `BT_MAJOR_BASE_RATE − major × BT_MAJOR_DECAY`（78% 起，每境降 5pp），
 * 再被夹在 `[BT_MIN_RATE, BT_MAX_RATE]`（15%~98%）之间。于是：
 *
 * ```text
 *   境界   裸身大关率   距 15% 地板
 *    0       78%        地面上
 *    5       53%        地面上
 *    9       33%        地面上
 *   13       15%        已在地板
 *   20       15%        已在地板
 * ```
 *
 * 第一眼看像缺陷：**21 个大关里有 8 个（38%）的裸身率完全相同**，境 13~20 那一段
 * 曲线是平的。我这一轮就是带着这个判断去量的，量完发现不是 ——
 *
 * ## 地板夹的是**裸身**，不是最终成功率
 *
 * `clampRate` 只用在地板的取值范围内，而玩家的加成是**在夹取之前**加上去的：
 *
 * ```text
 *   境 13 裸身 15%
 *   堆 +10% → 25%
 *   堆 +30% → 45%
 *   堆 +60% → 75%
 * ```
 *
 * 故后期不是「堆不动」，而是**可堆的空间更大了**：
 *
 * ```text
 *   境界   裸身   到 98% 的可堆空间
 *    0     78%        +20pp
 *    5     53%        +45pp
 *    9     33%        +65pp
 *   13     15%        +83pp
 * ```
 *
 * 这是有意的手感：「越到后面，越靠你攒了什么，而不是靠境界本身」。
 *
 * ## 故判据守的是这个形状，不是某个具体的数
 *
 * 值本身归 `data/constants`（改它不该让这里红）；这里守的是**关系**：
 * ① 裸身率随境界单调不增；② 加成空间随境界单调不减；③ 两端都落在地板之上与
 * 封顶之下（曲线真的被用到了，不是整段被夹死）。
 *
 * 为什么值得一条判据：这三件事**没有任何文档写过、没有任何 spec 守过**。
 * 若哪天有人把 `BT_MAJOR_DECAY` 从 0.05 调大（让曲线更早撞地板），
 * 或者调小（让境 20 都撞不到地板），① 与 ② 会立刻变形状，而现有判据
 * （`formulas.spec` 只断言率在 `[0.15, 0.98]` 内）一条都不会红。
 */
import { describe, expect, it } from "vite-plus/test";
import { breakthroughBaseRate, clampRate } from "./formulas";
import { BT_MAX_RATE, BT_MIN_RATE, SUB_LEVELS } from "@/data/constants";
import { MAX_MAJOR } from "@/data/realms";

/** 每个境界**大关**（最后一层）的裸身成功率 */
function majorRates(): number[] {
  const out: number[] = [];
  for (let major = 0; major <= MAX_MAJOR; major += 1) {
    out.push(breakthroughBaseRate(major, SUB_LEVELS - 1));
  }
  return out;
}

describe("突破曲线 · 裸身越难，加成越值钱", () => {
  it("裸身大关率随境界单调不增", () => {
    const rates = majorRates();
    for (let i = 1; i < rates.length; i += 1) {
      expect(
        rates[i]!,
        `境 ${i} 的裸身大关率(${(rates[i]! * 100).toFixed(0)}%)比境 ${i - 1}(${(rates[i - 1]! * 100).toFixed(0)}%)更高 —— 后面的境界反而更好过`,
      ).toBeLessThanOrEqual(rates[i - 1]!);
    }
  });

  it("加成空间随境界单调不减 —— 后期不是「堆不动」，是「堆得更值」", () => {
    /*
     * 这一条是整份判据的**核心**：它把「地板夹的是裸身」这件事钉住。
     * 若哪天有人把加成也塞进夹取之后（或把地板抬到 98% 附近），
     * 后期玩家的每一份投入都会白花，而 `formulas.spec` 那条只查取值范围，看不出来。
     */
    const rates = majorRates();
    const headroom = rates.map((r) => BT_MAX_RATE - r);
    for (let i = 1; i < headroom.length; i += 1) {
      expect(
        headroom[i]!,
        `境 ${i} 的可堆空间(${(headroom[i]! * 100).toFixed(0)}pp)比境 ${i - 1}(${(headroom[i - 1]! * 100).toFixed(0)}pp)更小 —— ` +
          "后期的加成反而不如前期值钱，那就没人有理由往深里修",
      ).toBeGreaterThanOrEqual(headroom[i - 1]! - 1e-9);
    }
  });

  it("两端都用上了：首境不贴封顶，末境压到地板附近", () => {
    /*
     * 「单调」可以靠一条常数曲线平凡满足（比如全程 15%），
     * 故再钉两端：初境要明显高于地板，末境要真的落到地板上。
     * 只说「单调」而不钉两端，等于允许把整条曲线拉平。
     */
    const rates = majorRates();
    const first = rates[0]!;
    const last = rates[rates.length - 1]!;
    expect(
      first,
      `首境大关率只有 ${(first * 100).toFixed(0)}% —— 与末境没拉开，曲线等于平的`,
    ).toBeGreaterThan(BT_MIN_RATE + 0.3);
    expect(first, "首境已经贴着封顶，前期的加成无处可加").toBeLessThan(BT_MAX_RATE - 0.1);
    expect(
      last,
      `末境裸身率还有 ${(last * 100).toFixed(0)}%，没压到地板附近 —— 曲线的下半段没被用到`,
    ).toBeLessThan(BT_MIN_RATE + 0.1);
  });

  it("贴在裸身地板上的境界不能太多 —— 否则曲线等于提前断了", () => {
    /*
     * ## 这条是一次故障注入逼出来的
     *
     * 前面的「单调不增」与「加成空间单调不减」有一个**共同弱点**：
     * 把 `BT_MAJOR_DECAY` 调大（0.05 → 0.08），曲线更早撞到地板、后面更多境变成平线 ——
     * 而两条单调性**依然成立**（平的也算单调），四条判据全绿。
     *
     * 实测那次注入之后贴地板的境界从 8 个变成 13 个，而那正是「曲线提前断掉」。
     * 故补这一条：贴地板的境界可以有（后期本就该难），但不许占掉半个表。
     *
     * 阈值取「不过半」而不是一个精确数：具体几个归 `data/constants` 的调参者决定，
     * 这里只挡「曲线被截断成一条平线」这种结构性变化。
     */
    const rates = majorRates();
    const floored = rates.filter((r) => Math.abs(r - BT_MIN_RATE) < 1e-9).length;
    expect(
      floored,
      `${floored}/${rates.length} 个大关的裸身率都贴在地板(${(BT_MIN_RATE * 100).toFixed(0)}%)上 —— ` +
        "曲线的下半段被截断了，从那一境起再没有「越往后越难」这回事",
    ).toBeLessThanOrEqual(Math.floor(rates.length / 2));
  });

  it("裸身贴地板的那些境界，加成仍然逐点有效", () => {
    /*
     * 这条是「地板夹裸身、不夹最终值」的**行为证据**（上一条是关系证据）。
     * 只测关系不够：若哪天地板被改成夹最终值，`headroom` 会照旧单调，
     * 而玩家堆上去却纹丝不动 —— 这一条才会红。
     */
    const floored = majorRates()
      .map((r, i) => ({ major: i, r }))
      .filter(({ r }) => Math.abs(r - BT_MIN_RATE) < 1e-9);
    expect(floored.length, "没有一个大关贴到地板 —— 这条判据的前提不成立了").toBeGreaterThan(0);

    for (const { major, r } of floored) {
      /*
       * 走**真正的装配路径** `clampRate(裸身 + 加成)` —— 那是 `breakthroughInfo`
       * 里判定与展示共用的那一行。
       *
       * 第一版这里写的是 `Math.min(BT_MAX_RATE, r + add)`，即手搓一份夹取 ——
       * 于是把 `clampRate` 改成恒返回地板时，这条判据**照样绿**：
       * 它测的是自己手搓的算式，不是产品那条路。故障注入当场揭穿。
       */
      for (const add of [0.1, 0.3, 0.6]) {
        const stacked = clampRate(r + add);
        expect(
          stacked,
          `境 ${major} 已在地板(${(r * 100).toFixed(0)}%)，堆 +${add * 100}pp 之后仍是 ${(stacked * 100).toFixed(0)}% —— 加成被地板吃掉了`,
        ).toBeGreaterThan(r);
      }
    }
  });
});
