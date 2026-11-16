/**
 * 第一步(新手引导的起点)判据 —— 它是一张「说错就会把人带偏」的卡,故逐条钉死:
 * 什么时候给、给到哪儿、什么时候必须闭嘴。
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { useCultivationStore } from "@/stores/cultivation";
import { gn, toNum, gnZero } from "@/utils/gnum";
import { currentFirstStep, homeStatusText } from "./firstStep";

function newPlayer() {
  const player = usePlayerStore();
  player.initCharacter("新手", { roots: [] } as never);
  player.exp = gnZero();
  return player;
}

describe("第一步(新手起点)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("开局新手 → 指向历练,且写清为什么", () => {
    newPlayer();
    const step = currentFirstStep()!;
    expect(step.to).toBe("/adventure");
    expect(step.label).toBe("去历练");
    expect(step.text).toContain("历练");
    expect(step.hint).toContain("突破"); // 把"历练 → 修为 → 突破"这条线说出来
  });

  it("修为圆满 → 改指修炼页突破(这时还往历练赶是错的)", () => {
    const player = newPlayer();
    player.exp = gn(toNum(player.expReq)); // 圆满
    expect(player.expFull).toBe(true);
    const step = currentFirstStep()!;
    expect(step.to).toBe("/cultivation");
    expect(step.label).toBe("去突破");
    expect(step.text).toContain("圆满");
    // 不再点名层数:同屏主线里程碑另报「三层」,这里再报「下一层」会看成界面打架。
    // 实际目标层由突破页自己亮;这张卡只负责递"该去哪点"。
    expect(step.text).toContain("突破");
    expect(step.text).not.toContain("层");
  });

  it("修为未满 → 仍指历练(圆满那一支不该提前触发)", () => {
    const player = newPlayer();
    player.exp = gn(Math.floor(toNum(player.expReq) * 0.9));
    expect(currentFirstStep()!.to).toBe("/adventure");
  });

  it("已经历练过一次 → 收卡(第一步走过了)", () => {
    newPlayer();
    useQuestsStore().inc("explores", 1);
    expect(currentFirstStep()).toBeNull();
  });

  it("第一条主线达成 → 收卡(出师)", () => {
    newPlayer();
    useQuestsStore().mainIdx = 1;
    expect(currentFirstStep()).toBeNull();
  });

  it("已突破到筑基以上 → 收卡(老档兜底:没有计数也没有主线下标时不再当新玩家)", () => {
    const player = newPlayer();
    player.major = 1;
    expect(currentFirstStep()).toBeNull();
  });

  it("陨落 → 不给第一步(首页那时该说的是生死大事)", () => {
    const player = newPlayer();
    player.markDead();
    expect(currentFirstStep()).toBeNull();
  });

  it('闭关中 → 不给"去历练":那条路会被当场拦下,指过去等于白点一次', () => {
    newPlayer();
    useCultivationStore().addBuff("retreat", Date.now());
    expect(currentFirstStep()).toBeNull();
  });
});

describe("首页状态一行", () => {
  const idle = {
    dead: false,
    exploringSecret: false,
    expedition: false,
    sessionActive: false,
    regionName: "",
    injured: false,
    retreating: false,
    expFull: false,
  };

  it("没事做时说修炼中,不把闲坐说成闭关", () => {
    expect(homeStatusText(idle)).toBe("修炼中");
  });

  it("只有 retreat buff 才说闭关中", () => {
    expect(homeStatusText({ ...idle, retreating: true })).toBe("闭关中");
  });

  it("修为已满分两种：灵气够是「一步之遥」，灵气不够是「卡住了」（第 419 轮）", () => {
    /*
     * 缺口：`homeStatusText` 此前只有 `expFull` 一档，于是「修为已满」被当成一个
     * 终态。而它其实是两种处境：
     *
     *   修为已满 + 灵气够      一步之遥，去突破
     *   修为已满 + 灵气不够    卡住了，要等灵气
     *
     * 前者点进去就能破；后者点进去才发现「还差多少缕、回够要多久」。
     * 而后者恰恰是后期最常见的那种：灵气上限随境界涨、破境消耗按比例算。
     */
    expect(homeStatusText({ ...idle, expFull: true, qiShort: false }), "灵气够时不该提灵气").toBe(
      "修为已满",
    );
    expect(
      homeStatusText({ ...idle, expFull: true, qiShort: true }),
      "灵气不够时要说出来 —— 否则玩家以为点进去就能破境",
    ).toBe("修为已满 · 灵气不足");
    /*
     * 反差：`qiShort` 只在修为已满时才有意义。
     * 修为没满时它是噪音（那时该说的是「修炼中」），不该冒出「灵气不足」。
     */
    expect(
      homeStatusText({ ...idle, expFull: false, qiShort: true }),
      "修为没满时说「灵气不足」是错的 —— 那时该做的是继续修炼",
    ).toBe("修炼中");
  });

  it("历练 / 探秘 / 远征 / 疗伤 / 修为满 / 陨落各说各的", () => {
    expect(homeStatusText({ ...idle, sessionActive: true, regionName: "青云山麓" })).toBe(
      "历练中 · 青云山麓",
    );
    expect(homeStatusText({ ...idle, exploringSecret: true })).toBe("探秘中");
    expect(homeStatusText({ ...idle, expedition: true })).toBe("远征中");
    expect(homeStatusText({ ...idle, injured: true })).toBe("疗伤中");
    expect(homeStatusText({ ...idle, expFull: true })).toBe("修为已满");
    expect(homeStatusText({ ...idle, dead: true })).toBe("陨落");
  });

  it("修为满的提示不压过闭关:正在挂机闭关时,不必喊人去突破", () => {
    // 「修为已满」是在闲坐时的引导;人已闭关(有时限、禁历练的 buff)则闭关优先
    expect(homeStatusText({ ...idle, retreating: true, expFull: true })).toBe("闭关中");
  });
});

