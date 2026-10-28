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
import { BIAS_EFFECTS, biasChanceMult, biasEffectOf, biasOfflineNote } from "./mortalBias";
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
    // 同上:允许换行与空格,但两件事必须同时在场 —— 本世偏向、这个人的总场次
    expect(offlineSrc, "归来卷轴没写这一句 —— 多出来的那份没有来历").toMatch(
      /biasOfflineNote\(\s*currentWorldBias\(\)\s*,\s*summary\.battles\s*\+\s*summary\.bossBattles\s*\)/,
    );
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

describe("资源偏向 · 归来卷轴那一句", () => {
  it("有偏向且打过仗才写,文案与乘区同源", () => {
    expect(biasOfflineNote("矿脉深厚", 12)).toBe("此地所钟 · 玄铁掉落 +15%(离线已计入)");
  });

  it("没偏向、或这一段没打过仗就不写 —— 卷轴不添空话", () => {
    expect(biasOfflineNote(undefined, 12)).toBeNull();
    expect(biasOfflineNote("老存档里的旧词", 12)).toBeNull();
    expect(biasOfflineNote("矿脉深厚", 0)).toBeNull();
  });
});

describe("所钟要说在出发前 · 历练页的那一行", () => {
  /*
   * 资源偏向只乘一个渠道(+15%),但它决定这一世该往哪种地界走。
   * 世界页说得到、战报说得到、归来卷轴也说得到 —— 唯独真正干活的那一页(历练)
   * 从前没有,玩家得先打一场、在战报里撞见「所钟」两个字才知道。
   */
  const viewSrc = readFileSync(resolve(__dirname, "../views/AdventureView.vue"), "utf8");

  it("历练页绑的是 biasEffectOf 的标签,不是自己另拼一句", () => {
    // 认「接线」不认某一种写法:局部变量、可选链、函数参数都可以换,但必须还是
    // biasEffectOf(…) 算出来的标签 —— 上一批字面量判据已经因为换行误红过两次
    expect(viewSrc, "历练页没绑 biasEffectOf —— 文案会与世界页漂开").toMatch(/biasEffectOf\(/);
    expect(viewSrc).toMatch(/\{\{\s*biasLabel\s*\}\}/);
    expect(viewSrc, "那一行被摘掉了(或改了 data 标记)").toContain("data-bias-hint");
  });
});

describe("玩家手册 · 世界的所钟要写得出来", () => {
  /*
   * 「+15% 只给一个渠道」是写进结算的机制(见 afterWin 与 offline),但手册长期没提 ——
   * 玩家只能从世界页那句「矿脉深厚之地」猜它到底给了什么。故这里把手册与
   * BIAS_EFFECTS 绑在一起:偏向表改了而手册没跟,当场红。
   */
  const DOC = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf8");

  it("手册有「所钟」一节,五种偏向逐条都在", () => {
    expect(DOC, "手册没有世界偏向那一节").toContain("世界的「所钟」");
    for (const bias of Object.keys(BIAS_EFFECTS) as (keyof typeof BIAS_EFFECTS)[]) {
      const effect = BIAS_EFFECTS[bias];
      expect(effect, `${bias} 没有兑现表项`).toBeDefined();
      expect(DOC, `手册少了「${bias}」这条偏向`).toContain(bias);
      expect(DOC, `手册里「${bias}」的渠道没写对`).toContain(effect!.label.replace(" +15%", ""));
    }
  });
});
