/**
 * 破境还差多少灵气、要回多久 —— 一处算，两处读。
 *
 * ## 抽出来的原因（第 420 轮）
 *
 * 这段算式原本只活在 `BreakthroughCard` 里。而它回答的是一个**在别处也会被问到**的问题：
 *
 * ```text
 *   突破卡    灵气不足 → 尚差 N 缕 · 约 3分20秒
 *   首页状态  灵气不足 → （什么也没有，或者说不出等多久）
 * ```
 *
 * 首页那句话的全部意义正是「让玩家知道现在是什么处境」，而「卡住了」与
 * 「卡三分钟」是两种完全不同的决定：三分钟可以等，二十分钟该去做别的。
 *
 * 若在首页另写一份 `qiCost - qi` 与 `short / regen`，两处迟早分叉 —— 那时会出现
 * 「首页说还差三分钟、突破卡说还差两分钟」这种更难查的错。
 *
 * ## 判据
 *
 * ① 差 0 时 `sec` 也是 0（不需要等）；
 * ② 向上取整 —— 不会出现「还差 0.3 缕」这种读不出来的数；
 * ③ 无回复时 `sec` 是 `null`，不是 `Infinity`
 *    （`Infinity` 经 `formatDuration` 会变成一个荒唐的数，而「当前无回复」是一句
 *    玩家能据此行动的话）；
 * ④ 两处读同一份 —— 判据扫源码，钉住它们都调 `qiEta`
 * ⑤ 反差：把回归速度翻倍，ETA 必须减半 —— 否则它没真的用那个速度。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qiEta } from "./qiEta";
import { gn } from "@/utils/gnum";

describe("灵气 ETA · 还差多少、要回多久", () => {
  it("差 0 时不用等", () => {
    expect(qiEta(100, 100, 10)).toEqual({ short: 0, sec: 0 });
    expect(qiEta(100, 150, 10), "灵气已够时也是 0").toEqual({ short: 0, sec: 0 });
  });

  it("向上取整 —— 不出现「还差 0.3 缕」", () => {
    const r = qiEta(100, 99.7, 10);
    expect(r.short, "0.3 缕该向上取整成 1").toBe(1);
    // 已够时不能因为取整变成 1
    expect(qiEta(100, 99.999, 3).short).toBe(1);
  });

  it("无回复时 sec 是 null，不是 Infinity", () => {
    const r = qiEta(100, 0, 0);
    expect(r.short).toBe(100);
    expect(
      r.sec,
      "无回复时给 Infinity —— 经 formatDuration 会印出一个荒唐的数；「当前无回复」才是一句能据此行动的话",
    ).toBeNull();
    /*
     * 负的回复速度（理论上不该有）也按「无回复」处理 ——
     * 不能算出负秒数然后 `Math.max(0, ...)` 藏起来。
     */
    expect(qiEta(100, 0, -5).sec, "负回复速度也算不出来").toBeNull();
  });

  it("ETA 真的用了那个速度 —— 速度翻倍，时间减半", () => {
    /*
     * 反差：若实现里把 `regenPerSec` 写死成某个常数，这条会红。
     */
    const slow = qiEta(1000, 0, 10);
    const fast = qiEta(1000, 0, 20);
    expect(slow.sec).toBe(100);
    expect(fast.sec, "速度翻倍后时间必须减半 —— 否则它没真的用那个速度").toBe(50);
  });

  it("灵气是 GNum 时也算得对", () => {
    // 后期灵气是 gn 大数，不能只认 number
    expect(qiEta(1000, gn(400), 10).short).toBe(600);
  });
});

describe("灵气 ETA · 两处读同一份", () => {
  const CARD = readFileSync(
    resolve(__dirname, "../components/cultivation/BreakthroughCard.vue"),
    "utf-8",
  );
  const HOME = readFileSync(resolve(__dirname, "../views/HomeView.vue"), "utf-8");

  it("突破卡与首页都调 qiEta", () => {
    expect(CARD, "突破卡没有用共用的 qiEta").toMatch(/qiEta\(/);
    expect(HOME, "首页没有用共用的 qiEta —— 「还差多久」会与突破卡分叉").toMatch(/qiEta\(/);
  });

  it("两处都不许自己再写一遍除法", () => {
    /*
     * 反差：自己去算 `short / qiRegenPerSec` 就是在造第二本账。
     */
    expect(CARD, "突破卡里又自己算了一遍 ETA").not.toMatch(/\/\s*player\.qiRegenPerSec/);
    expect(HOME, "首页里又自己算了一遍 ETA").not.toMatch(/\/\s*player\.qiRegenPerSec/);
  });
});
