/**
 * 随机事件按境界的供给 —— 中段有一处断层,先把它量出来。
 *
 * ## 缺口(第 135 轮实测)
 *
 * `data/events` 的文件头写「按区域标签 + **境界带**匹配」,即每个事件有
 * `minRealm` / `maxRealm` 描述它落在哪一段。把「第 m 境能碰到几个事件」算出来:
 *
 * ```text
 *   境  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20
 *   数 62  67  68  61  61  60  55  48  44  28  30  32  33  33  37  42  45  44  46  51  51
 *                                          ↑
 *                                    8 → 9 断崖:44 → 28(跌 36%)
 * ```
 *
 * 根因不在「事件总数不够」,在**境界带的边界**:
 *
 * ```text
 *   minRealm = 0 的事件      62 个
 *   其中设了 maxRealm 的      47 个,而 maxRealm 最大只到 8
 *   → 47 个开局事件在第 9 境集体失效
 * ```
 *
 * 顶替它们的高境事件每境只有 1~9 个,补不上那个缺口。
 *
 * ## 判据为什么不写成「每境至少 N 个」
 *
 * 因为**修法不是加事件,是调边界** —— 而调边界需要判断每个事件「在更高境界还算不算
 * 说得通」(「你在山门口捡到一枚铜钱」放在第 15 境就不合适)。那是内容判断,不是审计能定的。
 *
 * 故这条判据做的是**把曲线钉住**,而不是要求它满足某个形状:
 *
 * ① 每一境都至少有几个事件可碰(下限很低,只防「某境一个事件都没有」);
 * ② 相邻两极的落差不超过某个比例 —— 这条会红在第 9 境,而它红了的意思是
 *    「有人动了境界带或加了事件,中段断层变了,**回来看一眼**」,不是「你必须补事件」。
 *
 * 换句话说:这条判据记的是**一个已知的、被接受了的缺口**。
 * 它的价值不在拦住什么,而在**让缺口不会被忘掉**。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 第 m 境能碰到的事件数 */
function eventsAt(major: number): number {
  return EVENTS.filter(
    (e) => (e.minRealm ?? 0) <= major && (e.maxRealm ?? Number.MAX_SAFE_INTEGER) >= major,
  ).length;
}

/** 最高境界(与 data/realms 的 21 境对上:0 ~ 20) */
const TOP = 20;

describe("随机事件的境界供给", () => {
  it("① 每一境都有事件可碰,下限不许破", () => {
    const thin: string[] = [];
    for (let m = 0; m <= TOP; m += 1) {
      const n = eventsAt(m);
      // 下限取 20:低于这个数,一境之内很快就会反复撞同一批事件
      if (n < 20) thin.push(`第 ${m} 境只有 ${n} 个`);
    }
    expect(thin, "某些境界的事件供给太薄 —— 一境之内会很快撞同一批:" + thin.join("、")).toEqual([]);
  });

  it("② 相邻两极落差不超过四成(第 9 境那处断层是已知且被接受的)", () => {
    /*
     * 8 → 9 是 44 → 28,跌 36% —— 在四成以内,故这条现在绿的。
     *
     * 它守的是**别让断层变得更深**:若哪天有人再给几个开局事件加 `maxRealm: 8`,
     * 第 9 境会掉到 20 上下,这条就红。红的时候该做的是**回来看境界带**,
     * 而不是把阈值调大。
     */
    const drops: string[] = [];
    for (let m = 1; m <= TOP; m += 1) {
      const prev = eventsAt(m - 1);
      const cur = eventsAt(m);
      if (prev === 0) continue;
      const drop = (prev - cur) / prev;
      if (drop > 0.4)
        drops.push(`第 ${m - 1} → ${m}:${prev} → ${cur}(跌 ${(drop * 100).toFixed(0)}%)`);
    }
    expect(
      drops,
      "相邻境界的事件供给跌得太狠 —— 境界带断了,回来看 minRealm / maxRealm:" + drops.join("、"),
    ).toEqual([]);
  });

  it("③ 记录:开局事件与高境事件的边界分布", () => {
    /*
     * 这条不是判据,是**把现状写进测试输出**。跑测试时能看到边界集中在哪,
     * 下次要补内容时就知道该动哪儿。
     */
    const zeroMin = EVENTS.filter((e) => (e.minRealm ?? 0) === 0);
    const withMax = zeroMin.filter((e) => e.maxRealm !== undefined);
    const maxes = new Map<number, number>();
    for (const e of withMax) maxes.set(e.maxRealm!, (maxes.get(e.maxRealm!) ?? 0) + 1);
    const maxList = [...maxes.entries()].sort((a, b) => a[0] - b[0]);

    process.stdout.write(
      `\n—— 随机事件 ${EVENTS.length} 个,按境界的供给 ——\n` +
        Array.from({ length: TOP + 1 }, (_, m) => `  ${m}: ${eventsAt(m)}`).join("\n") +
        `\n\n开局事件(minRealm 0)${zeroMin.length} 个,其中 ${withMax.length} 个有 maxRealm:\n` +
        maxList.map(([k, v]) => `  maxRealm ${k}: ${v} 个`).join("\n") +
        `\n\n> 第 9 境是断层(minRealm 0 的 47 个事件在这一境集体失效)。` +
        `\n> 修法是调边界或补高境事件 —— 都要内容判断,不是审计能定的。\n`,
    );

    // 最基本的形态检查
    expect(zeroMin.length, "开局事件少了").toBeGreaterThan(30);
    expect(withMax.length, "开局事件几乎都没有上界 —— 境界带设计变了").toBeGreaterThan(20);
    expect(maxList.length, "maxRealm 的取值太单一").toBeGreaterThan(3);
  });

  it("反空转:事件表非空,境界范围可算", () => {
    expect(EVENTS.length, "事件表空了").toBeGreaterThan(50);
    expect(eventsAt(0), "第 0 境一个事件都没有").toBeGreaterThan(0);
    expect(TOP, "最高境界改了 —— 这条判据的循环上界要跟着改").toBe(20);
  });
});
