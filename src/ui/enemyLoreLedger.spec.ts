/**
 * 敌手谱 —— 一百四十种敌手，只报一个总数是不够的
 *
 * ## 缺口:认知是一个四阶段系统,界面只报了「0 / 140」
 *
 * `core/loreThresholds` 把敌手认知分成四阶:
 *
 * ```text
 *   未识(0) → 眼熟(1) → 知其路数(2) → 洞悉(3)
 *   门槛:1 次 · 5 次 · 14 次有效交手
 * ```
 *
 * 修仙录「洞悉敌手」那一行只印 `masteredEnemyCount / ENEMIES.length` —— 也就是
 * **只有到顶的那一阶**。玩家看到 `0 / 140`,既不知道 140 种散在哪几界,也不知道
 * 哪些已经「眼熟」、哪些还是「未识」,更不知道该去打谁。
 *
 * 而这一页别处(灵材、器谱、丹方)都有逐项清单 —— 唯独敌手只有一行数。
 *
 * ## 只报玩家**已经见过**的那些
 *
 * 「未识」的敌人不该被列出来:那是图鉴通用的 `???` 纪律 —— 把名字提前告诉玩家,
 * 泄漏的是「还有哪些没打过」。故这一份清单只收 `enemySeen[id] > 0` 的,
 * 且未识的总数只以「还有 N 种未识」一句呈现,不点名。
 *
 * ## 分档要按引擎的门槛,不另立一套
 *
 * 四阶的名字与门槛都读 `ENEMY_LORE_STAGE_NAMES` / `ENEMY_LORE_THRESHOLDS`
 * (与 `enemyLoreView` 同一份),不在界面按次数手写「5 次算知其路数」——
 * 手写的那份会在改平衡时先分叉。
 */
import { describe, expect, it } from "vite-plus/test";
import { enemyLoreLedger } from "./enemyLoreLedger";
import { ENEMIES } from "@/data/enemies";

/**
 * 由照面次数推出「已记的阶」—— 模拟存档里 `enemyLore` 那份字段。
 *
 * 这一作的库走「计数归 store、判定归库」:阶段不是从 seen 现算的,而是升阶时
 * 写进 `enemyLore`。故判据要把那两样分开传,与真实调用点同形。
 * 门槛按普通档 [0,1,5,14];首领另算(见下面那条)。
 */
const stageOf = (n: number): number => (n >= 14 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0);
const ledgerOf = (record: Record<string, number>, total?: number, bossIds: string[] = []) => {
  const stage: Record<string, number> = {};
  for (const [id, n] of Object.entries(record)) {
    stage[id] = bossIds.includes(id) ? (n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0) : stageOf(n);
  }
  return enemyLoreLedger(record, stage, total === undefined ? {} : { total });
};

