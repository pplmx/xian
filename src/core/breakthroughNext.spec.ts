/**
 * 突破失败之后 —— 「来日再战」说完,得说下一步做什么。
 *
 * ## 现状
 *
 * 失败弹窗目前只有一句带古意的安慰:
 *
 *   渡劫失利:「天威难测,此番渡劫失利。所幸道基未毁,来日再战。」
 *   普通失败:「灵气逆冲,功亏一篑。你吐出一口淤血,盘膝疗伤。」
 *
 * 两句都对,也都好。但它们**不说下一步**——而突破失败之后玩家的处境变了:
 *
 *   准备加成被消费掉了  `consumeBreakthroughPrep()` 在判定时取走,失败也不退
 *   受了伤              `cultivation.addBuff("injury")` 当场挂上
 *   修为掉了一截        `loseExpPct(BT_FAIL_EXP_LOSS × (1 − refund))`
 *
 * 玩家看着「来日再战」回到修行页,面对的是:修为变少了、身上带伤、准备加成没了。
 * 三件事同时发生,而弹窗一句都没提 —— 他很可能不知道**要再准备一次**才能回到
 * 失败前的成功率。
 *
 * ## 补什么
 *
 * 失败弹窗在安慰之后补一行「下一步」,而且必须**从结算里取**,不能手写:
 *
 *   本世是否还有免败次数(渡劫跬步)→ 有则说明「这一败未损修为」
 *   受伤 → 引气静养
 *   准备加成已被消费 → 回去再坐一次/再服一枚
 *
 * 这三条都有现成的判定,不需要新算一份账。判据要守的是:
 * **那一行在,且与「准备加成是空的了」这条事实一致**。
 *
 * ## 为什么不做成通用失败引导
 *
 * 别处的失败(炼丹炸炉、战斗落败)各有各的下一步,而且各自页面上已经写了。
 * 这一处之所以值得补,是因为**失败弹窗是全屏的、遮住了一切** ——
 * 玩家在这一屏看不到修行页上那些准备按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("突破失败之后 · 弹窗要说下一步", () => {
  it("失败那一支给了 nextStep,成功那一支不给", () => {
    const src = readSource("src/core/breakthrough.ts");
    const at = src.indexOf("  } else {\n    const mods = player.finalStats.mods;");
    expect(at, "失败分支要还在").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("showBreakthrough(view);", at));
    expect(block, "失败分支要给下一步").toContain("nextStep");
  });

  it("下一步从结算里取,不是手写的固定话术", () => {
    const src = readSource("src/core/breakthrough.ts");
    /*
     * 关键:准备加成在判定时已被 consumeBreakthroughPrep() 取走,失败也不退。
     * 故失败之后 `breakthroughPrepState().ready` 必然是 false —— 那一行要照这个说。
     * 若手写一句「再去准备一次」但实际还有加成,就是在撒谎。
     */
    expect(src, "要读准备状态").toContain("breakthroughPrepState()");
    // 受伤是真的挂上了,那一行要提到疗伤而不是笼统的"再来"
    expect(src, "失败会挂伤").toContain('addBuff("injury"');
  });

  it("三种处境各有各的说法,不是一句话打天下", () => {
    const src = readSource("src/core/breakthrough.ts");
    const at = src.indexOf("  } else {\n    const mods = player.finalStats.mods;");
    const block = src.slice(at, src.indexOf("showBreakthrough(view);", at));
    /*
     * 至少要在两个相互独立的条件上分支:是否渡劫、本世免败是否已用掉。
     * 单一分支说明它只是把安慰话换了个说法。
     */
    const branches = (block.match(/if\s*\(|needTribulation|dubu|\?/g) ?? []).length;
    expect(branches, "失败分支里至少要有两处独立判断").toBeGreaterThanOrEqual(2);
  });
});

describe("突破失败之后 · 类型与展示", () => {
  it("BreakthroughView 上那个字段是可选的 —— 成功时没有下一步", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface BreakthroughView");
    expect(at, "类型要还在").toBeGreaterThan(0);
    const block = types.slice(at, types.indexOf("}", at));
    expect(block, "要有 nextStep").toContain("nextStep");
    expect(block, "它该是可选的").toMatch(/nextStep\?:/);
  });

  it("弹窗把它摆出来,且有稳定落点供真浏览器复核", () => {
    const dlg = readSource("src/components/cultivation/BreakthroughResultDialog.vue");
    expect(dlg, "要渲染 nextStep").toContain("nextStep");
    expect(dlg, "要有落点").toContain("data-breakthrough-next");
  });
});
