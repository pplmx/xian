/**
 * 「等一天值不值」—— 上一轮那一行只报了劫名,却没答这个问题
 *
 * ## 上一轮留下的洞
 *
 * 第 358 轮补的那一行长这样:
 *
 * ```text
 * 此劫随天时变 · 今日「裂魂」，此后还会遇「重压」、「雷鸣」、「铁躯」
 * ```
 *
 * 它说清了「答案每天会变」,但**没有说变好还是变坏**,也没说变了多少。
 * 而本仓 AGENTS.md 的一条硬约定是:
 *
 * > 给决策前把数字摊开（奖励、代价、把握、生效时长、成功率），
 * > 不能只给定性形容词（「皆有裨益」「更容易」不算数）。
 *
 * 「此后还会遇「重压」」正是那种不算数的定性话 —— 玩家读完仍然不知道该等还是该现在渡。
 *
 * ## 量出来的实情:对大多数玩家,等一天**没有意义**
 *
 * 决策档以「全程最低水位」定,而天时只把它乘上 0.92~1.12。实测(裸身到中量抗性、
 * 第 1~8 境):
 *
 * ```text
 * m1 裸身      20 天里档位恒为「高风险」       把握 33~39%
 * m3 裸身      20 天里档位恒为「高风险」       把握 29~33%
 * m8 裸身      20 天里档位恒为「高风险」       把握 27~29%
 * ```
 *
 * 也就是说:那一行把「雷鸣 / 铁躯 / 重压」摆出来,读起来像"三选一",
 * 而实际上**选哪个都掉在同一档里**。玩家会为了一个不存在的好处去等。
 *
 * 但也有真会有差别的时候 —— 抗性堆到某一档之后,同一天时池里能跨 2~3 档:
 *
 * ```text
 * m3 中量抗性  档位 [可渡 / 高风险 / 中等]   把握 40~65%
 * m5 重度抗性  档位 [稳渡 / 可渡]             把握 80~95%
 * ```
 *
 * 故这一行该报的不是「还有哪几种劫」,而是**「等下去最好的那一天能好多少」**:
 *
 * ```text
 *   等下去没差别   → 说「至多 X%，今日便可一试」       (劝你别等)
 *   等下去有差别   → 说「等 N 天可到「稳渡」(X%)」    (给出值与代价)
 * ```
 *
 * ## 判据守什么
 *
 * 一 同一个玩家、同一关,不同天时给出的档位与把握**必须真的被算出来**,
 *    而不是把劫名换个说法;
 * 二 「等下去最好的一天」与「届时真去渡劫」是同一个数（不做两本账）——
 *    这条最要紧:若预览自己另算一遍,它迟早与结算分叉;
 * 三 最好的那天若与今天同档,**不许**怂恿等待（那是最坏的一种假建议:
 *    玩家听了之后白等一天,而没有任何收益）。
 */
import { describe, expect, it } from "vite-plus/test";
import { bestDayToBreakThrough } from "./heavenInsightPreview";
import {
  buildTribulationPlan,
  tribulationKindFor,
  verdictLabel,
  NO_STAT_GUARD,
} from "@/core/tribulationDecision";
import { WEATHERS, WORLD_WEATHERS, weatherDef } from "@/core/weather";
import { NO_RELIEF } from "@/data/linggenAffinity";
import type { StatMods } from "@/types";

/** 渡劫向词条堆到「中量」—— 这个档位实测能跨 2~3 个决策档,是本判据需要的样本 */
const INVESTED: StatMods = {
  tribulationResist: 0.3,
  damageReduction: 0.2,
  shieldOnStart: 0.15,
};

/** 裸身 —— 实测每天同档,用来钉「不许怂恿无意义的等待」 */
const BARE: StatMods = {};

