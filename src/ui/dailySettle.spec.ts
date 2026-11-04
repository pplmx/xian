/**
 * 日课结契 —— 今日功课全清的那一刻,该有一笔收束。
 *
 * ## 现状
 *
 * 首页「今日日课」那张卡做得很细:进度环、逐笔进度、奖励同格摊开、完成态划线。
 * 但**全清那一刻**只有两处变化:
 *
 *   标题从「今日从头开账 / 还差几笔」换成「今日功课已结」
 *   正文换成「该收的都收了,可安心挂机。」
 *   卡片多一个 `is-complete` 类
 *
 * 三处都是静态的。玩家做完全部日课,屏幕上没有发生任何**事件** —— 只有字换了。
 *
 * ## 为什么这一处值得一笔收束
 *
 * 日课是玩家**每天**都会经历一次的那条路径,也是放置游戏里最容易被忽略的节拍:
 * 它重复、可预期、做完就过去了。而「重复的事被郑重对待一次」正是仪式感的来源 ——
 * 不是靠特效堆,是靠**世界承认你做完了**。
 *
 * 中文修仙语汇里,对应的词是「契」:日课与天时有约,做完了便是**结契**。
 * 比「完成」「达成」这类系统词更贴这本书的口吻(与道记、器铭同一路)。
 *
 * ## 做什么
 *
 *   一 一枚印 —— 全清时在卡上落一枚「结契」小印,用**朱砂**(行动色,与
 *      「这是你做成的一件事」相称),并按现有的 `rise-in` 动效落下去;
 *   二 一句落款 —— 印下写「日课已结 · 第 N 日」,把「今天」这件事记成一天。
 *
 * ## 不做的事
 *
 * 不弹窗、不挡住首页。日课全清是一个**安静的成就**,值得被看见,不值得被打断 ——
 * 玩家此刻要做的下一件事可能是去历练,不是看一屏庆祝。
 *
 * 也不发奖:奖励在逐笔完成时已经入账(见 dailyRows 的 reward)。
 * 这一笔收束只承认事实,不额外给东西 —— 给了就变成第二本账。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("日课结契 · 落款怎么算", () => {
  it("落款四个字,与这本书的口吻一致", async () => {
    const { dailySettleSeal } = await import("@/ui/dailySettle");
    const text = dailySettleSeal();
    expect(text).toContain("日课");
    expect(text).toContain("结");
  });

  it("不说数字 —— 日课没有编号这回事,编一个就是假的", async () => {
    /*
     * 本作没有累计天数的账(日课按天重置,不编号)。若落款写「第 N 日」,
     * 那个 N 要么是编的,要么得从别处借一个与本意无关的数。
     * 故落款只承认"今天这一期结了",不编号。
     */
    const { dailySettleSeal } = await import("@/ui/dailySettle");
    expect(dailySettleSeal()).not.toMatch(/\d/);
  });
});

describe("日课结契 · 真接线", () => {
  it("首页有一枚印,且有稳定落点", () => {
    const home = readSource("src/views/HomeView.vue");
    expect(home, "要有那枚印").toContain("data-home-seal-settled");
    expect(home, "落款要读共享函数").toContain("dailySettleSeal(");
  });

  it("不另写一份「全清」判定 —— 首页那条 dailyAllDone 已经对了", () => {
    /*
     * 首页已有的 `dailyAllDone`(长度 > 0 且每笔 done)正是结契的条件,
     * 且已经处理了"没定义日课就不报"这条边界。再抽一个 isDailySettled 只是搬家,
     * 而搬家会带来第二处要同步维护的判定 —— 与本仓"不做两本账"相悖。
     */
    const home = readSource("src/views/HomeView.vue");
    expect(home, "该复用既有判定").toContain("dailyAllDone");
  });

  it("只做措辞与判定,不碰奖励", () => {
    const src = readSource("src/ui/dailySettle.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });
});
