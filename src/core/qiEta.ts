/**
 * 破境还差多少灵气、要回多久 —— **一处算，两处读**。
 *
 * ## 为什么抽出来（第 420 轮）
 *
 * 这段算式原本只活在 `BreakthroughCard` 里（站在按钮前的那一屏）。而它回答的
 * 是一个**在别处也会被问到**的问题:
 *
 * ```text
 *   突破卡    灵气不足 → 尚差 N 缕 · 约 3 分 20 秒
 *   首页状态  灵气不足 → （什么也没有）
 * ```
 *
 * 首页说「修为已满 · 灵气不足」却不说还要等多久,玩家得点进去才知道 ——
 * 而首页那句话的全部意义正是「让玩家知道现在是什么处境」。
 *
 * 若在首页另写一份 `qiCost - qi` 与 `short / qiRegenPerSec`,两处迟早分叉,
 * 那时会出现「首页说还差 3 分钟、突破卡说还差 2 分钟」这种更难查的错。
 * 故抽到这里,两边读同一份。
 *
 * ## 无回复时给 `null` 而不是 Infinity
 *
 * `Infinity` 经过 `formatDuration` 会变成一个荒唐的数;而「当前无回复」是一句
 * **玩家能据此行动**的话（去查为什么没回复）。故 ETA 用 `null` 表示算不出来。
 */
import type { GNum } from "@/types";
import { gn, toNum } from "@/utils/gnum";

export interface QiEta {
  /** 还差多少缕（已向上取整，不会出现「还差 0.3 缕」） */
  short: number;
  /** 回复所需秒数；**无回复时为 null** */
  sec: number | null;
}

/**
 * 还差多少灵气、按当前回复速度要多久。
 *
 * @param cost 本次需要的灵气（突破卡读 `breakthroughInfo().qiCost`）
 * @param qi   当前灵气
 * @param regenPerSec 每秒回复（`player.qiRegenPerSec`）
 */
export function qiEta(cost: number, qi: GNum | number, regenPerSec: number): QiEta {
  const short = Math.max(0, Math.ceil(cost - toNum(typeof qi === "number" ? gn(qi) : qi)));
  if (short === 0) return { short: 0, sec: 0 };
  const sec = regenPerSec > 0 ? Math.ceil(short / regenPerSec) : null;
  return { short, sec };
}
