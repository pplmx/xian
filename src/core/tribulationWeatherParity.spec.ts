/**
 * 渡劫的天时乘数 —— 预览与结算**必须按同一个境界取**。
 *
 * ## 这个坑本轮撞到过
 *
 * 天象池按界域分(`worldOf(major)` → 人间界五日天时 / 界外专属池),所以
 * "按哪个境界取天时"会改变结果。而两处各写了一个境界:
 *
 *   预览 `currentTribulationPlan`:  `todayWeather(nextMajor)`   ← major + 1
 *   结算 `runTribulation`:          `todayWeather(player.major)` ← 未突破的境界
 *
 * 注释里写着「与结算同源,预览与实算不可能分叉」,而它确实分叉了 ——
 * 只是**平时看不出来**:小境界突破时两者同属一个界域,池子一样。
 *
 * 会露馅的只有大境界突破,即 `major` 恰是所在界域最后一境的三处:
 * **8 / 13 / 17**。那时预览按新界报「雷鸣日 +8%」,结算却按旧界取天时,
 * 两边乘数可能不同 —— 玩家看到的把握与实际不符。
 *
 * ## 判据守什么
 *
 * 两处取天时时用的境界表达式必须**指向同一个值**:结算侧要用 `targetMajor`
 * (它就是 `player.major + 1`)。这条用静态断言,因为两处分居两个模块、
 * 且结算路径依赖随机数,跑一遍不划算。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string): string =>
  readFileSync(join(ROOT, rel), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const BREAKTHROUGH = read("src/core/breakthrough.ts");
const DECISION = read("src/core/tribulationDecision.ts");

describe("渡劫天时 · 预览与结算同源", () => {
  it("结算按 targetMajor 取天时,不是 player.major", () => {
    /*
     * `runTribulation(player.major + 1)` 的入参就是目标境界;里面若写
     * `player.major`,大境界突破时会取到**旧界域**的天象池。
     */
    expect(
      BREAKTHROUGH,
      "结算侧用 player.major 取天时 —— 大境界突破(8/13/17)时会与预览取到不同的天象池",
    ).not.toMatch(/todayWeather\(\s*player\.major\s*\)/);
    expect(BREAKTHROUGH, "结算侧没有按 targetMajor 取天时").toMatch(
      /todayWeather\(\s*targetMajor\s*\)/,
    );
  });

  it("预览按 nextMajor 取天时", () => {
    expect(DECISION, "预览侧没有按 nextMajor 取天时").toMatch(/todayWeather\(\s*nextMajor\s*\)/);
  });

  it("两边指向的是同一个境界 —— nextMajor 就是 major + 1", () => {
    /*
     * 上两条只管"各用了哪个变量名"。这一条管那个等式本身:
     * 若哪天把 nextMajor 的定义改成 `player.major`(不 +1),两条仍绿而实际分叉。
     */
    expect(DECISION, "nextMajor 不再是 major + 1 —— 与结算的 targetMajor 对不上了").toMatch(
      /const nextMajor = player\.isMajorStep \? player\.major \+ 1 : player\.major/,
    );
    // 结算那边传的也是 +1 形态
    expect(BREAKTHROUGH, "runTribulation 的入参不再是 player.major + 1").toMatch(
      /runTribulation\(player\.major \+ 1\)/,
    );
  });
});
