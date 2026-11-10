/**
 * 终局 store —— 读档容错与边界守卫。
 *
 * ## 为什么单独补这一份
 *
 * `stores/endgame` 是本作状态最重的一处(道途 / 远征在途 / 道痕 / 器魂 / 里程碑 /
 * 试炼记录 / 日课),309 行、二十余个状态变更函数 —— 而它**此前没有任何
 * store 层判据**。别的 store(`dongfu` / `quests` / `settings` / `apprentice` …)
 * 都有各自的一份,唯独这一处没有。
 *
 * 缺口不是抽象的:最近几轮改过它承载的两条数据结构 ——
 *
 * - `worldRun.rows` 的战果行(第 16 轮补 `stats` / `foe`,第 18 轮统一形状);
 * - `CombatResult.atkRamp`(第 6 轮起)与战后归因要读的遥测。
 *
 * **新字段进得去、旧存档也得读得进来** —— 而旧存档里的行没有 `stats`。
 * 这份判据守的就是这条线:坏档不许崩,缺字段不许编。
 *
 * ## 判据分两类
 *
 * 一 **读档容错**:把各个字段灌成 `undefined` / 错类型 / 越界值,`sanitize()`
 *    必须把状态收成可用的值而不是抛错或留下 `NaN`;
 * 二 **不编字段**:缺 `stats` 的战果行要**保持缺失**,不许补一个全零统计
 *    (补了会让「旧档没有遥测」看起来像「这一场真的什么都没发生」)。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useEndgameStore } from "@/stores/endgame";
import { CELESTIAL_WORLDS, EXPEDITION_GUARDIAN_LAYER } from "@/data/endgame";

/** 一份最小的合法在途远征(世界 id 取真实值,sanitize 会校验它) */
const validRun = (): Record<string, unknown> => ({
  worldId: CELESTIAL_WORLDS[0]!.id,
  pactId: null,
  gateId: null,
  layer: 1,
  bonus: 0,
  rows: [],
  carriedHpPct: 1,
  totalRounds: 0,
  winStacks: 0,
});

describe("终局 store · 读档容错", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("坏档不许崩:各字段灌 undefined 后 sanitize 仍能用", () => {
    /*
     * 这一段是 `storeResilience.spec` 那条红线的同类 —— 那里逐个字段灌 undefined
     * 验的是「读档即白屏」。终局 store 字段多,单独立一条。
     */
    const eg = useEndgameStore();
    eg.$patch({
      daoPath: undefined as never,
      daoSource: undefined as never,
      marks: undefined as never,
      milestones: undefined as never,
      records: undefined as never,
      souls: undefined as never,
      equippedSouls: undefined as never,
      trialRecords: undefined as never,
      worldRun: undefined as never,
    });
    expect(() => eg.sanitize(), "坏档把 sanitize 自己搞崩了").not.toThrow();
    // 收完之后这些都得是可用的值(不是 undefined / NaN)
    expect(Number.isFinite(eg.daoSource), `道源不是有限数:${eg.daoSource}`).toBe(true);
    expect(Array.isArray(eg.marks), "道痕没被收成数组").toBe(true);
    expect(Array.isArray(eg.milestones), "里程碑没被收成数组").toBe(true);
    expect(Array.isArray(eg.souls), "器魂列表没被收成数组").toBe(true);
    expect(Array.isArray(eg.equippedSouls), "已佩器魂没被收成数组").toBe(true);
  });

  it("认不得的世界直接作废 —— 带着坏状态打下去更危险", () => {
    const eg = useEndgameStore();
    eg.$patch({ worldRun: { ...validRun(), worldId: "no_such_world" } as never });
    eg.sanitize();
    expect(eg.worldRun, "认不得的世界没被作废 —— 会在不存在的界里继续打").toBeNull();
  });

  it("越界的层与携血被夹回合法区", () => {
    const eg = useEndgameStore();
    eg.$patch({ worldRun: { ...validRun(), layer: 99, carriedHpPct: 5 } as never });
    eg.sanitize();
    const run = eg.worldRun;
    expect(run, "合法世界被误作废了").not.toBeNull();
    expect(run!.carriedHpPct, `携血越界没夹住:${run!.carriedHpPct}`).toBeLessThanOrEqual(1);
    expect(run!.carriedHpPct, "携血被夹成 0 或负数").toBeGreaterThan(0);
    // 合法上限是 `EXPEDITION_GUARDIAN_LAYER`(= 路线层数,3 = 待战界主),
    // 不是「路线层数 - 1」—— 读常量而不是写死,免得层数一改这条判据就撒谎
    expect(run!.layer, `层号越界没夹住:${run!.layer}`).toBeLessThanOrEqual(
      EXPEDITION_GUARDIAN_LAYER,
    );
  });
});

