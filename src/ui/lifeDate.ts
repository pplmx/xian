/**
 * 历世履历 · 每一世都该有道历
 *
 * ## 缺口:同一页里,一处有道历、另一处没有
 *
 * `LifeRecord.at` 是那一世的归档时刻。同一份 `LifeRecord[]` 在修仙录里被用在两处:
 *
 * ```text
 *   长恨录(未了之缘)   formatDate(l.at)   → 印了日期
 *   历世履历            ——                → 一个字都没有
 * ```
 *
 * 于是玩家读到「第 3 世 · 元婴境 · 寿 210 载」,却不知道那是**什么时候**的事。
 * 一份十世的履历没有年份,回望时少了一条最自然的索引:我上一次转世是几天前?
 *
 * ## 为什么带年份,而不复用 `formatDate`
 *
 * `formatDate` 给的是「M月D日」—— 那是给**本世**的近事用的(长恨录只记这一世的缘)。
 * 历世履历横跨十世,可能跨年;只印「3月5日」会让两个不同年份的世看起来挨着。
 * 故另给一个 `lifeDateText`,带年份。
 *
 * ## 读不出就不印,不拿 0 冒充
 *
 * `at` 在类型上必填,但老存档可能是 0 或缺失。`new Date(0)` 会给出一个真实存在
 * 但错误的日期(1970 年)—— 那比不印更糟。故 0 / 负数 / 非有限值一律当作「没有」,
 * 由调用方整条不出。
 *
 * ## 这一层只算,不读 store
 *
 * 与 `ui/lifeLinggen`、`ui/lifeFootprint` 同一条纪律:收参数、给纯值。
 */

/**
 * 归档时刻 → 一句道历(带年份)。
 *
 * `at` 读不出(0 / 负数 / NaN / Infinity / 非数)时返回空串 —— 调用方据此整条不出。
 * 空串而不是 null:模板里 `v-if` 对空串与 null 都是 falsy,但空串更好读。
 */
export function lifeDateText(at: unknown): string {
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return "";
  const d = new Date(at);
  // 时间戳合法但 Date 无效(超出可表示范围)时同样不印
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