describe("等一天值不值 · 那一行要给出数", () => {
  it("报得出今天与最好那一天各自的把握,且与 buildTribulationPlan 同源", () => {
    /*
     * 这条是地基。`bestDayToBreakThrough` 内部若自己再推一遍天劫数学,
     * 它迟早与结算分叉 —— 故它必须走 `buildTribulationPlan`,
     * 而这里用同一个函数反查作为期望值。
     */
    const res = bestDayToBreakThrough(3, INVESTED, NO_RELIEF, "lingyu", [
      "leiming",
      "chiyang",
      "qinghe",
      "gangfeng",
    ]);
    expect(res, "拿不到「等下去值不值」的读数").toBeTruthy();

    // 今日那一格:与直接用同一个函数算出来的必须一致
    const todayPlan = buildTribulationPlan(
      3,
      INVESTED,
      tribulationKindFor(3, "lingyu"),
      NO_RELIEF,
      weatherDef("lingyu")!.tribulationMult,
      NO_STAT_GUARD,
    );
    expect(res!.todayRate, "今日把握与 buildTribulationPlan 对不上").toBeCloseTo(
      todayPlan.expectedRate,
      9,
    );
    expect(res!.todayVerdict, "今日档位对不上").toBe(verdictLabel(todayPlan.verdict));

    // 未来每一天:给出的把握必须是那一天真会算出的数
    for (const cand of res!.days) {
      const plan = buildTribulationPlan(
        3,
        INVESTED,
        tribulationKindFor(3, cand.weatherId),
        NO_RELIEF,
        weatherDef(cand.weatherId)!.tribulationMult,
        NO_STAT_GUARD,
      );
      expect(cand.rate, `「${cand.weatherId}」那天的把握与结算对不上`).toBeCloseTo(
        plan.expectedRate,
        9,
      );
      expect(cand.verdict, `「${cand.weatherId}」那天的档位与结算对不上`).toBe(
        verdictLabel(plan.verdict),
      );
    }
  });

  it("最好的那一天,确实是不早于今天里把握最高的那一天", () => {
    const future = ["leiming", "chiyang", "qinghe", "gangfeng", "yueshi"];
    const res = bestDayToBreakThrough(3, INVESTED, NO_RELIEF, "lingyu", future)!;
    const best = res.days.reduce((a, b) => (b.rate > a.rate ? b : a));
    expect(res.bestRate, "报的「最好」不是真的最好").toBeCloseTo(best.rate, 9);
    expect(res.bestDay).toBe(best.day);
    // 最好那一天不会比今天更差 —— 它至少可以"就是今天"
    expect(res.bestRate).toBeGreaterThanOrEqual(res.todayRate - 1e-9);
  });

  it("等下去没有差别时,不许怂恿等待", () => {
    /*
     * 裸身玩家实测 20 天里档位恒为「高风险」、把握只差 3~6pp。
     * 这时那一行若写「等 N 天可到某档」,就是**假建议**:玩家白等,
     * 而档位一档都不动。
     *
     * 判据:收益小到不改变档位时,`worthWaiting` 必须是 false。
     * 阈值取「是否跨档」而不是「是否涨了一点」—— 跨档才是玩家读得懂的变化,
     * 3pp 的涨落在界面上表现为同一个「高风险」,说它"更好"就是骗人。
     */
    const res = bestDayToBreakThrough(3, BARE, NO_RELIEF, "lingyu", [
      "leiming",
      "chiyang",
      "qinghe",
      "gangfeng",
      "yueshi",
    ])!;
    if (res.bestVerdict === res.todayVerdict) {
      expect(
        res.worthWaiting,
        `档位没变(都是「${res.todayVerdict}」)却建议等待 —— 玩家会白等一天`,
      ).toBe(false);
    }
  });

  it("等下去真能跨档时,报出那一天与那一档", () => {
    /*
     * 抗性堆到中量之后实测能跨档。这一条钉的是反方向:
     * 真有好处时**必须**说出来,否则这一行就只剩「别等」一种输出,
     * 等于把决策砍掉一半。
     */
    const res = bestDayToBreakThrough(3, INVESTED, NO_RELIEF, "lingyu", [
      "leiming",
      "chiyang",
      "qinghe",
      "gangfeng",
      "yueshi",
      "ningshuang",
      "xiaguang",
      "tianlang",
    ])!;
    if (res.bestVerdict !== res.todayVerdict) {
      expect(res.worthWaiting, "档位真的变了却说不值得等").toBe(true);
      expect(res.bestDay, "说值得等却没说是第几天").toBeGreaterThan(0);
    }
  });

  it("「再等 N 天」里的 N 是**望出去的天数**,不是被算过的天数", () => {
    /*
     * 与今天同天时的那几天被跳过了（结果必然相同,不必重算）,于是 `days` 会比
     * 视野短。若那一行用 `days.length` 报 N,「再等 2 天」说的其实是一个
     * 只看了 3 天的视野 —— 玩家会以为自己望得更远,或者更近。
     *
     * 这里钉住:horizonDays = 今天 + 调用方给的未来天数,与去重无关。
     */
    const future = ["leiming", "lingyu", "qinghe"]; // 中间那条与"今天"同天时
    const res = bestDayToBreakThrough(3, INVESTED, NO_RELIEF, "lingyu", future)!;
    expect(res.horizonDays, "望出去的天数少了 —— 与今天同天时的那天被漏掉了").toBe(
      1 + future.length,
    );
    // `days` 因为去重会比 horizon 短,这是设计,不是错
    expect(res.days.length).toBeLessThanOrEqual(res.horizonDays);
  });

  it("边界:没有未来 / 坏境界 → null,不编一行空话", () => {
    expect(bestDayToBreakThrough(3, BARE, NO_RELIEF, "lingyu", [])).toBeNull();
    expect(bestDayToBreakThrough(Number.NaN, BARE, NO_RELIEF, "lingyu", ["leiming"])).toBeNull();
  });

  it("天时池全覆盖:每一条天时都算得出,不会因某条天时缺定义而抛错", () => {
    for (const w of [...WEATHERS, ...Object.values(WORLD_WEATHERS).flat()]) {
      expect(
        () => bestDayToBreakThrough(4, INVESTED, NO_RELIEF, w.id, [w.id]),
        `天时「${w.name}」算「等下去值不值」时抛错`,
      ).not.toThrow();
    }
  });
});
