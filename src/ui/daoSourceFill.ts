/**
 * 「尚差 N 道源」之后呢 —— 差额说了，怎么补没说。
 *
 * ## 这一处为什么比别处陡
 *
 * 本仓已经把「付不起要报差额」做得很彻底（第 294 轮：报差额，不许报总价）。
 * 天界有 15 处「尚差 N 道源」。而**道源不会自己长** —— 它没有挂机产出，
 * 只能靠熔炉与远征主动去挣。于是玩家读到「尚差 20 道源」时，
 * 手上有的是一个**他不知道怎么填的坑**:
 *
 * ```text
 *   启 程（道源 20 · 破界底赏 60）      ← 按钮上写着"尚差 20 道源"，然后置灰
 * ```
 *
 * 答案其实很近:天道熔炉那个入口就在**同一页**，一次给 5 道源 ——
 * 但玩家得先知道「熔炉能换道源」，而那只写在页头那个数字后面点开的弹窗里
 *（「获取：破界 · 天道试炼 · 天道挑战 · 天道熔炉」，一句名词列表，
 *  没有价格、没有步数、更没说他手里哪样够）。
 *
 * ## 这不是「多写一句」，是补一个决策
 *
 * ```text
 *   尚差 20 道源                                  → 玩家只能去别处翻
 *   尚差 20 道源 · 熔 4 次灵石即够（你有 1.2万 石）  → 可以立刻决定
 * ```
 *
 * 第二句里的每个数都现算:差多少、哪种料最快、一次能给几缕、他手里有多少。
 *
 * ## 为什么它必须是纯函数
 *
 * 它要进判据，而判据不该为此先建一整套 Pinia。库存由调用方读好传进来 ——
 * 这同时也是它能在多个面板（远征 / 试炼 / 道痕 / 魂修）共用的原因:
 * 各处缺口不同、库存相同。
 */
import {
  FURNACE_RATES,
  FURNACE_STONE_DAO_SOURCE,
  FURNACE_STONE_TIER_AMOUNT,
  type FurnaceRate,
} from "@/data/endgame";

/** 熔炉可用的五条路（四种材料 + 灵石） */
export type FillKind = "stone" | FurnaceRate["resource"];

/** 手上各有多少 —— 与 `useResourcesStore` 的键同名 */
export interface FillHoldings {
  stone: number;
  ore: number;
  page: number;
  herb: number;
  dust: number;
}

export interface DaoSourceFillPlan {
  /**
   * 推荐走哪条路。`null` 表示**一条都熔不动** —— 那时 `hint` 说清最缺什么。
   *
   * 之所以允许 null 而不是干脆返回 undefined:玩家需要知道"现在去哪也没用"，
   * 沉默会让他在几个面板之间反复点。
   */
  kind: FillKind | null;
  /** 那条路一次能熔出几缕道源 */
  perRun: number;
  /** 补齐这个缺口要熔几次（向上取整） */
  runsNeeded: number;
  /** 这条路的存量够不够补齐缺口 */
  enough: boolean;
  /** 一句话，直接上屏 */
  hint: string;
}

/**
 * 一次熔炉要耗多少 —— 材料按 `per` 份换 1 缕，灵石按一份给固定缕数。
 *
 * 两条路量纲不同，故统一成「**一份料 = 一次熔炉**」来算:
 * 材料的一次是 `per` 份，灵石的一次是 `FURNACE_STONE_TIER_AMOUNT` 份
 * （后者在服务层还要按玩家层级折算，故这里只给"份数"，不给绝对价）。
 */
function runCostOf(kind: FillKind): number {
  if (kind === "stone") return FURNACE_STONE_TIER_AMOUNT;
  return FURNACE_RATES.find((r) => r.resource === kind)?.per ?? Number.POSITIVE_INFINITY;
}

/** 一次熔炉给几缕 —— 材料是 1（每 per 份换 1 缕），灵石是固定值 */
function runYieldOf(kind: FillKind): number {
  return kind === "stone" ? FURNACE_STONE_DAO_SOURCE : 1;
}

/** 那条路的名字 —— 上屏用，与熔炉对话框同一套叫法 */
const KIND_NAME: Record<FillKind, string> = {
  stone: "灵石",
  ore: "玄铁",
  page: "残页",
  herb: "灵草",
  dust: "器灵尘",
};

/** 五条路的固定顺序 —— 材料按 `FURNACE_RATES` 的顺序，灵石排最后（它的价随层级变） */
const ALL_KINDS: FillKind[] = ["ore", "page", "herb", "dust", "stone"];

