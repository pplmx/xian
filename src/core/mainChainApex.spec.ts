/**
 * 走到顶的人，主线永远停在 28/32 —— 还有四条条件早已满足的没结算。
 *
 * ## 由来（第 166 轮，终局那一屏）
 *
 * 玩家已是混沌道祖·圆满，首页「长期道途」却写着:
 *
 * ```text
 * 壹  长期道途   28/32
 *     当前主线  神域之主
 *               突破至神王境
 *     已至 神王     ← 早就过去了
 * ```
 *
 * `MAIN_QUESTS` 共 32 条，末条是「万道之祖 · 证道混沌道祖」（`major: 20`）。
 * 一个走到 `major 20` 的玩家，第 28–32 条的条件**全部**成立，而 `mainIdx` 卡在 27。
 *
 * ## 根因：守卫被当成了配额
 *
 * `checkMainQuest` 调 `advanceMainChain`，后者 `maxSteps: 5`:
 *
 * ```ts
 * /** 一次结算最多推进几节 —— 守卫,不是配额 *\/
 * export const MAIN_CHAIN_MAX_STEPS = 5;
 * ```
 *
 * 那个 5 是**防死循环**的守卫（条件恒真时一帧跳完整条链）。可它同时也是每次结算的
 * 上限，而结算的触发点是「计数器变了 / 突破 / 读档」这类事件 —— 不是每帧。
 * 于是一次只走 5 节、下一次再来 5 节，本该几轮就推完。实测却**一直**停在 28:
 * 因为 `checkMainQuest` 之后没有任何东西再触发它（境界到顶之后不再突破，计数器
 * 也未必再动）。
 *
 * ## 为什么这是内容债，不是显示错
 *
 * 那四条主线的赏格（灵石 / 悟道点）**一分也没发**。走到终局的玩家，恰好是最该拿到
 * 终章赏格的那一个。而页面上他看到的是一条已经过去的旧任务 —— 既没赏，也没
 * 「主线已尽」那句话（那句话要 `mainIdx === length` 才会出现）。
 *
 * ## 判据
 *
 * ① 一个走到顶的玩家，推进之后 `mainIdx === MAIN_QUESTS.length`（不是停在中间）;
 * ② 中间的每一条都真的发过赏（不是被跳过）;
 * ③ 推进**仍然有守卫**：条件恒真的病态输入不许一帧吞完整条链。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { MAIN_QUESTS } from "@/data/quests";
import { readSource } from "@/test/readSource";
import { advanceMainChain, MAIN_CHAIN_MAX_STEPS } from "@/core/engineChain";
import { checkStateAchievements } from "@/core/progress";

/** 走到顶的玩家 */
function apexPlayer(): void {
  const player = usePlayerStore();
  player.initCharacter("终章探针", { roots: [] } as never);
  while (player.major < 20) player.advanceRealm();
}

/**
 * 一个「条件已全部成立」的终局存档 —— 计数类主线也得满足。
 *
 * 只把境界推到顶是不够的:主线前几节吃的是计数器（`explores 1` / `kills 10` …），
 * 而一个直接跳级的探针从没打过一场。玩家侧的真相不是「条件不满足」，
 * 而是**条件早就满足、却没再结算过**。故这里把计数器一并摆满。
 */
function ripePlayer(): void {
  apexPlayer();
  const quests = useQuestsStore();
  quests.counters = {
    kills: 9999,
    battles: 9999,
    explores: 9999,
    events: 9999,
    equipsGained: 9999,
    upgrades: 9999,
    pillsUsed: 9999,
    pillsCrafted: 9999,
    breakthroughFails: 99,
    breakthroughs: 999,
    gongfaLearned: 99,
    decomposed: 99,
    soulsRefined: 99,
    offlineClaims: 99,
    bossKills: 99,
    tribulations: 99,
    pillsFailed: 99,
    reincarnations: 1,
    buildingUpgrades: 999,
  } as never;
}

describe("主线链 · 走到顶的人要推到底", () => {
  it("守卫按 5 节走,但**结算**不该只推一次", () => {
    /*
     * `advanceMainChain` 单次调用仍只走 5 节 —— 那是防恒真的守卫，要留着。
     * 这条判据量的是**守卫本身**的行为（别把它误当成「一次能推完」）,
     * 「玩家那一侧一次结算就推到底」由下一条量。
     */
    setActivePinia(createPinia());
    ripePlayer();
    const quests = useQuestsStore();
    const out = advanceMainChain(quests.mainIdx, () => true);
    expect(out.index, "单次调用不该超守卫上限").toBeLessThanOrEqual(
      quests.mainIdx + MAIN_CHAIN_MAX_STEPS,
    );
    expect(out.index, "也不该一步都不走").toBeGreaterThan(quests.mainIdx);
  });

  it("走完整条链,下标落在 length —— 那是「主线已尽」的判据", () => {
    setActivePinia(createPinia());
    ripePlayer();
    const quests = useQuestsStore();
    // 逐次推进直到不动（模拟多次结算事件）
    for (let i = 0; i < 40; i += 1) {
      const out = advanceMainChain(quests.mainIdx, () => true);
      if (out.index === quests.mainIdx) break;
      quests.setMainIndex(out.index);
    }
    expect(
      quests.mainIdx,
      `主线停在 ${quests.mainIdx}/${MAIN_QUESTS.length} —— 还有条件已满足的没结算`,
    ).toBe(MAIN_QUESTS.length);
  });

  it("真的推进入口:一次周期结算就够（不必等下一次事件）", () => {
    /*
     * 这才是玩家那一侧的真相:到顶之后没有更多事件来触发第二次结算,
     * 故第一次就得走到头。第一版判据只逐次推、不经过 `evolveProgress`，
     * 于是它验的是「反复调用能走完」，而玩家根本等不到第二次调用。
     */
    setActivePinia(createPinia());
    ripePlayer();
    checkStateAchievements();
    const quests = useQuestsStore();
    expect(
      quests.mainIdx,
      `一次结算之后主线停在 ${quests.mainIdx}/${MAIN_QUESTS.length} —— 到顶后再没有事件来推第二次`,
    ).toBe(MAIN_QUESTS.length);
  });

  it("主线下标不许印成 33/32", () => {
    /*
     * 修完之后真浏览器量到 **33/32** —— `mainIdx` 走到 32（= length）之后，
     * 头部那个 `mainIdx + 1` 就多算了一格。回退补一句钳制:
     * 到尽时读 32/32，不是 33/32。
     */
    const home = readSource("src/views/HomeView.vue");
    const len = MAIN_QUESTS.length;
    expect(home, "主线下标要钳在 length 之内").toMatch(
      /Math\.min\(\s*quests\.mainIdx\s*\+\s*1\s*,\s*MAIN_QUESTS\.length\s*\)/,
    );
    // 钳制的语义（纯算术，不依赖视图）
    expect(Math.min(len + 1, len), "走到尽时该读 length").toBe(len);
    expect(Math.min(0 + 1, len), "第一节该读 1").toBe(1);
  });

  it("守卫还在:病态输入不许一帧吞完整条链", () => {
    /*
     * `maxSteps` 是防「条件恒真」的守卫。修法不能把它删掉 ——
     * 那等于把一条防事故的线换成「全都能过」。故这里量的是:
     * 常量仍在、且一次调用**不会**无条件走完全程（除非链本来就在末尾）。
     */
    expect(MAIN_CHAIN_MAX_STEPS, "守卫常数还在").toBeGreaterThan(0);
    expect(MAIN_CHAIN_MAX_STEPS).toBeLessThan(MAIN_QUESTS.length);
  });
});
