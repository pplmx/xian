/**
 * 「今日渡劫 ×1.08」—— 这个倍率乘在什么上，没人说。
 *
 * ## 由来（第 164 轮）
 *
 * 首页天时那一行，雷鸣日会多出一枚朱砂小字:
 *
 * ```text
 * 今日渡劫 ×1.08
 * ```
 *
 * 倍率的来源是 `WeatherDef.tribulationMult`，而它真正乘的地方是
 * **每一道雷的伤害**:
 *
 * ```ts
 * // core/breakthrough 的 runTribulation
 * hpLeft = hpLeft - waveDamage(tDef, mods, targetMajor, w, hpLeft, relief, weatherMult, stat)
 * ```
 *
 * 也就是说 ×1.08 是「每一道雷多打 8%」。而屏上那六个字只给了乘数 ——
 * 玩家读不出它是「成功率降 8%」、「需要多扛一道」还是「伤害多 8%」。
 * 这三件事的对策完全不同（堆血量 / 攒材料 / 换个日子）。
 *
 * ## 为什么这不是苛求
 *
 * 同一条信息在**渡劫面板**里是摊开的 —— `TribulationPanel` 会报逐波推演、
 * 剩多少气血、够不够扛。而首页那一枚是玩家**在不看面板时**唯一能看到的提示，
 * 它却只给了一个没有单位的乘数。
 *
 * 本仓纪律：界面上出现的数字要能被读懂（「准确地让人看懂」而不只是「不撒谎」）。
 * `×1.08` 是一个**作用在伤害上的**系数，写成「雷伤 +8%」才是它。
 *
 * ## 判据
 *
 * ① 那一行要说清倍率作用在**什么**上（伤害 / 雷威），不是裸乘数；
 * ② 数字仍读 `tribulationMult`（改常数不撒谎）；
 * ③ 不为 1 时不出现（平日的天时不该多一行）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { WEATHERS } from "@/core/weather";

const HOME = readSource("src/views/HomeView.vue");

describe("首页天时 · 「今日渡劫 ×1.08」的单位", () => {
  it("倍率确实乘在每一道雷的伤害上（不是成功率）", () => {
    /*
     * 语义钉死:`tribulationMult` 进的是 `waveDamage` 的入参。
     * 若哪天它改去乘成功率，那行文案也得跟着改 —— 这条断言会提醒。
     */
    const src = readSource("src/core/breakthrough.ts");
    expect(src, "weatherMult 进的是 waveDamage").toMatch(/waveDamage\([^)]*weatherMult/);
    expect(src, "要把天时倍率读出来").toMatch(/todayWeather\([^)]*\)\.tribulationMult/);
    // 不是成功率:`attemptBreakthrough` 的小进阶骰子不吃这个乘数
    expect(src, "乘数不该混进小进阶成功率").not.toMatch(/rate\s*\*=\s*weatherMult/);
  });

  it("有雷的天时确实让渡劫更险（数据自洽）", () => {
    const leiming = WEATHERS.find((w) => w.id === "leiming")!;
    expect(leiming.tribulationMult, "雷鸣日该更险").toBeGreaterThan(1);
    // 平日的天时不该带这个倍率 —— 否则那一行会常驻
    const calm = WEATHERS.filter((w) => w.tribulationMult > 1);
    expect(calm.length, "只有少数天时该加险").toBeLessThan(WEATHERS.length);
  });

  it("那一行说清倍率作用在什么上", () => {
    /*
     * 判那件事:渲染出来的那一句里，除了 ×N 还有一个**单位词**。
     * 不钉具体措辞（「雷伤」「每道雷」都行），但裸乘数不算。
     */
    expect(HOME, "还读 tribulationMult").toMatch(/tribulationMult/);
    const line = /今日渡劫[^<]{0,40}/.exec(HOME)?.[0] ?? "";
    expect(line, "找不到那一行").not.toBe("");
    expect(line, `「${line}」只给了裸乘数 —— 读不出它乘在伤害、成功率还是雷数上`).toMatch(
      /雷伤|雷威|每道雷|伤害/,
    );
  });
});
