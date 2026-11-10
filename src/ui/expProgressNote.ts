/**
 * 「还剩 N%」—— 四舍五入到整数，会在刚起步时撒谎
 *
 * ## 缺口:进度条几乎空着，旁边却写「还剩 100%」
 *
 * `CultivationView` 的本境账上有一条:
 *
 * ```text
 *   本境修为   5.142亿 / 29.69兆            ← 进度条几乎为空(0.17%)
 *   还剩 100% · 约 1天11小时                 ← 四舍五入到整数
 * ```
 *
 * 算式是 `formatPercent(1 - player.expProgress, 0)`:本境刚起步时
 * `expProgress ≈ 0.0017`,于是 `1 - 0.0017 = 0.9983` → 取整 **100%**。
 * 玩家看到的是「进度条没动 + 还剩 100%」,最自然的解读是**卡住了**。
 *
 * ## 不是精度不够,是方向错了
 *
 * 「还剩 100%」在语义上等于「一点没动」,可玩家明明已经攒了 5.1 亿。
 * 真正要报的是**已经走了多少**:把 `1 - x` 换成 `x`,刚起步是 0%,
 * 攒到 0.5% 才进 1%,永远不会出现「动了却显示没动满」。
 *
 * 而刚起步时连「0%」也没信息量,故**不足 1% 时说「刚起步」** ——
 * 把那个几乎为空的状态说成人话,而不是一个读起来像卡住的百分数。
 *
 * 与 `ui/lifeFootprint`、`ui/blueprintProgress` 同一层:只算,不读 store。
 */

/** 不足这个比例时说「刚起步」而不是报 0% */
const JUST_STARTED = 0.01;
/**
 * 超过这个比例、却还没走满时说「将至」而不是报 100%。
 *
 * 与「刚起步」同一个道理的另一头:0.996 取整是 **100%**,而进度条上明明还差一截、
 * 时长还写着「约 1 分」—— 「已成 100% · 约 1 分」比原来的「还剩 100%」更荒唐。
 * 两头都要收口,否则只是把问题从左边挪到了右边。
 */
const ALMOST_DONE = 0.995;

/** 把比值夹回 [0, 1];坏值按 0 处理 */
function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * 本境账上那一句:已走多少 + 还差多久。
 *
 * @param expProgress 本境修为的完成比例(0~1)
 * @param etaText     预计还差多久(`expEtaText`,已格式化)
 */
export function expProgressNote(expProgress: number, etaText: string): string {
  const ratio = clampProgress(expProgress);
  if (ratio < JUST_STARTED) {
    return `刚起步 · ${etaText}`;
  }
  /*
   * 取整而不是保留小数:`统计`这一行跟着一条进度条,
   * 条已经表达了细粒度;数字报整百分数才读得快。
   */
  /*
   * 走满了(恰为 1)才报 100%;0.995~1 之间还有一截,报「将要圆满」。
   * 这两档必须分开 —— 否则「走满」那一步永远显示不出来。
   */
  if (ratio >= 1) {
    return `已圆满 · ${etaText}`;
  }
  if (ratio >= ALMOST_DONE) {
    return `将要圆满 · ${etaText}`;
  }
  /*
   * 取整而不是保留小数:这一行跟着一条进度条,条已经表达了细粒度;
   * 数字报整百分数才读得快。
   */
  const percent = Math.round(ratio * 100);
  return `已成 ${percent}% · ${etaText}`;
}