describe("敌手谱 · 纯函数", () => {
  it("只列见过的 —— 未识的不点名", () => {
    const ledger = ledgerOf({ e_a: 1, e_b: 6 });
    const ids = ledger.rows.map((r) => r.id);
    expect(ids).toContain("e_a");
    expect(ids).toContain("e_b");
    // 没有任何一次交手的敌人不在 rows 里(调用方传全表,这里只过滤)
    expect(ledger.rows.every((r) => r.seen >= 1)).toBe(true);
  });

  it("按认知阶从高到低排 —— 快洞悉的排前面,那才是下一步该打的", () => {
    const ledger = ledgerOf({ e_low: 1, e_high: 10, e_max: 14 });
    expect(ledger.rows.map((r) => r.id)).toEqual(["e_max", "e_high", "e_low"]);
  });

  it("阶名与门槛读引擎那份,不另写", () => {
    const ledger = ledgerOf({ e_a: 0, e_b: 1, e_c: 5, e_d: 14 });
    expect(ledger.rows[0]!.stageName).toBe("洞悉");
    expect(ledger.rows[1]!.stageName).toBe("知其路数");
    expect(ledger.rows[2]!.stageName).toBe("眼熟");
  });

  it("报出「还差几次到下一阶」—— 玩家据此知道该再打几场", () => {
    const ledger = ledgerOf({ e_a: 3 });
    // 3 次已过「眼熟」(1),下一阶「知其路数」门槛 5
    expect(ledger.rows[0]!.stageName).toBe("眼熟");
    expect(ledger.rows[0]!.toNext).toBe(2);
    expect(ledger.rows[0]!.nextStageName).toBe("知其路数");
  });

  it("已到顶的不报「还差」—— 那会是个永远到不了的数", () => {
    const ledger = ledgerOf({ e_max: 20 });
    expect(ledger.rows[0]!.stageName).toBe("洞悉");
    expect(ledger.rows[0]!.toNext).toBeNull();
    expect(ledger.rows[0]!.nextStageName).toBeNull();
  });

  it("**首领走它自己那张门槛表** —— 不是 5 / 14", () => {
    /*
     * `ENEMY_LORE_BOSS_THRESHOLDS = [0, 1, 2, 3]`(一条命只打一次,门槛按
     * 「见到它的机会」定,不按它有多复杂)。若这里按普通表算,首领会永远显示
     * 「还差 11 次」—— 一个永远到不了的数,而那两层情报也就永远看不着。
     * 判据直接用真实敌人 id 验:首领门槛 2 次即「知其路数」。
     */
    const boss = ENEMIES.find((e) => e.isBoss);
    if (!boss) {
      // 数据里没有首领时这条无从量起 —— 但要红,不能静默跳过
      expect(boss, "数据里找不到任何首领,判据无从量起").toBeTruthy();
      return;
    }
    const ledger = ledgerOf({ [boss.id]: 2 }, undefined, [boss.id]);
    expect(ledger.rows[0]!.stageName, "首领 2 次就该「知其路数」").toBe("知其路数");
    expect(ledger.rows[0]!.nextStageName).toBe("洞悉");
    expect(ledger.rows[0]!.toNext, "首领下一阶门槛 3,还差 1").toBe(1);
  });

  it("门槛已够却还没升阶时 toNext 是 0 —— 界面会说「门槛已够」而不是「再 0 次」", () => {
    /*
     * 存档里的阶与门前次数可能暂时不同步:照面次数已过门槛,但升阶要在**下一次
     * 战斗结算**时才推。那种情形 `remaining` 是 0 —— 界面必须把它与「还差 N 次」
     * 分开说,否则会印出「再 0 次」这种让人以为还要再打的数。
     */
    const ledger = ledgerOf({ a: 5 }, undefined);
    // stageOf(5) = 2(知其路数),下一阶门槛 14,还差 9
    expect(ledger.rows[0]!.toNext).toBe(9);
    // 把阶压低一档(模拟「次数已够、阶还没推」):stage 1,门槛 5,次数正好 5 → remaining 0
    const stale = enemyLoreLedger({ a: 5 }, { a: 1 }, {});
    expect(stale.rows[0]!.toNext, "门槛恰好够、阶还没推时 remaining 是 0").toBe(0);
  });

  it("逐阶计数 —— 「眼熟 3 · 知其路数 2 · 洞悉 1」这一行要现算", () => {
    const ledger = ledgerOf({ a: 1, b: 2, c: 6, d: 7, e: 14 });
    const byStage = Object.fromEntries(ledger.stageCounts.map((s) => [s.stage, s.count]));
    expect(byStage["眼熟"]).toBe(2);
    expect(byStage["知其路数"]).toBe(2);
    expect(byStage["洞悉"]).toBe(1);
  });

  it("未识的总数单独给 —— 不点名,但要说得出发还有多少", () => {
    const ledger = ledgerOf({ e_a: 1 }, 140);
    expect(ledger.unknown).toBe(139);
    expect(ledger.known).toBe(1);
  });

  it("不传总数时不凭空造「还有 N 种」", () => {
    const ledger = ledgerOf({ e_a: 1 });
    expect(ledger.unknown).toBeNull();
  });

  it("一次都没见过时整块不出", () => {
    const ledger = ledgerOf({});
    expect(ledger.rows).toEqual([]);
    expect(ledger.known).toBe(0);
  });

  it("坏值(负数 / NaN)当作没见过,不排进榜", () => {
    const ledger = ledgerOf({ a: -3, b: Number.NaN, c: 2 });
    expect(ledger.rows.map((r) => r.id)).toEqual(["c"]);
    expect(ledger.known).toBe(1);
  });

  it("同名同阶时按 id 稳定排 —— 不让顺序每次刷新都变", () => {
    const ledger = ledgerOf({ z: 2, a: 2, m: 2 });
    expect(ledger.rows.map((r) => r.id)).toEqual(["a", "m", "z"]);
  });
});
