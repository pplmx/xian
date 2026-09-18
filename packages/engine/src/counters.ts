/**
 * 计数器的基准快照 —— "从哪一刻算起"。
 *
 * 「今日斩妖 15」「本世斩敌 400」「本赛季攒够 10000 灵石」都是同一个问题:
 * **一个只增不减的计数器,怎么同时回答"生涯一共多少"与"这一段多少"**。
 *
 * 答案不是把计数器清零(清零会把生涯累计一起抹掉,成就与图鉴全废),而是**打基准快照**:
 * 起算那一刻把计数器原样记一份,之后"这一段"就是 `当前 − 基准`。同一份计数器于是能同时
 * 回答两个问题,而基准永远不会漏(它是死数据,不需要任何地方记得"顺手加一")。
 *
 * 两条边界也在这里定清楚:
 *   · **增量夹到 ≥ 0**:回档、坏档、跨期倒挂都会让"当前 < 基准",负增量会让进度条显示
 *     负数,还会让"够不够"的判定永远为真(白送奖励);
 *   · **缺基准按 0 起算**:基准里没有这个键(上一期还没这个计数器)不等于"这一段已经做完"。
 *
 * `tasks.ts`(周期任务板)用的就是这一组原语;作品自己的"本世 / 本赛季 / 本次活动"
 * 也该用同一份,而不是各写一遍减法。
 */

/** 计数器账:键由作品定,值只增不减 */
export type CounterMap = Readonly<Record<string, number>>

/** 打基准快照:把此刻的计数器原样记一份(键值都取有限数,坏值当 0) */
export function snapshotOf(counters: CounterMap): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(counters)) {
    out[key] = Number.isFinite(value) ? value : 0
  }
  return out
}

/** 自基准以来的增量:夹到 ≥ 0(坏值当 0) */
export function deltaOf(base: number, now: number): number {
  const raw = (Number.isFinite(now) ? now : 0) - (Number.isFinite(base) ? base : 0)
  return raw > 0 ? raw : 0
}

/** 某个计数器的本期增量:当前 − 基准,夹到 ≥ 0;缺基准按 0 起算 */
export function deltaSince(base: CounterMap, counters: CounterMap, key: string): number {
  return deltaOf(base[key] ?? 0, counters[key] ?? 0)
}
