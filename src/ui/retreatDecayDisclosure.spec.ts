/**
 * 「出关时约 35% 携带顿悟」—— 而它会随境界衰减，界面上没说
 *
 * ## 量出来的
 *
 * 第 366 轮给闭关加了出关顿悟，概率取 `RETREAT_ENLIGHTEN_CHANCE × EARLY_EVENT_DECAY`。
 * 那一轮判据钉了「概率现算、不手抄 35%」，钉得对 —— 但没钉**它会不会变**。
 *
 * ```text
 *   炼气 m0   35.0%
 *   筑基 m1   24.5%
 *   金丹 m2   12.2%
 *   元婴 m3    3.5%
 *   化神 m4+   0        ← 这一行整个消失
 * ```
 *
 * 而一世里能撞见几次闭关顿悟，量下来是 **6.1 次**，全部落在前四境（前 6 小时）。
 * 之后一千多个小时里，玩家闭关多少次都不会再有。
 *
 * ## 为什么这是问题（而不是"设计如此"）
 *
 * 衰减本身是**有意的设计**（`EARLY_EVENT_DECAY` 的文件头写着「顿悟是前期玩法，
 * 境界越高存在感越低，真仙后完全退出」）。问题在于**界面上那句话**:
 *
 * ```text
 *   出关时约 35% 携带顿悟(与历练偶遇同一套选项)
 * ```
 *
 * 一个新手读到它，会理解成"我闭关就有三分之一机会有所悟"。四小时后他升到金丹，
 * 那句话悄悄变成「约 12%」；再升一境，变成「约 4%」；再往上，那句话**消失**了。
 *
 * 没有任何地方告诉他这个数会变。**那不是一个数字错了，是那句话在承诺一件不会持续的事。**
 *
 * 本仓 `AGENTS.md` 对这类事的口径很明确:
 *
 * > **决策信息完整**：给决策前把数字摊开……不能只给定性形容词。
 *
 * 反过来说，摊开的数字**漏掉了它自身的适用范围**，同样是不完整 ——
 * 而且是更难发现的一种:数字本身在每一刻都是对的。
 *
 * ## 判据守什么
 *
 * 一 那句话说明它是**前期**的（或说明会随境界递减），而不是把当前值当成永久值;
 * 二 措辞与真实曲线对得上 —— `EARLY_EVENT_DECAY` 在元婴之后归零，故「前期」这个词是对的;
 * 三 不许写成"越往后越难"这种没有依据的模糊话（那只是把诚实换成了含糊）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { EARLY_EVENT_DECAY } from "@/data/earlyGame";
import { retreatEnlightenChance } from "@/core/earlyGameService";

const RAW = readSource("src/components/cultivation/RetreatCard.vue");

/**
 * 抹掉注释再判 —— 第一版判据在 `RAW` 上跑，而它命中的那句「前期 35%」是我写
 * 在**注释**里的设计说明。注释里说了、界面上没说，正是这条判据该抓的东西，
 * 却被自己的注释骗成了绿。
 */
const CARD = RAW.replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("闭关顿悟 · 概率会随境界衰减，界面要说清", () => {
  it("那句话不是把当前值当成永久值", () => {
    /*
     * 判据不钉具体措辞，钉"这句话里有衰减的意思"。
     * 允许的写法:「出关时约 X% 携带顿悟（前期才有，境界越高越少）」之类。
     */
    const hasDecayNote = /前期|境界越高|越往后越少|仅前期/.test(CARD);
    expect(hasDecayNote, "闭关卡只报当前概率、没说它会随境界降到 0 —— 玩家会把它当成永久概率").toBe(
      true,
    );
  });

  it("「前期」这个说法与真实曲线对得上 —— 它在元婴之后归零", () => {
    /*
     * 若哪天衰减曲线被改成"全程都有"，这句「前期」就成了新的谎话。
     * 故把两件事钉在一起:曲线到 m4 归零，而文案说「前期」。
     */
    const decay = EARLY_EVENT_DECAY.enlightenment;
    expect(decay.yuanying, "元婴档不再是 0.1 —— 那「前期」这个说法要重新想").toBe(0.1);
    expect(decay.later, "界外不再归零 —— 那「前期」就成了假话").toBe(0);

    // 曲线的形状:单调下降，且到 m4 已经是 0
    expect(retreatEnlightenChance(0)).toBeGreaterThan(retreatEnlightenChance(1));
    expect(retreatEnlightenChance(1)).toBeGreaterThan(retreatEnlightenChance(2));
    expect(retreatEnlightenChance(4), "元婴之后仍有概率").toBe(0);
  });

  it("不许用含糊话替代数字 —— 概率本身仍要报出来", () => {
    /*
     * 修法不能是"把 35% 删掉、只说前期有"。数字必须留着 ——
     * 玩家要靠它判断"现在闭关划不划算"。
     */
    expect(CARD, "概率被删掉了 —— 那是把诚实换成了含糊").toContain("formatPercent");
    expect(CARD, "没有渲染概率的那一行").toContain("retreatEnlightenRate");
  });
});