/** 负数与 NaN 一律当 0 —— 坏档不该让它抛出，也不该让它推荐一条给不了的路 */
function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 「差 N 道源，怎么补」。
 *
 * 缺口 ≤ 0 时返回 null:没有缺口，这一行就不该出现。
 */
export function daoSourceFillPlan(
  shortfall: number,
  holdings: FillHoldings,
): DaoSourceFillPlan | null {
  if (!Number.isFinite(shortfall) || shortfall <= 0) return null;

  /*
   * 逐条算「这条路能熔出几缕」，取**最多的那条**。
   *
   * 不按列表顺序取第一条"能熔出一点"的:那样会在「25 玄铁 + 300 残页」时
   * 推荐玄铁（1 缕），而残页能熔 20 缕 —— 那条路差得远。
   * 判据 `按"够不够"挑，不按列表顺序挑` 钉着这件事。
   */
  let best: { kind: FillKind; perRun: number } | null = null;
  for (const kind of ALL_KINDS) {
    const have = safe(holdings[kind]);
    const cost = runCostOf(kind);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const runs = Math.floor(have / cost);
    const perRun = runs * runYieldOf(kind);
    if (perRun <= 0) continue;
    if (!best || perRun > best.perRun) best = { kind, perRun };
  }

  if (!best) {
    /*
     * 一条都熔不动 —— 说清楚**最快能凑够一次**的是哪样。
     *
     * 「再攒 N 玄铁就够熔一次」比「材料不足」有用得多:它把下一步变成一个
     * 可执行的数（去打 N 个怪 / 卖点东西），而不是一句"你还不行"。
     */
    let nearest: { kind: FillKind; missing: number } | null = null;
    for (const kind of ALL_KINDS) {
      const cost = runCostOf(kind);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      const missing = cost - safe(holdings[kind]);
      if (missing <= 0) continue; // 不可能:上面已经算过次数
      if (!nearest || missing < nearest.missing) nearest = { kind, missing };
    }
    const hint = nearest
      ? `再攒 ${Math.ceil(nearest.missing)} ${KIND_NAME[nearest.kind]}即可熔一次`
      : "熔炉暂时无从下手";
    return { kind: null, perRun: 0, runsNeeded: 0, enough: false, hint };
  }

  /*
   * 补齐缺口要熔几次。
   *
   * 材料那条路每次熔炉是「per 份 → 1 缕」，故补 N 缕就是 N 次；
   * 灵石那条路一次给 `FURNACE_STONE_DAO_SOURCE` 缕，故是 N / 那份数。
   * 两条都用「缺口 ÷ 每次所得」向上取整 —— 一次所得由 `runYieldOf` 定义。
   */
  const runsNeeded = Math.ceil(shortfall / runYieldOf(best.kind));
  const enough = best.perRun >= shortfall;
  const have = safe(holdings[best.kind]);
  /*
   * 不够的时候要把「还差多少」也说清 —— 只说「全熔只够 12 缕」是一句判决，
   * 玩家读完仍然不知道下一步做什么（还得自己拿 20 减 12、再乘 per 换算成材料）。
   * 本仓对「付不起」的一贯口径正是:列差多少（AGENTS.md 的决策信息完整）。
   */
  const hint = enough
    ? `熔 ${runsNeeded} 次${KIND_NAME[best.kind]}即够（你有 ${formatHold(have, best.kind)}，可得 ${best.perRun} 缕）`
    : `熔尽只得 ${best.perRun} 缕 · 尚差 ${shortfall - best.perRun} 缕`;
  return { kind: best.kind, perRun: best.perRun, runsNeeded, enough, hint };
}

/**
 * 存量上屏的写法 —— 灵石量级大，其余是小整数。
 *
 * 这里**故意不引 `formatGN`**:道源相关的那几个面板本来就用 `formatNum`
 * 报道源数（见 `CelestialView` 页头），两个格式器同屏会出两种写法。
 * 超过一万时改用「万」，与那几处一致。
 */
function formatHold(n: number, kind: FillKind): string {
  const unit = kind === "stone" ? "石" : ` ${KIND_NAME[kind]}`;
  /*
   * 一万以上换「万」，一亿以上换「亿」。
   *
   * 只按「万」一档会在天界露馅:尺度到那里灵石动辄上亿，写出来是
   * 「30000.0万石」—— 玩家得数零才知道是多少。实测踩过。
   */
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿${unit}`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万${unit}`;
  return `${Math.floor(n)}${unit}`;
}
