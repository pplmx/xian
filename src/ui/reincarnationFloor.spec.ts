/**
 * 来世根骨 · 说得出「这副牌是垫着地板掷出来的」
 *
 * ## 缺口:一个跨世复利资产,玩家手上一次都没看见过
 *
 * 转世的永久收益里有两条自动通道(见 `core/compoundingAudit`):道果与**资质地板**。
 * 前者的账在弹窗里摊得很开(今生凝得 / 落账后共有 / 跨世用途),后者一次都没露过面。
 *
 * `aptitudeFloorNow()` = max(次数 × 5, 宿慧 / 12) —— 它把 `rollLinggen` 掷出的
 * 每一根资质整体抬高(`aptitude = min(100, rng.int(40,100) + floor)`)。也就是说,
 * 玩家在「来世根骨」那一格里看到的 `水 63 木 44`,**已经是抬过的数**;
 * 而抬它的那一份是谁、抬了多少,弹窗里一个字都没有。
 *
 * 后果有两层:
 *
 *  一 **看不懂**。转世三次的人看到的资质总是偏高,但系统里没有一处告诉他「这是因为
 *     前三世攒了东西」—— 那两条自动通道里,道果有账,地板没账。
 *  二 **不知该不该在意**。弹窗只报结果不报来源,玩家没法判断「再多攒一世值不值」:
 *     地板何时顶满(资质硬封顶 100)、离顶还差多少,全靠猜。
 *
 * ## 这一层只算,不读 store
 *
 * 「这份地板从哪来、离顶还差几步」是纯算术:`max(次数 × 5, 宿慧 / 12)` 与
 * `INSIGHT_PER_APTITUDE` / `REINCARNATE_APTITUDE_FLOOR` 两个常数、`APTITUDE_CAP` 一个上限。
 * 故收在这里做成纯函数,view 只递参 —— 与 `ui/legacyDesk` 的 `legacyMeter` 同一条纪律。
 * 数值一律读常数,不手抄(改常数时文案跟着变)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { aptitudeFloorBrief } from "./reincarnationDesk";
import { INSIGHT_PER_APTITUDE } from "@/data/samsara";
import { REINCARNATE_APTITUDE_FLOOR } from "@/data/constants";

/** 资质硬封顶:rollLinggen 里每一根都 `Math.min(100, …)` */
const CAP = 100;

