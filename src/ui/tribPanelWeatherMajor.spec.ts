/**
 * 渡劫面板的天时取错了境界 —— 而它的注释声称「与结算同源」
 *
 * ## 这一条是第 358 轮那条线的尾巴
 *
 * 第 358 轮修过同一件事的另一半（`tribulationWeatherParity.spec`）:
 *
 * ```text
 *   预览 currentTribulationPlan   todayWeather(nextMajor)   ← 目标境
 *   结算 runTribulation           todayWeather(player.major) ← 当时写错，改成 targetMajor
 * ```
 *
 * 而 `TribulationPanel` 里那一行 **今天仍然写着 `todayWeather(player.major)`**，
 * 注释却写着「这里与主页天时卡同一口径（读 todayWeather，不另算），渡劫前一眼对上」——
 * 它确实与主页对上，但**没有与结算对上**，而那一屏存在的意义正是「渡劫前一眼对上」。
 *
 * ## 为什么会露馅、什么时候露馅
 *
 * `worldOf(major)` 按界域分池，故只有**跨界那三处**（8 / 13 / 17）两处取到不同池子:
 *
 * ```text
 *   m13→14   按「紫气东来」(仙池) = heavyrush
 *            按「神威日」(神池)   = ironbody     ← 两个不同的劫
 *   m17→18   按「神辉」(神池)     = thunder
 *            按「本源涌动」(混沌) = soulrend     ← 同样不同
 * ```
 *
 * 也就是说:在**一世只有三次**的大跃升前，那一屏的劫名与真正会渡的那一劫**不是同一个**。
 * 而那三次恰好是玩家最在意、最会反复看那一屏的三次。
 *
 * ## 判据守什么
 *
 * 一 面板取天时用的境界，与 `runTribulation` 用的**是同一个**（静态断言，
 *    与 `tribulationWeatherParity.spec` 同一条纪律）;
 * 二 那个境界是 `tribTargetMajor`（面板里本来就有这个 computed，只是没被这一行读）;
 * 三 跨界三点上两种取法**真的会给出不同劫型** —— 这一条是反证:若哪天两池合并了，
 *    这条会红，提醒这个判据失去了对象（那时它也就不必再守）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { tribulationKindFor } from "@/core/tribulationDecision";

const PANEL = readSource("src/components/cultivation/TribulationPanel.vue");
const BREAKTHROUGH = readSource("src/core/breakthrough.ts");

describe("渡劫面板 · 天时取的境界", () => {
  it("面板不按 player.major 取天时 —— 那是旧界的池子", () => {
    expect(
      PANEL,
      "渡劫面板仍用 todayWeather(player.major) —— 跨界三点（8/13/17）会取到旧界的池子",
    ).not.toMatch(/todayWeather\(\s*player\.major\s*\)/);
  });

  it("面板按 tribTargetMajor 取 —— 与结算同一个境界", () => {
    expect(PANEL, "面板没有按 tribTargetMajor 取天时").toMatch(
      /todayWeather\(\s*tribTargetMajor\.value\s*\)/,
    );
  });

  it("结算确实按 targetMajor 取 —— 两处指向同一个值", () => {
    // 与 tribulationWeatherParity.spec 的第三条同源，这里再钉一次是因为面板刚改
    expect(BREAKTHROUGH, "结算没有按 targetMajor 取天时").toMatch(
      /todayWeather\(\s*targetMajor\s*\)/,
    );
    /*
     * 面板的 `tribTargetMajor` 现在**从 core 取**（第 371 轮把那个三目收成
     * `tribulationTargetMajor` 一处）。
     *
     * 这条判据原本钉的是内联三目的字面写法 —— 那在第 371 轮之后成了**反面**:
     * 内联反而更糟（四处各写一遍，正是第 370 轮那个 bug 的成因）。
     * 故改成钉「它来自 core 那一个」。
     */
    expect(PANEL, "tribTargetMajor 不再从 core 取 —— 它自己那份就是第二个来源").toMatch(
      /tribTargetMajor\s*=\s*computed\(\(\)\s*=>\s*tribulationTargetMajor\(player\)/,
    );
  });

  it("tribTargetMajor 声明在 tribWeather 之前 —— 反过来会留一条脆弱依赖", () => {
    /*
     * computed 是惰性的，写反了运行时也能跑 —— 但那不是"没问题"，是**没被触发**。
     * 哪天有人给它加 `immediate`、或把它搬进 `effectScope` 先求值一次，
     * 就会当场撞上 TDZ。声明顺序是这类脆弱的唯一防线。
     */
    const targetAt = PANEL.indexOf("const tribTargetMajor = computed");
    const weatherAt = PANEL.indexOf("const tribWeather = computed");
    expect(targetAt, "找不到 tribTargetMajor 的定义").toBeGreaterThan(-1);
    expect(weatherAt, "找不到 tribWeather 的定义").toBeGreaterThan(-1);
    expect(
      targetAt,
      "tribWeather 声明在 tribTargetMajor 之前 —— 现在能跑只是因为 computed 惰性",
    ).toBeLessThan(weatherAt);
  });

  it("跨界三点上两种取法真的会给出不同劫型 —— 这条判据没有失去对象", () => {
    /*
     * 反证。若哪天四个界域合并成一个池子，这个 bug 就无从发生，
     * 那时这条会红 —— 提醒把上面三条一起销账，而不是留一堆守空气的断言。
     */
    const boundaries: [number, string, string][] = [
      [13, "ziqi", "shenwei"],
      [17, "shenhui", "benyuan"],
    ];
    let differs = 0;
    for (const [major, oldPool, newPool] of boundaries) {
      if (tribulationKindFor(major + 1, oldPool) !== tribulationKindFor(major + 1, newPool)) {
        differs += 1;
      }
    }
    expect(
      differs,
      "跨界三点上两池给出的劫型全都一样 —— 那道分叉已经不存在，这组判据该销账了",
    ).toBeGreaterThan(0);
  });
});
