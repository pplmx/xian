/**
 * 道果边际的百分数 —— 它该不该跟全仓一样取整。
 *
 * ## 现状
 *
 * `fruitMarginalInfo()` 把「再多一枚道果,有效收益涨多少」算成一个百分数,
 * 用的是 `delta.toFixed(2)` 直接拼 `%`:
 *
 *   道果 0 枚 → 100.00%     道果 10 枚 → 8.96%
 *   道果 3 枚 → 29.55%      道果 40 枚 → 2.25%
 *   道果 20 枚 → 4.49%      道果 100 枚 → 0.90%
 *
 * 而全仓一百多处百分数走的是 `formatPercent(x, 0)`,印成整数:8.96% → 9%。
 *
 * ## 这一条要定的是什么
 *
 * 不是「取整更整齐」就该取整。这个数在软上限后掉得很快(道果过二十之后
 * 每枚只增百分之零点几),**取整会把它压成 1% 或 0%**——而 0% 会让玩家以为
 * 「再攒一枚也没用」,那与事实相反(它仍是永久的)。
 *
 * 故这里的结论是:**保留两位,但走同一份格式化**,而不是手写 `toFixed + "%"`。
 * 为什么是同一份:手写的那一份不处理两类边界 ——
 *
 *   上溢 —— `delta` 是 `(next−eff)/eff*100`,eff 极小时 delta 可以是 Infinity,
 *           手写会印出「Infinity%」
 *   极小 —— 0.004% 印出来像有进展,其实一位都没有
 *
 * `formatPercent` 这两类都有处理(见 utils/format 的注释)。
 *
 * ## 所以这一条判据守两件事
 *
 *   一 位数:两位(与"这一枚有没有用"这个判断所需的分辨率相称);
 *   二 走共享格式化:染色、上溢、极小值都由那一份管,不手写。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { formatPercent, formatSignedPercent } from "@/utils/format";

describe("道果边际 · 为什么两位", () => {
  it("两位分辨率下,软上限之后的差别仍看得出来", () => {
    /*
     * 这是决定"两位"而非"整数"的实际依据 —— 不是审美。
     * 取整会把 2.25% 压成 2%、0.90% 压成 1%,而 0.90% 与 1.00% 在玩家眼里
     * 是"还剩一点"与"已经没了"的分界。
     */
    expect(formatPercent(0.009, 2)).toBe("0.9%");
    expect(formatPercent(0.0225, 2)).toBe("2.25%");
    // 取整就丢了
    expect(formatPercent(0.009, 0)).toBe("1%");
    expect(formatPercent(0.0225, 0)).toBe("2%");
  });

  it("共享格式化处理得了极小值与上溢 —— 手写 toFixed 处理不了", () => {
    // 极小:一位都到不了的不该印成 0.0x
    expect(formatPercent(0.00001, 2)).toBe("0%");
    // 上溢
    expect(formatPercent(Number.MAX_VALUE, 2)).not.toContain("Infinity");
  });
});

describe("道果边际 · 走共享格式化", () => {
  it("不再手写 toFixed + 百分号", () => {
    /*
     * 去注释再查:原地那条注释正当解释着「从前这里是 `delta.toFixed(2)` 拼一个 %」。
     * 不去注释,解释本身就会被当成"又长回来了"——本仓这类误伤已出现八次。
     */
    const src = readSource("src/core/resourceGuidance.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "不该再手写 toFixed 拼百分号").not.toMatch(/delta\.toFixed\(/);
    expect(src, "该走共享格式化").toContain("formatPercent(");
  });

  it("字段名仍说得出它是百分数 —— 调用方读的是 deltaPct", () => {
    /*
     * 名字保留 `deltaPct` 是刻意的:两处模板(FurnaceDialog / RebirthDialog)
     * 都写着 `+{{ fruitInfo.deltaPct }}%`,若在这里改成带 % 的字符串,
     * 模板那一侧就会印出 `+8.96%%`。故这里只把**格式化**换掉,不改契约。
     */
    const src = readSource("src/core/resourceGuidance.ts");
    expect(src).toContain("deltaPct:");
  });

  it("正负号仍有意义时用带号的写法", () => {
    // 边际收益只会掉不会涨,但格式化层要认得出负数 —— 用同一份带上界判断
    expect(formatSignedPercent(0.0225, 2)).toBe("+2.25%");
    expect(formatSignedPercent(-0.0225, 2)).toBe("-2.25%");
  });
});
