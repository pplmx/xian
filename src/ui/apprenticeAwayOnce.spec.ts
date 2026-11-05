/**
 * 门庭四门存底 —— 「无人在途」一屏说了两遍。
 *
 * ## 复现
 *
 * 「今日门庭」的四门存底是四格账。玩家没有弟子在外时,其中两格长这样:
 *
 * ```text
 * 途  在途 0 人        ← value: 0 人,detail: 「无人在途」
 *     无人在途
 *
 * 归  最近归来         ← value: 「无人在途」,detail: 「候差者可先派一单」
 *     无人在途
 * ```
 *
 * 「在途 = 0 人」已经把「没人在路上」说尽了;紧跟着再补一句「无人在途」,
 * 而右边那一格的主值又是「无人在途」—— 同一个事实在首屏出现两遍,
 * 而这两格本该各说各的:「在途」说**有几个人在外**,「最近归来」说**下一个回来的**。
 *
 * ## 改哪一处
 *
 * 改「在途」格的 detail。理由:
 *
 *   · 它的 value 已经是 `0 人` —— 数字本身就是答案,detail 再说一遍是复读;
 *   · 「最近归来」格的主值必须是「无人在途」或一个归期 —— 那一格的全部意义
 *     就是回答「下一个什么时候回来」,没有别的可说;
 *   · 而「在途」格的 detail 有更好的内容可写:没人外出时,下一件事是
 *     **派一个出去**,那正是玩家此刻能做的。
 *
 * 故「在途 0 人」的 detail 改成派差提示,与「归」格那句分工:
 *   在途:「候差者可先派一单」—— 你现在能做什么
 *   归来: 仍是「无人在途」——    下一个什么时候回来(答案是:没有)
 *
 * ## 判据守什么
 *
 * 一条:「无人在途」这个字串在门庭页的模板里**最多出现一次**。
 *
 * 不钉它出现在哪一格(版式归版式),只钉同一屏不许说两遍。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/ApprenticeView.vue";

describe("门庭 · 「无人在途」只说一遍", () => {
  it("模板里最多一处渲染「无人在途」", () => {
    const src = readSource(VIEW);
    /*
     * 数模板里的出现次数(注释里提到不算)—— 这个串在脚本里两处、模板里经由
     * `nextReturn.countdown` 与 `away.detail` 各渲染一次。
     * 判据量的是**脚本里作为字面量给了几次**,因为模板只写变量名。
     */
    const script = src.slice(src.indexOf("<script"));
    const hits = (script.match(/"无人在途"/g) ?? []).length;
    expect(
      hits,
      `脚本里给了 ${hits} 次「无人在途」—— 「在途 0 人」与「最近归来」两格会在首屏各说一遍同一件事`,
    ).toBeLessThanOrEqual(1);
  });

  it("「在途」格的 detail 在没人时说的是「能做什么」,不是复诉「没人」", () => {
    const src = readSource(VIEW);
    const away = src.match(/id: "away"[\s\S]{0,420}/)?.[0] ?? "";
    expect(away, "定位不到「在途」那一格 —— 判据会空转").not.toBe("");
    // detail 那一行(不是整块)才作数
    const detail = away.match(/detail:[\s\S]{0,120}/)?.[0] ?? "";
    expect(
      detail,
      "在途格没人在外时,detail 该指向「下一步能做什么」(派差),而不是把「无人在途」再说一遍",
    ).toMatch(/派/);
    expect(detail, "在途格的 detail 不许再写「无人在途」").not.toContain("无人在途");
  });

  it("换说法不等于消重 —— 两格的 detail 不许是同一句", () => {
    /*
     * 第一版把「在途」格改成「候差者可先派一单」,而「最近归来」格在无人时
     * 写的**正是这一句**(`nextReturn.route || "候差者可先派一单"`)——
     * 重复只是换了个位置,没有真的消掉。
     * 故这一条量两格 detail 的兜底文案不许逐字相同。
     */
    const src = readSource(VIEW);
    const away =
      src.match(/id: "away"[\s\S]{0,420}/)?.[0]?.match(/detail:[\s\S]{0,120}/)?.[0] ?? "";
    const next =
      src.match(/id: "next"[\s\S]{0,420}/)?.[0]?.match(/detail:[\s\S]{0,120}/)?.[0] ?? "";
    expect(away, "定位不到在途格 detail").not.toBe("");
    expect(next, "定位不到归来格 detail").not.toBe("");
    const quote = (s: string) => [...s.matchAll(/"([^"]{2,})"/g)].map((m) => m[1]!).pop() ?? "";
    expect(
      quote(away),
      `两格的兜底文案是同一句「${quote(away)}」—— 那是把重复换了个说法,不是消重`,
    ).not.toBe(quote(next));
  });

  it("反空转:「最近归来」格仍要回答「有没有人在路上」", () => {
    const src = readSource(VIEW);
    // countdown 那一处(它在 nextReturn 里)仍要给「无人在途」
    expect(src, "最近归来格要保留「无人在途」这个答案").toContain('countdown: "无人在途"');
  });
});
