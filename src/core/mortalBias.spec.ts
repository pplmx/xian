/**
 * 资源偏向 · 每一世那句话都要有兑现。
 *
 * 此前 `bias` 只进文案与新颖度:`worldSemantics` 把它记成「看似有信息、实际没信息」。
 * 现在每条偏向只接一个渠道、幅度 +15%,判据盯三件事:
 *   ① 五条偏向各有渠道与乘区,且幅度落在约定的 10~15% 区间;
 *   ② 只放大对得上的那个渠道,别的渠道一分不增;
 *   ③ 真接进了战斗结算 —— 不是只多了一张表(对着 afterWin 比读数)。
 */
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { BIAS_EFFECTS, biasChanceMult, biasEffectOf } from "./mortalBias";
import { afterWin } from "./loot";
import { REGIONS } from "@/data/regions";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";

const BIASES = ["草木丰饶", "矿脉深厚", "典籍散佚", "灵石充盈", "药气氤氲"] as const;

describe("资源偏向 · 表与乘区", () => {
  it("五条偏向各有渠道,幅度在 10%~15%,且标签里写着同一个数", () => {
    for (const b of BIASES) {
      const e = biasEffectOf(b);
      expect(e, `${b} 没有兑现表项`).toBeDefined();
      expect(e!.mult).toBeGreaterThanOrEqual(1.1);
      expect(e!.mult).toBeLessThanOrEqual(1.15);
      expect(e!.label, "标签里的数字必须与乘区同源").toContain(
        `${Math.round((e!.mult - 1) * 100)}%`,
      );
    }
    // 渠道两两不同:五条偏向不该有两条乘在同一处
    const channels = new Set(BIASES.map((b) => BIAS_EFFECTS[b]!.channel));
    expect(channels.size).toBe(BIASES.length);
  });

  it("只放大对得上的渠道;别的渠道与未知偏向一律 1", () => {
    expect(biasChanceMult("矿脉深厚", "ore")).toBe(1.15);
    expect(biasChanceMult("矿脉深厚", "herb")).toBe(1);
    expect(biasChanceMult("矿脉深厚", "stone")).toBe(1);
    expect(biasChanceMult(undefined, "ore")).toBe(1);
    expect(biasChanceMult("老存档里的旧词", "ore"), "未知偏向不许瞎乘").toBe(1);
  });
});

describe("资源偏向 · 真的接进了结算", () => {
  /*
   * 为什么这里用源码判据而不是跑读数:掉落走的是模块级 `rng` 单例,它的随机函数
   * 在模块加载时就绑好了 —— 在用例里 mock `Math.random` 影响不到它。我在第一版里
   * 试过跑 240 场的统计对照,单跑绿、全量红:那是抽样,不是判据。
   * 故这里钉两件事,都是确定性的:
   *   ① 五个渠道各乘一次 biasChanceMult(掉在哪个 switch 分支上也不许漏);
   *   ② 在线与离线都真的把本世偏向传进 afterWin —— 否则两套账又对不上。
   */
  const lootSrc = readFileSync(resolve(__dirname, "./loot.ts"), "utf8");
  const onlineSrc = readFileSync(resolve(__dirname, "./exploration.ts"), "utf8");
  const offlineSrc = readFileSync(resolve(__dirname, "./offline.ts"), "utf8");

  it("五个渠道各乘一次 —— 灵石/灵草/玄铁/残页/丹药", () => {
    for (const channel of ["stone", "herb", "ore", "page", "pill"] as const) {
      expect(lootSrc, `${channel} 渠道没接上偏向`).toContain(`biasChanceMult(bias, "${channel}")`);
    }
    expect(lootSrc, "afterWin 必须收下这一世的偏向").toContain("bias?: string");
  });

  it("在线与离线都传本世偏向 —— 两套账同一口径", () => {
    expect(onlineSrc, "在线战斗没传偏向").toContain("currentWorldBias()");
    expect(offlineSrc, "离线战斗没传偏向").toContain("currentWorldBias()");
  });
});

describe("资源偏向 · 应验时才报一声", () => {
  /*
   * +15% 单场看不出来。战报里那行「所钟」只在**对应渠道真的掉了**时写:
   * 每场都写就成了噪音,而玩家要的是「刚才那次玄铁,是这一世的偏向给的」。
   * 文案直接取 biasEffect.label —— 与乘区同源,不是另一处手写。
   */
  beforeEach(() => {
    setActivePinia(createPinia());
    usePlayerStore().major = 3;
    useResourcesStore().spiritStone = { m: 0, e: 0 };
  });

  it("灵石渠道每场必给,故一定应验", () => {
    const drops = afterWin(REGIONS[0]!, 1, false, "灵石充盈");
    expect(drops.lines).toContain("所钟 · 灵石收益 +15%");
  });

  it("没有偏向就不写这一行", () => {
    const drops = afterWin(REGIONS[0]!, 1, false);
    expect(drops.lines.some((l) => l.includes("所钟"))).toBe(false);
  });

  it("概率渠道:玄铁真掉了才写 —— 与行囊逐场对得上", () => {
    const res = useResourcesStore();
    for (let i = 0; i < 40; i += 1) {
      res.ore = 0;
      const drops = afterWin(REGIONS[0]!, 1, false, "矿脉深厚");
      expect(
        drops.lines.some((l) => l.includes("所钟")),
        `第 ${i} 场`,
      ).toBe(res.ore > 0);
    }
  });
});