describe("来世根骨 · 资质地板读得出", () => {
  it("两条口径取较大者:次数保底与宿慧折算各算一遍", () => {
    // 第 1 世转生(count=0):次数口径 = 5 × 1 = 5;宿慧 0 → 0,取 5
    expect(aptitudeFloorBrief({ lives: 0, insight: 0 }).floor).toBe(REINCARNATE_APTITUDE_FLOOR);
    // 次数口径:count=3 → 4 世 × 5 = 20
    expect(aptitudeFloorBrief({ lives: 3, insight: 0 }).floor).toBe(REINCARNATE_APTITUDE_FLOOR * 4);
    // 宿慧口径反超:宿慧 240 → 240 / 12 = 20,与 count=3 打平
    expect(aptitudeFloorBrief({ lives: 3, insight: 240 }).floor).toBe(20);
    // 再多一点就由宿慧当家
    const byInsight = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 40 });
    expect(byInsight.floor).toBe(40);
    expect(byInsight.source, "宿慧口径反超时应当说是宿慧在顶").toBe("insight");
  });

  it("来源说得出是哪一条在顶 —— 两条口径不许混成一句「更高」", () => {
    expect(aptitudeFloorBrief({ lives: 0, insight: 0 }).source).toBe("count");
    expect(aptitudeFloorBrief({ lives: 3, insight: 0 }).source).toBe("count");
    expect(aptitudeFloorBrief({ lives: 0, insight: 480 }).source).toBe("insight");
  });

  it("离封顶还差几步 —— 资质硬封顶 100,到了就说到了", () => {
    const low = aptitudeFloorBrief({ lives: 0, insight: 0 });
    expect(low.cap).toBe(CAP);
    expect(low.toCap).toBe(CAP - REINCARNATE_APTITUDE_FLOOR);
    expect(low.capped).toBe(false);

    // 地板 95:再涨 5 就顶满
    const near = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 95 });
    expect(near.floor).toBe(95);
    expect(near.toCap).toBe(5);
    expect(near.capped).toBe(false);

    // 地板 ≥ 100:任何一次 roll 都顶满
    const max = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 130 });
    expect(max.floor).toBe(130);
    expect(max.toCap).toBe(0);
    expect(max.capped, "地板越过封顶时该说「已顶」").toBe(true);
  });

  it("坏值一律归零 —— 存档里读出来的东西不许把界面变成 NaN", () => {
    /*
     * 断言的是**精确值**而不是「≥ 0」:恒真的形状不是判据(见 tautologyGuard)。
     * 坏值走 nonNegInt 归零之后,地板就是「0 次转世 + 0 宿慧」那一档 —— 5。
     * 三种坏法各走一条分支,必须落在同一个数上,这才说明归一化真的做到了。
     */
    const zero = aptitudeFloorBrief({ lives: 0, insight: 0 });
    for (const bad of [
      { lives: Number.NaN, insight: Number.NaN },
      { lives: -5, insight: -100 },
      { lives: Number.POSITIVE_INFINITY, insight: 0 },
      { lives: 0, insight: Number.NEGATIVE_INFINITY },
    ]) {
      const brief = aptitudeFloorBrief(bad);
      expect(Number.isFinite(brief.floor), `坏输入 ${JSON.stringify(bad)} 算出了非有限值`).toBe(
        true,
      );
      expect(brief, `坏输入 ${JSON.stringify(bad)} 没有被归零`).toEqual(zero);
    }
  });

  it("再攒多少宿慧能抬一格 —— 这是玩家真正要判断的那个数", () => {
    /*
     * 「再多攒一世值不值」取决于两件事:按宿慧口径离下一格还差多少、按次数口径
     * 下一世会自动涨多少。次数那一半是常数(每世 +5),宿慧那一半 = 距下一整格的余量。
     */
    const brief = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 40 + 3 });
    expect(brief.floor).toBe(40);
    expect(brief.insightToNext).toBe(INSIGHT_PER_APTITUDE - 3);
    // 恰好整除时,下一格还差满一整格
    const exact = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 40 });
    expect(exact.insightToNext).toBe(INSIGHT_PER_APTITUDE);
  });
});

