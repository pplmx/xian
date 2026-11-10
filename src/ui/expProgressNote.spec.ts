/**
 * 「还剩 N%」—— 四舍五入到整数，会在刚起步时撒谎
 *
 * ## 缺口:进度条几乎空着，旁边却写「还剩 100%」
 *
 * `CultivationView` 的本境账上有一条:
 *
 * ```text
 *   本境修为   5.142亿 / 29.69兆            ← 进度条几乎为空(0.17%)
 *   还剩 100% · 约 1天11小时                 ← 四舍五入到整数
 * ```
 *
 * 算式是 `formatPercent(1 - player.expProgress, 0)`:本境刚起步时
 * `expProgress ≈ 0.0017`,于是 `1 - 0.0017 = 0.9983` → 取整 **100%**。
 *
 * 玩家看到的是「进度条没动 + 还剩 100%」—— 最自然的解读是**卡住了**。
 * 而这一行与进度条并排,对比格外刺眼:条是空的,数是满的。
 *
 * ## 不是「精度不够」,是「方向错了」
 *
 * 「还剩 100%」在语义上等于「一点没动」。可玩家明明已经攒了 5.1 亿。
 * 真正要报的是**已经走了多少**——把 `1 - x` 换成 `x`,四舍五入到整数后
 * 刚起步是 0%,攒到 0.5% 才进 1%,永远不会出现「动了却显示没动满」。
 *
 * 更进一步:刚起步时连「还剩 99%」也没信息量(它只是 100% 换了个写法)。
 * 故**进度不足 1% 时改报「刚起步」**,把那个几乎为空的状态说人话。
 *
 * ## 判据要防两头
 *
 *   一 进度条是空的,就不许说「还剩 100%」—— 那是同一眼里自相矛盾
 *   二 也不许走向另一个极端:刚起步时编一个精确到小数点的假读数
 *
 * ## 这一层只算,不读 store
 */
import { describe, expect, it } from "vite-plus/test";
import { expProgressNote } from "./expProgressNote";

describe("本境进度的一句话 · 纯函数", () => {
  it("刚起步时说「刚起步」,不报一个几乎为满的「还剩」", () => {
    // 夹具实测的比值:5.142亿 / 29.69兆 ≈ 0.0017
    const note = expProgressNote(0.0017, "约 1天11小时");
    expect(note, "刚起步不该说「还剩 100%」").not.toMatch(/还剩\s*100\s*%/);
    expect(note, "要说人话").toMatch(/刚起步|方起|初起/);
  });

  it("有进展时报的是**已走**多少,不是「还剩」", () => {
    /*
     * 「还剩 N%」在语义上等于「还差这么多没走」,而玩家真正想知道的是
     * 「我走了这么多」。且 `1 - x` 四舍五入在刚起步时必然报满,方向就是错的。
     */
    const note = expProgressNote(0.42, "约 3 时");
    expect(note, "报的是已走的 42%").toContain("42%");
    expect(note, "不该出现「还剩」").not.toContain("还剩");
  });

  it("快满也不报 100% —— 「已成 100% · 约 1 分」是另一种荒唐", () => {
    /*
     * 0.996 取整是 100%,而进度条上明明还差一截、时长还写着「约 1 分」。
     * 两头都要收口,否则只是把「还剩 100%」换成「已成 100%」。
     */
    const note = expProgressNote(0.996, "约 1 分");
    expect(note, "还差一分钟就不能说已成 100%").not.toContain("100%");
    expect(note, "要说人话").toMatch(/将要圆满|将至|将满/);
    expect(note, "时长照报").toContain("约 1 分");
  });

  it("走满了说「已圆满」,不再带百分数", () => {
    const note = expProgressNote(1, "即可突破");
    expect(note).toMatch(/已圆满/);
    expect(note, "满了就不必再报百分数").not.toContain("%");
  });

  it("时长照报 —— 它是这一行最有用的部分", () => {
    expect(expProgressNote(0.0017, "约 1天11小时")).toContain("约 1天11小时");
    expect(expProgressNote(0.5, "约 3 时")).toContain("约 3 时");
  });

  it("坏值不印 NaN —— 按刚起步处理", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -0.5]) {
      const note = expProgressNote(bad, "约 1 时");
      expect(note, `坏值 ${String(bad)} 漏出占位符`).not.toMatch(/NaN|Infinity/);
    }
  });

  it("超过 1 的比值夹到 1 —— 不印「120%」", () => {
    const note = expProgressNote(1.2, "约 1 分");
    expect(note).not.toContain("120%");
    expect(note, "夹回 1 后按已圆满说").toMatch(/已圆满/);
  });
});
