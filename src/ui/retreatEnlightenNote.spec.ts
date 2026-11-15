/**
 * 闭关卡要把「出关时可能有悟」说出来 —— 只在手册里写等于没写
 *
 * ## 由来
 *
 * 第 365 轮给闭关补了第二个顿悟入口（出关时 35% × 境界存在感）。
 * 而它**只在手册里写了**:
 *
 * ```text
 * docs/usage.md:  「闭关出关时可能有所悟」……
 * 界面:            一个字都没有
 * ```
 *
 * 这正是本仓 AGENTS.md 里那条「让看不见的机制可见」要管的事:
 *
 * > 技艺进度、buff 叠加份数、合并真值、一次服药的上限、天时对渡劫与产出的影响
 * > —— 该露的都要露进界面，不许只活在注释或 README 里。
 *
 * ## 为什么这件事值得露
 *
 * 它改变的是**什么时候闭关**这个决策，而不只是"多一份奖励":
 *
 * ```text
 *   玩家不知道有顿悟   闭关 = 什么时候缺修为什么时候点
 *   玩家知道有顿悟   闭关 = 一个可能带回来点什么的选择（尤其前期 35%）
 * ```
 *
 * 而「闭关」与「历练」本来就是互斥的两条路（闭关期间不能外出历练），
 * 故这个认知差直接影响他今天做什么。
 *
 * ## 判据守什么
 *
 * 一 闭关卡上说得出**概率那件事**（不是"可能有所悟"这种定性话——
 *    AGENTS.md 另一条:不能只给定性形容词）;
 * 二 概率取自 `retreatEnlightenChance` 现算，不在这里手抄一个 35%;
 * 三 到了不会再出的境界，这一句**自动消失** —— 否则元婴之后的玩家
 *    会一直看到一条永远不会发生的承诺（那比不说更糟）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { retreatEnlightenChance } from "@/core/earlyGameService";
import { EARLY_EVENT_DECAY } from "@/data/earlyGame";

const CARD = readSource("src/components/cultivation/RetreatCard.vue");

describe("闭关卡 · 出关时可能有悟", () => {
  it("卡上接了那个概率 —— 不是只写在手册里", () => {
    expect(CARD, "闭关卡没有引用 retreatEnlightenChance —— 顿悟只活在手册里").toContain(
      "retreatEnlightenChance",
    );
  });

  it("概率是现算的，不是手抄的 35%", () => {
    /*
     * 与 `RetreatCard` 里那条「数值唯一来源 = buffs.ts」同一条纪律:
     * 手抄一个数，改常数那天文案就开始撒谎。
     */
    const pct = retreatEnlightenChance(0);
    /*
     * 只看**代码与模板**，不看注释 —— 注释里写「前期 35%」是在说明来历，
     * 那是应该留的记录（第一版判据扫全文，把它自己的解释也判成了违规）。
     */
    const code = CARD.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(
      /(?:^|[^\d.])35\s*%/.test(code) || /0\.35(?!\d)/.test(code),
      "闭关卡的代码里写死了 35% —— 该读 retreatEnlightenChance",
    ).toBe(false);
    expect(pct, "第 0 境概率是 0 —— 那这一行永远不会出，判据也就失去对象").toBeGreaterThan(0);
  });

  it("不会再出的境界上，那一句必须消失 —— 不许留一条永不发生的承诺", () => {
    /*
     * `EARLY_EVENT_DECAY.enlightenment` 到元婴之后归零。那一境之后卡片若仍写
     * 「闭完有 35% 概率有所悟」，玩家会照着它反复闭关，而一次也不会中。
     *
     * 判据:源码里那一行必须带 `v-if` 且条件用到算出来的概率。
     */
    expect(CARD, "那一行没有 v-if 守着 —— 元婴之后会成一句空头承诺").toMatch(
      /v-if="[^"]*retreatEnlighten[^"]*"/,
    );
    const decay = EARLY_EVENT_DECAY.enlightenment;
    expect(decay.later, "衰减表的后段不为 0 —— 「之后不再有」这件事不成立").toBe(0);
  });

  it("说得出具体数字，不是「可能有所悟」这种定性话", () => {
    /*
     * AGENTS.md:「给决策前把数字摊开……不能只给定性形容词」。
     * 「可能有所悟」正是那种不算数的话。
     */
    expect(CARD, "那一行没有把概率印出来").toMatch(/retreatEnlightenPct|retreatEnlightenChance/);
  });
});
