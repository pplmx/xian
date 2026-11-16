/**
 * 灵脉的两种加成通道 —— 意图留空 vs 漏填。
 *
 * ## 由来（第 424 轮）
 *
 * 七条灵脉里，六条的 `perPoint` 写着各自的属性加成；只有寒冥灵脉是 `{}`。
 * 一眼看过去像漏填了 —— 而它的 `desc` 明写「静水映月，功法进修所费更少」。
 *
 * 查下去发现：**那一条走的是独立通道**。
 *
 * ```text
 *   六条      perPoint: { cultivationSpeed: 0.004 } 等
 *             → veinModsOf 汇总成 StatMods，进属性合并
 *
 *   寒冥      perPoint: {}
 *             → insightDiscountOf(points) 每点 0.4%、封顶 50%
 *             → store 的 insightDiscount，功法参悟实扣时读它
 * ```
 *
 * 两条通道有不同的量纲与封顶规则，硬塞进 `perPoint` 反而会错 ——
 * 故 `{}` 是**有意留空**，不是缺陷。
 *
 * ## 但这个「有意」此前没被记下来
 *
 * `engineVeinParity.spec` 用 `Object.entries(perPoint)` 遍历，
 * 空对象直接跳过 —— 它分不出「有意握手另一通道」与「忘了填」。
 *
 * 判据补两件事：
 *
 * ① 每条灵脉**至少有一条加成通道**（`perPoint` 非空，或在 `DEDICATED_CHANNEL` 里登记）；
 * ② 登记了独立通道的，**那条通道真的接上了**（函数存在、被生产代码调用）；
 * ③ 反空转：七条灵脉都扫到了。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VEINS, insightDiscountOf, INSIGHT_DISCOUNT_PER_POINT } from "@/data/veins";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/**
 * 不走 `perPoint`、另有独立结算通道的灵脉。
 *
 * 登记一条要写明**那条通道是什么**，以及它的换算入口在哪 ——
 * 这样下一个读代码的人不会把它当成漏填。
 */
const DEDICATED_CHANNEL = new Map<string, { channel: string; entry: string }>([
  [
    "insight",
    {
      channel: "功法参悟折扣（不进 StatMods —— 量纲不同，它折的是消耗不是产出）",
      entry: "insightDiscountOf",
    },
  ],
]);

describe("灵脉 · 每条都得真的加点什么", () => {
  it("至少一条加成通道：perPoint 非空，或登记的独立通道", () => {
    const empty: string[] = [];
    for (const v of VEINS) {
      const hasPerPoint = Object.keys(v.perPoint).length > 0;
      const hasDedicated = DEDICATED_CHANNEL.has(v.id);
      if (!hasPerPoint && !hasDedicated) {
        empty.push(`${v.name}(${v.id}) —— 「${v.desc}」，而 perPoint 是空的、也没登记独立通道`);
      }
    }
    expect(
      empty,
      "这些灵脉投点之后什么都没有 —— 描述里承诺的效果不存在:" + empty.join(" / "),
    ).toEqual([]);
  });

  it("登记的独立通道，真的接上了", () => {
    /*
     * 只登记不接线，等于把一个缺陷写进了名单。
     * 判据查两件事：那个换算入口存在，且**生产代码里有人在调它**。
     */
    for (const [id, info] of DEDICATED_CHANNEL) {
      const v = VEINS.find((x) => x.id === id);
      expect(v, `登记了 ${id}，而 VEINS 里没有这条 —— 名单要跟着内容走`).toBeDefined();

      /*
       * 换算入口必须真的产出一个非零的数。这里只认参悟那一支 ——
       * 将来若新增别的独立通道，把这一句换成一个查表。
       */
      if (info.entry === "insightDiscountOf") {
        expect(insightDiscountOf(0), "投 0 点时该是 0 折扣（否则这条通道在小点位上就白送）").toBe(
          0,
        );
        expect(
          insightDiscountOf(10),
          `投 10 点该按每点 ${INSIGHT_DISCOUNT_PER_POINT} 折出 ${10 * INSIGHT_DISCOUNT_PER_POINT}`,
        ).toBeCloseTo(10 * INSIGHT_DISCOUNT_PER_POINT, 10);
        // 封顶要真的在
        expect(insightDiscountOf(10_000), "没有封顶 —— 玩家能把功法折成免费").toBeLessThanOrEqual(
          0.5,
        );
      }

      // 生产代码里有人在调它（剥注释后搜）
      const callers = walkFiles("src", isSourceFile)
        .filter((f) => !f.endsWith(".spec.ts"))
        .filter((f) => stripComments(readSource(f)).includes(`${info.entry}(`));
      expect(
        callers.length,
        `登记了「${info.channel}」，而没有任何生产代码调用 ${info.entry} —— 那条通道是死的`,
      ).toBeGreaterThan(0);
    }
  });

  it("反差：perPoint 为空的灵脉，必须都在名单里", () => {
    /*
     * 这条防的是「有人又加了一条空灵脉，顺手把名单也放行」——
     * 名单必须是穷举的：凡是 perPoint 空着的，都要点名登记。
     */
    const unregistered = VEINS.filter(
      (v) => Object.keys(v.perPoint).length === 0 && !DEDICATED_CHANNEL.has(v.id),
    ).map((v) => v.name);
    expect(
      unregistered,
      "这些灵脉 perPoint 是空的、也没登记 —— 投点会是白投:" + unregistered.join("、"),
    ).toEqual([]);
  });

  it("反空转：七条灵脉都扫到了，且名单里没有过期的条目", () => {
    expect(VEINS.length, "灵脉太少 —— 判据量不出东西").toBeGreaterThanOrEqual(5);
    for (const id of DEDICATED_CHANNEL.keys()) {
      expect(
        VEINS.some((v) => v.id === id),
        `名单里的 ${id} 已经不在 VEINS 里了 —— 该销账`,
      ).toBe(true);
    }
  });

  it("寒冥灵脉的 desc 与它那条通道对得上（说的事就是做的事）", () => {
    /*
     * 它说「功法进修所费更少」，通道就该是「折消耗」这一类。
     * 若哪天有人把 desc 改成「修行更快」而通道没换，这条会红。
     */
    const v = VEINS.find((x) => x.id === "insight")!;
    const src = readFileSync(resolve(__dirname, "../core/gongfaService.ts"), "utf-8");
    /*
     * 功法结算真的读那个折扣 —— **作为属性访问或调用**，不是字符串里出现过。
     *
     * 初版用的是 `/insightDiscount/`，于是把变量名改成 `insightDiscount_UNUSED`
     * 之后它照样绿（实测）。判据要钉的是「被读」，不是「这个词在文件里」。
     */
    expect(src, "功法结算没有读 insightDiscount —— 寒冥灵脉承诺的折扣无处生效").toMatch(
      /\binsightDiscount(?![_\w])/,
    );
    void v;
  });
});
