/**
 * 每一世用了多久 —— 履历记着归档时刻，却从没算过这件事。
 *
 * ## 它答的是哪个问题（第 557 轮）
 *
 * 历世足迹已经答了两个走向:
 *
 * ```text
 *   境界走向   比首世深 2 境
 *   终寿走向   比首世多活了 120 载
 * ```
 *
 * 而玩家真正在意的第三个走向没人答:**「我越玩越快了吗」**。
 * 它不来自境界、也不来自终寿 —— 它来自相邻两世归档时刻之差。
 *
 * ## 为什么它算得出来
 *
 * `LifeRecord.at` 是**归档时刻**（转世那一刻写的）。第 N 世的时长就是
 * `第 N 世 at - 第 N-1 世 at`。第一世没有前一个戳，故它不入统计。
 *
 * ## 三条守则
 *
 * ```text
 * 不猜       两端缺值 / 非正 / 顺序倒挂 → 该段跳过，不填 0
 * 不编       一世以上都算不出时 state 为 "none"，界面整块不出
 * 不取整     原始毫秒留着，成句时才折算 —— 取整两次会漂
 * ```
 */
import type { LifeRecord } from "@/data/samsara";

export interface LifePaceSpan {
  /** 这一世的世序 */
  index: number;
  /** 这一世用了多少毫秒 */
  ms: number;
}

export type LifePaceState =
  /** 一段都算不出 —— 整块不出 */
  | "none"
  /** 只有一段 —— 有时长，但没有「快慢」可言 */
  | "single"
  /** 两段以上 —— 有走向 */
  | "ready";

export interface LifePace {
  state: LifePaceState;
  /** 按世序升序 */
  spans: LifePaceSpan[];
  /** 首段与末段之差(毫秒);不足两段时为 null */
  deltaMs: number | null;
  /** 走向:最后一段比第一段短 = 快了 */
  trend: "faster" | "slower" | "even" | null;
  /** 走向的一句人话;没有走向时为空串 */
  trendText: string;
  /** 最快的那一世;打平取更早 */
  fastest: LifePaceSpan | null;
}

const EMPTY: LifePace = {
  state: "none",
  spans: [],
  deltaMs: null,
  trend: null,
  trendText: "",
  fastest: null,
};

/** 把毫秒折成「几日几时」这种可读的话 —— 只在成句时用一次 */
function spanText(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} 分`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} 时`;
  return `${Math.round((hours / 24) * 10) / 10} 日`;
}

export function lifePace(lives: readonly LifeRecord[]): LifePace {
  /* 先按世序排好、再挑出「有合法归档时刻」的那些 */
  const stamped = [...lives]
    .filter((l) => typeof l?.index === "number" && Number.isFinite(l.index))
    .sort((a, b) => a.index - b.index)
    .filter(
      (l): l is LifeRecord & { at: number } =>
        typeof l.at === "number" && Number.isFinite(l.at) && l.at > 0,
    );

  const spans: LifePaceSpan[] = [];
  for (let i = 1; i < stamped.length; i += 1) {
    const prev = stamped[i - 1]!;
    const cur = stamped[i]!;
    /*
     * ## 只取**相邻世序**的两世
     *
     * 中间有一世缺时间戳时，不能拿它前后的两世相减 ——
     * 那一段会横跨两世，报出来的「这一世用了多久」是假的。
     * 故先比世序，再算差。
     */
    if (cur.index - prev.index !== 1) continue;
    const ms = cur.at - prev.at;
    /*
     * 倒挂或零时不填 —— 那说明存档被改过 / 时钟被回拨，
     * 用它算出来的「快了」会撒谎。
     */
    if (ms <= 0) continue;
    spans.push({ index: cur.index, ms });
  }

  if (spans.length === 0) return EMPTY;

  const first = spans[0]!;
  const last = spans[spans.length - 1]!;
  const deltaMs = spans.length >= 2 ? last.ms - first.ms : null;
  const trend: LifePace["trend"] =
    deltaMs === null ? null : deltaMs < 0 ? "faster" : deltaMs > 0 ? "slower" : "even";
  const trendText =
    deltaMs === null
      ? ""
      : trend === "faster"
        ? `末世比首世快了 ${spanText(-deltaMs)}`
        : trend === "slower"
          ? `末世比首世慢了 ${spanText(deltaMs)}`
          : "与首世同速";

  /* 最快的一世:严格小于才替换，故打平留下更早的那一世 */
  let fastest: LifePaceSpan | null = null;
  for (const s of spans) if (!fastest || s.ms < fastest.ms) fastest = s;

  return {
    state: spans.length >= 2 ? "ready" : "single",
    spans,
    deltaMs,
    trend,
    trendText,
    fastest,
  };
}
