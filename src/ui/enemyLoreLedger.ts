/**
 * 敌手谱 —— 一百四十种敌手,只报一个总数是不够的
 *
 * ## 缺口:认知是一个四阶段系统,界面只报了「0 / 140」
 *
 * `core/loreThresholds` 把敌手认知分成四阶:
 *
 * ```text
 *   未识(0) → 眼熟(1) → 知其路数(2) → 洞悉(3)
 *   普通门槛:1 次 · 5 次 · 14 次有效交手
 *   首领门槛:1 次 · 2 次 · 3 次(一条命只打一次,按「见到它的机会」定)
 * ```
 *
 * 修仙录「洞悉敌手」那一行只印 `masteredEnemyCount / ENEMIES.length` ——
 * 也就是**只有到顶的那一阶**。玩家看到 `0 / 140`,既不知道这些散在哪几界,
 * 也不知道哪些已「眼熟」、哪些还是「未识」,更不知道该去打谁。
 * 而这一页别处(灵材、器谱、丹方)都有逐项清单 —— 唯独敌手只有一行数。
 *
 * ## 只列**见过**的,未识的只报个数
 *
 * 「未识」的敌人不该被点名:那是图鉴通用的 `???` 纪律 —— 把名字提前告诉玩家,
 * 泄漏的是「还有哪些没打过」。故清单只收 `enemySeen[id] > 0` 的;
 * 未识的以一句「还有 N 种未识」呈现,不点名。
 *
 * ## 阶名与门槛都读引擎那份,且**按敌人类型取表**
 *
 * **阶段是存档里的一个字段(`lore.enemyLore`),不是从照面次数现算的。**
 * 这一作的库走「计数归 store、判定归库」:照面次数记在 `enemySeen`,
 * 升阶判定由 `codexAdvanceEnemyLoreIfDue` 写进 `enemyLore`。故这里读的是
 * 那一份已记的阶,再交给 `enemyLoreView` 取阶名与「还差几次」——
 * 自己按次数手写「5 次算知其路数」会在改平衡时先分叉,
 * 而且会把首领算成「永远还差 11 次」。
 *
 * ## 这一层只算,不读 store
 *
 * 照面表由调用方传入(`lore.enemySeen`),故判据不必搭 Pinia。
 */
import { enemyLoreView } from "@/core/engineCodex";
import { ENEMY_LORE_STAGE_NAMES } from "@/core/loreThresholds";

/** 谱上一行 */
export interface EnemyLoreRow {
  id: string;
  /** 有效交手次数 */
  seen: number;
  /** 当前阶名(取自引擎) */
  stageName: string;
  /** 当前是第几阶(0 = 未识,但 0 阶不会出现在 rows 里) */
  stageIndex: number;
  /** 距下一阶还差几次;已到顶为 null */
  toNext: number | null;
  /** 下一阶的名字;已到顶为 null */
  nextStageName: string | null;
}

/** 逐阶计数 */
export interface EnemyLoreStageCount {
  stage: string;
  count: number;
}

export interface EnemyLoreLedger {
  /** 见过的,按认知阶从高到低排(同阶按 id) */
  rows: EnemyLoreRow[];
  /** 见过的种数 */
  known: number;
  /** 未识的种数;没传总数时为 null(不凭空造「还有 N 种」) */
  unknown: number | null;
  /** 逐阶计数(只统计见过的) */
  stageCounts: EnemyLoreStageCount[];
}

/** 一次有效交手都没有 —— 整块不出 */
const EMPTY = (): EnemyLoreLedger => ({ rows: [], known: 0, unknown: null, stageCounts: [] });

/** 照面次数要能读:非有限或负值一律当作没见过 */
function validSeen(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const n = Math.floor(value);
  return n > 0 ? n : 0;
}

/**
 * 由照面表算出敌手谱。
 *
 * `total` 给的是全部敌手种数(`ENEMIES.length`);不传则 `unknown` 为 null ——
 * 与其编一个「还有 N 种」,不如不说。
 */
export function enemyLoreLedger(
  enemySeen: Readonly<Record<string, number>>,
  enemyLore: Readonly<Record<string, number>> = {},
  options: { total?: number } = {},
): EnemyLoreLedger {
  const ids = Object.keys(enemySeen);
  if (ids.length === 0) {
    const empty = EMPTY();
    return options.total === undefined ? empty : { ...empty, unknown: Math.max(0, options.total) };
  }

  const rows: EnemyLoreRow[] = [];
  for (const id of ids) {
    const seen = validSeen(enemySeen[id]);
    if (seen === 0) continue;
    /*
     * 阶段判定交给引擎 —— `enemyLoreView` 内部按 `enemyDef(id).isBoss` 选门槛表,
     * 故首领不会被错算成普通档。第二个参数是**已记的阶**(存档里的 `enemyLore`),
     * 不是空的:传空对象会让每一只都读成「未识」——实测踩过。
     */
    const stage = validSeen(enemyLore[id]);
    const view = enemyLoreView({ [id]: seen }, { [id]: stage }, id);
    const stageIndex = view?.stage ?? 0;
    /*
     * `enemyLoreView` 只给 `maxed` / `remaining` / `nextAt`,**不给下一阶的名字** ——
     * 下一阶的名字从 `ENEMY_LORE_STAGE_NAMES[stageIndex + 1]` 取,与引擎同一份表。
     */
    const maxed = view?.maxed === true;
    const nextStageName = maxed ? null : (ENEMY_LORE_STAGE_NAMES[stageIndex + 1] ?? null);
    rows.push({
      id,
      seen,
      stageName: view?.name ?? ENEMY_LORE_STAGE_NAMES[0]!,
      stageIndex,
      // 到顶时不报「还差」—— 那会是个永远到不了的数
      toNext: maxed || nextStageName === null ? null : (view?.remaining ?? null),
      nextStageName: maxed ? null : nextStageName,
    });
  }
  if (rows.length === 0) {
    const empty = EMPTY();
    return options.total === undefined ? empty : { ...empty, unknown: Math.max(0, options.total) };
  }

  /*
   * 从高到低:快洞悉的排前面 —— 那才是「下一步该去打谁」。
   * 同阶按 id 稳定排,免得每次刷新顺序都变。
   */
  rows.sort((a, b) => b.stageIndex - a.stageIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 逐阶计数只统计见过的 —— 未识那一阶不进这张表(它由 unknown 单独报)
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.stageName, (counts.get(row.stageName) ?? 0) + 1);
  const stageCounts: EnemyLoreStageCount[] = ENEMY_LORE_STAGE_NAMES.slice(1)
    .map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
    .filter((row) => row.count > 0);

  const known = rows.length;
  return {
    rows,
    known,
    unknown: options.total === undefined ? null : Math.max(0, options.total - known),
    stageCounts,
  };
}