describe("来世根骨 · 地板真的接进了弹窗", () => {
  it("择生那一程把地板印出来,且读的是同一份算法", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(dlg, "弹窗要读地板简报").toContain("aptitudeFloorBrief(");
    expect(dlg, "要有稳定落点").toContain("data-reincarnation-floor");
    /*
     * 反空转:地板那一格必须真的印出「地板」两个字 —— 只挂一个 data 属性、
     * 界面上什么都不显示,判据照样绿。
     */
    expect(dlg).toMatch(/资质地板|地板/);
  });

  it("不读 store —— 与 legacyDesk 的 legacyMeter 同一条纪律", () => {
    const src = readSource("src/ui/reincarnationDesk.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // reincarnationDesk 已 import 了 samsaraAudit(它是数据表,不是 store)——
    // 这条只禁止新加的简报函数自己去读状态
    expect(src).not.toMatch(/from ["']@\/stores\//);
  });
});

describe("资质地板 · 到顶之后不许再说「再攒能抬」", () => {
  /*
   * 真浏览器截图查出来的：转过三世、宿慧 420 时地板是 36，而灵根掷出来
   * 三根全是 100 —— 因为 `Math.min(100, rng.int(40,100) + 36)` 几乎必顶。
   * 那一刻弹窗第三行还写着「再攒 1 宿慧 / 资质地板抬一格」：
   * 地板确实会涨（36 → 37），但**掷出来的资质不会变**，因为已经顶死在上限。
   *
   * 这不是四舍五入，是**许诺了一个不会兑现的结果**。故简报要分得清两件事：
   *   · 地板还能不能涨        → insightToNext
   *   · 涨了之后掷点会不会变   → 只有在地板离上限还有余量时才可能
   * 地板到顶之后，「再攒宿慧」这一行整条不该出现。
   */
  it("地板到顶时 brief 明说「再攒也不再抬」", () => {
    const atCap = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 100 });
    expect(atCap.floor).toBe(100);
    expect(atCap.capped).toBe(true);
    expect(atCap.raisesRoll, "地板到顶了还说再攒能抬 —— 掷点早就被 min(100) 顶死").toBe(false);
  });

  it("地板没到顶时说「还能抬」，且离顶越近越接近", () => {
    const below = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 36 });
    expect(below.capped).toBe(false);
    expect(below.raisesRoll).toBe(true);
    expect(below.toCap).toBe(64);

    // 差一格也仍算「能抬」—— 掷点还有 1 点余量
    const last = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 99 });
    expect(last.toCap).toBe(1);
    expect(last.raisesRoll).toBe(true);
  });

  it("弹窗那一行跟着 brief 走 —— 到顶时不出「抬一格」", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    // 判据看的是「这一行由 raisesRoll 把关」,不是某一句具体措辞
    expect(dlg, "「再攒宿慧」那一行要由 raisesRoll 把关").toMatch(/v-if="floorBrief\.raisesRoll"/);
  });

  it("汉字与数字之间留一格 —— 与全作「第几世」「几岁」同一套写法", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    // 截图里曾经渲染成「再攒1 宿慧」:中文与数字黏在一起
    expect(dlg, "「再攒 N 宿慧」里数字两侧要留空格").toMatch(
      /再攒 \{\{ floorBrief\.insightToNext \}\}/,
    );
  });
});

describe("资质地板 · 说得出「这枚 99 有多少是攒出来的」", () => {
  /*
   * 真浏览器截图上的那一副：天灵根 · 火 99 —— 单根灵根、资质差一点满。
   * 面板上只有「+36 宿慧折算」，玩家没法回答「99 是我运气好，还是攒出来的」。
   *
   * 掷点是 `rng.int(40,100)` 的均匀分布（裸掷均值 70），地板把它整体平推上去。
   * 故简报给出两个期望值 —— 它们的差才是「攒宿慧换来了什么」。
   */
  it("裸掷期望是 70，(40..100) 闭区间均匀分布", () => {
    const brief = aptitudeFloorBrief({ lives: 0, insight: 0 });
    expect(brief.expected.bare).toBe(70);
  });

  it("垫上地板后期望被抬起来，且不越过上限", () => {
    const brief = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 36 });
    expect(brief.floor).toBe(36);
    // min(100, x + 36) 在 40..100 上的均值实测 95.1
    expect(brief.expected.withFloor).toBeGreaterThan(90);
    expect(brief.expected.withFloor).toBeLessThanOrEqual(100);
    expect(brief.expected.withFloor, "垫了地板反而不如裸掷 —— 算法写反了").toBeGreaterThan(
      brief.expected.bare,
    );
  });

  it("地板到顶时两个期望一起封在 100 —— 差值为 0，与 raisesRoll 说的是同一件事", () => {
    const brief = aptitudeFloorBrief({ lives: 0, insight: INSIGHT_PER_APTITUDE * 130 });
    expect(brief.expected.withFloor).toBe(100);
    expect(brief.raisesRoll).toBe(false);
  });

  it("弹窗把两个期望印出来 —— 不只报地板值", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(dlg, "要报「不垫地板大概几分」").toContain("floorBrief.expected.bare");
    expect(dlg, "要报「垫了之后大概几分」").toContain("floorBrief.expected.withFloor");
  });
});