/**
 * 接线 —— 首页真的把「灵气够不够」传进去了吗。
 *
 * ## 为什么单开这一条
 *
 * 上面那条验的是**函数**的行为。而 `homeStatusText` 是纯函数,
 * 它答不答对与「首页有没有把 `qiShort` 传进来」是两件事 ——
 * 这正是第 388 轮「素行之向没有 UI」那一类:逻辑对、没人调。
 *
 * ## 口径要取真值,不另算
 *
 * 判据还钉住**取值的来源**:`qiShort` 该读 `breakthroughInfo().reason`,
 * 而不是在视图里另写一遍 `resources.qi < qiCost`。两处各写一遍迟早分叉 ——
 * 那时会出现「首页说灵气不足,而突破卡说可以破」这种更难查的错。
 */
describe("首页状态 · 灵气不足那一档的接线", () => {
  const VIEW = readFileSync(resolve(__dirname, "../views/HomeView.vue"), "utf-8");

  it("首页把 qiShort 传给了 homeStatusText", () => {
    const at = VIEW.indexOf("homeStatusText({");
    expect(at, "找不到 homeStatusText 的调用").toBeGreaterThan(0);
    const call = VIEW.slice(at, VIEW.indexOf("}),", at) + 3);
    expect(call, "没有传 qiShort —— 「修为已满 · 灵气不足」永远不会出现").toMatch(/qiShort:/);
  });

  it("qiShort 取的是突破那一侧的真值，不是视图里另算一遍", () => {
    const at = VIEW.indexOf("qiShort:");
    expect(at, "找不到 qiShort 那一行").toBeGreaterThan(0);
    const line = VIEW.slice(at, VIEW.indexOf("\n", at));
    expect(
      line,
      "qiShort 该读 breakthroughInfo().reason —— 与破境卡同一个判据，不在这里另算",
    ).toMatch(/breakthroughInfo\(\)\.reason/);
    // 反差：不许在视图里自己比灵气
    expect(line, "视图里另写了一遍灵气比较 —— 两处各写一遍迟早分叉").not.toMatch(
      /resources\.qi\s*<|qi\s*<\s*qiCost/,
    );
  });
});