describe("终局 store · 旧存档不许被编出新字段", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("缺 stats 的战果行保持缺失,不补全零统计", () => {
    /*
     * 第 16 / 18 轮给战果行补了 `stats` 与 `foe`。**旧存档里没有这两个字段** ——
     * 读进来之后必须保持「没有」,因为 `analyzeBattle` 正是靠「有没有 stats」
     * 判断这是不是一份能归因的战报(没有就返回 null,那一段整段不出)。
     *
     * 若 sanitize 好心补一个全零 stats,界面会显示「总输出 0 / 总承伤 0」,
     * 玩家会以为那一场真的什么都没发生 —— 那比「没有归因」更糟。
     */
    const eg = useEndgameStore();
    eg.$patch({
      worldRun: {
        ...validRun(),
        // 旧档的行:只有四个基础字段
        rows: [{ foeName: "旧档之敌", win: true, rounds: 5, hpLeftPct: 0.6 }],
      } as never,
    });
    eg.sanitize();
    const row = eg.worldRun?.rows[0];
    expect(row, "旧档的战果行被丢了").toBeDefined();
    expect(row!.foeName).toBe("旧档之敌");
    expect(
      row!.stats,
      "旧档行被补出了 stats —— 界面会把它当成一份完整的遥测,显示全零的读数",
    ).toBeUndefined();
    expect(row!.foe, "旧档行被补出了敌人快照").toBeUndefined();
    expect(row!.atkRamp, "旧档行被补出了 atkRamp").toBeUndefined();
  });

  it("带齐字段的新战果行读回来后字段还在", () => {
    /*
     * 反向守一条:新档存进去的东西读回来不许被 sanitize 削掉。
     * 只核 `foeName` 会漏掉「sanitize 把整行替换成最小形状」这种走偏。
     */
    const eg = useEndgameStore();
    const stats = {
      player: {
        dealt: { m: 1, e: 3 },
        taken: { m: 2, e: 3 },
        pierceTaken: { m: 0, e: 0 },
        biggestHitTaken: { m: 1, e: 2 },
        healed: { m: 0, e: 0 },
        shieldAbsorbed: { m: 0, e: 0 },
        dodges: 1,
        missedHits: 0,
        hitsLanded: 9,
        counters: 0,
        combos: 0,
        crits: 2,
        skillCasts: 1,
        artifactProcs: 0,
        stunnedTurns: 1,
      },
      enemy: {
        dealt: { m: 2, e: 3 },
        taken: { m: 1, e: 3 },
        pierceTaken: { m: 0, e: 0 },
        biggestHitTaken: { m: 1, e: 2 },
        healed: { m: 0, e: 0 },
        shieldAbsorbed: { m: 0, e: 0 },
        dodges: 0,
        missedHits: 0,
        hitsLanded: 5,
        counters: 0,
        combos: 0,
        crits: 0,
        skillCasts: 0,
        artifactProcs: 0,
        stunnedTurns: 0,
      },
    };
    eg.$patch({
      worldRun: {
        ...validRun(),
        rows: [
          {
            foeName: "新档之敌",
            win: false,
            rounds: 9,
            hpLeftPct: 0,
            stats,
            atkRamp: { procs: 2, factor: 1.12 },
          },
        ],
      } as never,
    });
    eg.sanitize();
    const row = eg.worldRun?.rows[0];
    expect(row?.stats, "新档的遥测被 sanitize 削掉了 —— 战后归因又会是空的").toBeDefined();
    expect(row!.stats!.player.hitsLanded, "遥测内容被改了").toBe(9);
    expect(row!.atkRamp, "新档的 atkRamp 被削掉了 —— 「敌势渐涨」那一行会消失").toBeDefined();
    expect(row!.atkRamp!.factor).toBeCloseTo(1.12, 6);
  });
});
