/**
 * 同一境界的丹方，价差不该拉到 5 倍。
 *
 * ## 由来（第 502 轮）
 *
 * 查「可炼方的灵石基价是否随境界单调」时，逐境打印出每境的 `stoneBase` 区间:
 *
 * ```text
 *   境 11   仙泉玉液=260   金仙道体丹=660
 *   境 12   安神丹=150     玄胎丹=700  道音丹=760  太乙露=760
 *   境 18   道泉丹=560     道源丹=1400 本源丹=1500
 * ```
 *
 * 安神丹最刺眼:它在**境 12**，而售价 150 —— 比境 0 的聚灵丹(25)只高六倍，
 * 比同境的玄胎丹(700)低 4.7 倍。
 *
 * 根因不是「写错了数」，而是**这味丹的 id 与价钱是旧的**:
 * 它的注释写着「'火候'是炼丹者的本事,不是丹能管的火 —— 此名已废,改走安神一路(id 沿旧)」。
 * 当年改名时，`recipe` 的两个数没跟着境界一起抬。
 *
 * 而它的效果一点也不弱:`{ qiRegen: 0.25, alchemyYield: 0.2 }` 持续 900 秒 ——
 * 那是「回气 + 炼丹双成」，境界 12 的玩家可以花买白菜的钱反复吃。
 *
 * ## 判据
 *
 * ① 同一境界内，可炼方的灵石基价最高与最低相差不超过 5 倍;
 * ② 反差：跨境界不在此列 —— 高境界的丹贵，那是应该的，且已有别处口径;
 * ③ 反差：单味丹的境界（只有一味可炼方的境界）不参与，避免除零。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";

interface RecipeLike {
  stoneBase?: number;
}

function craftable() {
  return PILLS.filter((p) => p.recipe).map((p) => ({
    name: p.name,
    realm: p.minRealm,
    stone: (p.recipe as RecipeLike).stoneBase ?? 0,
  }));
}

describe("丹方定价 · 同一境界内的价差", () => {
  it("① 同境界、同定位的最高与最低不超过 5 倍", () => {
    /*
     * 分组比的是「定位」而不是整个境界 —— 这一条是被实测逼出来的:
     *
     *   境 6  御风丹(70) vs 万灵丹(380)  5.4 倍
     *         御风丹 = cultivationSpeed +75% 持续 1800 秒（加速）
     *         万灵丹 = 直接给 5400 秒修为（给量）
     *   两者定位完全不同，价差大是对的。
     *
     *   境 12 安神丹(150) vs 道音丹(760)  5.1 倍
     *         安神丹 = qiRegen + alchemyYield（增益）
     *         道音丹 = wudao（即时给量）
     *   这一组**不是**定位不同造成的 —— 安神丹的 id 与价钱是旧的
     *   （注释:「此名已废,改走安神一路(id 沿旧)」），当年改名时 recipe 没跟着抬。
     */
    const familyOf = (p: (typeof PILLS)[number]): string => {
      if (p.kind === "buff") return "buff";
      if (!p.instant || Array.isArray(p.instant)) return "other";
      const keys = Object.keys(p.instant);
      if (keys.includes("expSecs") || keys.includes("expFixed")) return "exp";
      if (keys.includes("wudao")) return "wudao";
      if (keys.includes("qiPct")) return "qi";
      if (keys.includes("lifespanYears")) return "life";
      return "other";
    };
    const byRealm = new Map<string, { name: string; stone: number }[]>();
    for (const p of PILLS) {
      if (!p.recipe) continue;
      const key = `${p.minRealm}|${familyOf(p)}`;
      byRealm.set(key, [
        ...(byRealm.get(key) ?? []),
        { name: p.name, stone: (p.recipe as RecipeLike).stoneBase ?? 0 },
      ]);
    }
    const bad: string[] = [];
    for (const [key, list] of byRealm) {
      if (list.length < 2) continue;
      const prices = list.map((x) => x.stone);
      const lo = Math.min(...prices);
      const hi = Math.max(...prices);
      if (lo <= 0) continue;
      const ratio = hi / lo;
      if (ratio > 5) {
        const cheap = list.filter((x) => x.stone === lo).map((x) => x.name);
        const dear = list.filter((x) => x.stone === hi).map((x) => x.name);
        bad.push(
          `${key}: ${cheap.join("/")}=${lo} 与 ${dear.join("/")}=${hi} 相差 ${ratio.toFixed(1)} 倍`,
        );
      }
    }
    expect(bad, "同境界的丹方价差过大 —— 便宜的那味会被刷：" + bad.join("；")).toEqual([]);
  });

  it("② 反差：跨境界贵是对的", () => {
    /*
     * 这一条守的是①的边界 —— 免得后来者把判据扩成「所有丹方都不许差 3 倍」，
     * 那会把「高境界丹更贵」这条正确设计判成问题。
     */
    const c = craftable();
    const low = c.filter((x) => x.realm <= 2);
    const high = c.filter((x) => x.realm >= 15);
    const avg = (xs: { stone: number }[]) => xs.reduce((s, x) => s + x.stone, 0) / xs.length;
    expect(avg(high), "高境界的丹不比低境界贵 —— 那判据①的前提变了").toBeGreaterThan(avg(low) * 5);
  });

  it("④ buff 丹的价必须随境界走 —— 它是同一族，只是被分到了不同境界", () => {
    /*
     * ## 这一条抓到的是安神丹
     *
     * buff 型丹一共 26 味，按境界排开:
     *
     * ```text
     *   境 0   12 / 18 / 25      境 5   216      境 10  620
     *   境 1   30 / 30 / 32 / 60 境 7   420      境 11  660
     *   境 3   55 / 60           境 8   300      境 12  150   ← 断裂
     *   境 4   48 / 90 / 90      境 9   572      境 15  1000 / 820
     * ```
     *
     * 安神丹在境 12 而只要 150 —— 比境 5 的炼虚神游丹(216)还便宜。
     * 它的效果是 `{ qiRegen: 0.25, alchemyYield: 0.2 }` 持续 900 秒，一点也不弱。
     *
     * 根因写在它自己的注释里:「'火候'是炼丹者的本事,不是丹能管的火 ——
     * 此名已废,改走安神一路(id 沿旧)」。改名时 `recipe` 的两个数没跟着境界抬。
     *
     * 判据:同一境界的 buff 丹价不低于「低境界里最贵的那味」的一半。
     */
    const buffs = PILLS.filter((p) => p.kind === "buff" && p.recipe)
      .map((p) => ({
        name: p.name,
        realm: p.minRealm,
        stone: (p.recipe as RecipeLike).stoneBase ?? 0,
      }))
      .sort((a, b) => a.realm - b.realm);
    const bad: string[] = [];
    let maxBelow = 0;
    for (const b of buffs) {
      /* 与「所有更低境界的 buff 丹里最贵的」比 */
      if (maxBelow > 0 && b.stone * 2 < maxBelow) {
        bad.push(`${b.name}(境 ${b.realm}) = ${b.stone}，而更低境界里最贵的 buff 丹 = ${maxBelow}`);
      }
      maxBelow = Math.max(maxBelow, b.stone);
    }
    expect(
      bad,
      "这些 buff 丹比更低境界的还便宜 —— 命名沿用时价格没跟着抬：" + bad.join("；"),
    ).toEqual([]);
  });

  it("③ 反差：单味丹的境界不参与比较", () => {
    const byRealm = new Map<number, number>();
    for (const c of craftable()) byRealm.set(c.realm, (byRealm.get(c.realm) ?? 0) + 1);
    /* 只要确实存在「多味」的境界，判据①就不是空转的 */
    expect([...byRealm.values()].filter((n) => n >= 2).length).toBeGreaterThan(3);
  });
});
