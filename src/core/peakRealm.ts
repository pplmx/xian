/**
 * 历世足迹 —— 转世会把境界折回起点,而「你到过哪里」不该跟着一起忘掉。
 *
 * ## 为什么这是一本必须单独立的账
 *
 * 转世时 `player.major` 被折回起点(见 stores/player 的 rebirth),这是**规则**:
 * 新的一世从炼气重新开始。可它同时抹掉了另一件事 —— **这一号人物曾经走到哪一境**。
 * 界域志上,真仙那一行于是永远显示「未至」,哪怕你上个月刚从那里转世下来。
 *
 * 界面上因此有一处说不通:历世履历(x.data/samsara 的 LifeRecord)逐世记着终点境界,
 * 可那要翻七层才读得到;而界域志 —— 专门讲境界的那一页 —— 只知道**当下**。
 *
 * ## 它与「当下」是两件事,不能合并
 *
 *   当前境 —— 会随转世归零,决定你可做什么(gates、掉落、可学功法)。
 *   最远境 —— 只增不减,只用来**读**:谱上那一行盖「曾至」,卷首报一行「此身曾至」。
 *
 * 合并成一个字段就等于让门槛跟着历史放宽 —— 那是另一套游戏。所以这里是
 * **只读的记账**,不参与任何分支判断(见下方 README 式的断言:本模块不 import 任何
 * 结算 / 门槛模块)。
 *
 * ## 存哪儿
 *
 * 它属于**玩家本身**,不属于某一世,故存 `player.reincarnation.peakMajor` ——
 * 那个对象本来就跨世存活(count / lives / heritage 都在里面)。坏档一律夹回
 * [0, MAX_MAJOR],与 major 的 sanitize 同一口径。
 */
import { MAX_MAJOR } from "@/data/realms";

/** 把任意值夹成合法的大境界下标 */
export function clampPeakMajor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_MAJOR, Math.trunc(value)));
}

/**
 * 记一笔「到过这里」。
 *
 * 只增不减:reached 比记账高时才刷新 —— 转世折回起点不会把足迹抹掉,
 * 手改档写一个更大的数也不会被拒(那本来就该算到过)。
 *
 * @returns 是否真的刷新了(调用方据此决定要不要说一声)
 */
export function notePeakMajor(
  current: unknown,
  reached: number,
): { peak: number; raised: boolean } {
  const peak = clampPeakMajor(current);
  const next = clampPeakMajor(reached);
  if (next <= peak) return { peak, raised: false };
  return { peak: next, raised: true };
}
