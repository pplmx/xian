/**
 * 奇缘进度 —— 八条缘,走到第几段了没人告诉玩家
 *
 * ## 缺口:链进度是存档里的一等状态,却一个字都不显示
 *
 * `data/chains.ts` 有 8 条奇缘链、21 个阶段事件;进度存在
 * `player.eventChains`(每条链 → 已完成的段数),由 `eventEngine` 的
 * `pickChainStageEvent` 消费 —— 上一程结了哪一段缘,下一程才轮得到它。
 *
 * 而界面上没有任何地方显示它:玩家走「青石问路」走到第 2 段时,既看不出
 * 自己正走在一条缘上,也不知道这条缘还有几段、下回该去哪儿撞见它。
 * 奇缘恰恰是这一作最难得的叙事内容(无缘在续时它根本不出现),
 * 走了一半却看不见进度,等于把它当成一次性随机事件。
 *
 * ## 只列**动过**的缘,未开始的不点名
 *
 * 八条缘的 `hint` 是线索 —— 没碰过的缘把名字与线索摆出来,等于提前告诉玩家
 * 「还有这八条路可走」,与图鉴的 `???` 纪律冲突。故只列 `eventChains[id] > 0` 的,
 * 其余只报「另有 N 条缘未起」。
 *
 * ## 「已了」与「在续」要分开
 *
 * 走到最后一段 = 这条缘了了(不会再出现在抽取里);停在中间 = 在续。
 * 两种状态对玩家的意思完全不同:一个可以放下,一个要留个心眼。
 *
 * ## 这一层只算,不读 store
 *
 * 进度表由调用方传入(`player.eventChains`),故判据不必搭 Pinia。
 */

/** 链定义里这一层用得上的字段(与 `data/chains` 的 `ChainDef` 同形) */
export interface ChainLedgerDef {
  id: string;
  name: string;
  hint: string;
  stages: readonly string[];
}

/** 缘榜上一行 */
export interface ChainLedgerRow {
  id: string;
  name: string;
  hint: string;
  /** 已完成的段数 */
  done: number;
  /** 这条缘一共几段 */
  total: number;
  /** 已了(走到最后一段) */
  finished: boolean;
  /** 下一段是第几段(1 起);已了为 null */
  nextStage: number | null;
  /**
   * 此刻这条路真走得通 —— 链未结 **且** 下一程的境界门槛已够。
   *
   * 由调用方传入(引擎的 `pendingChainStages` 就给了这份集合)。境界不够的缘
   * 这阵子撞不见,把它算成「在续」会让人白等。
   */
  reachable: boolean;
}

export interface ChainLedger {
  /** 动过的缘:在续的排前面,同在续时「只差一段」的排前面 */
  rows: ChainLedgerRow[];
  /** 起了几条 */
  started: number;
  /** 了几条 */
  finished: number;
  /** 此刻真能走的条数(在续且够得着)—— 「缘在续」这句话的准数 */
  active: number;
  /** 另有几条未起 —— 不点名 */
  unstarted: number;
}

/** 进度越界 / 坏值一律夹回 [0, total];非有限按未开始 */
function clampDone(raw: unknown, total: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  const n = Math.floor(raw);
  if (n <= 0) return 0;
  return Math.min(n, total);
}

/**
 * 由链定义与进度表算出奇缘榜。
 *
 * 表里查不到的链 id 直接忽略 —— 不印一个没有名字的进度。
 */
export function chainLedger(
  chains: readonly ChainLedgerDef[],
  eventChains: Readonly<Record<string, number>>,
  options: { reachable?: ReadonlySet<string> } = {},
): ChainLedger {
  const reachableIds = options.reachable;
  const rows: ChainLedgerRow[] = [];
  let found = 0;
  for (const chain of chains) {
    const total = chain.stages.length;
    if (total <= 0) continue;
    const done = clampDone(eventChains[chain.id], total);
    found += 1;
    // 没动过的缘不点名 —— 见文件头「只列动过的」
    if (done <= 0) continue;
    const finished = done >= total;
    rows.push({
      id: chain.id,
      name: chain.name,
      hint: chain.hint,
      done,
      total,
      finished,
      nextStage: finished ? null : done + 1,
      // 已了的缘不再「走通」—— 它没有下一程了
      reachable: !finished && (reachableIds?.has(chain.id) ?? true),
    });
  }

  /*
   * 在续的排前面 —— 还等着你的那条才是下一步。
   * 同在续时,只差一段的排前面(离收束最近)。
   * 同档按原书顺序稳定排,免得顺序随刷新变。
   */
  const rank = (row: ChainLedgerRow): number => (row.finished ? 2 : !row.reachable ? 1 : 0);
  rows.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (!a.finished && !b.finished) {
      const diff = a.total - a.done - (b.total - b.done);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const finished = rows.filter((r) => r.finished).length;
  return {
    rows,
    started: rows.length,
    finished,
    active: rows.filter((r) => r.reachable).length,
    unstarted: Math.max(0, found - rows.length),
  };
}
