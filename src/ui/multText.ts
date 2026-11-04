/**
 * 倍数的写法 —— 同一个 ×1.2,两处印成两个样子。
 *
 * ## 问题:直接插值 vs toFixed
 *
 * 这一作里「倍数」是到处都有的概念:灵根成长、宗门契合、时间兑换、共鸣厚度、
 * 传承收益…… 而它的写法至少有三种:
 *
 *   `×{{ growthMult.toFixed(2) }}`            → ×1.20
 *   `×${view.nextLinggen.growthMult}`         → ×1.2(值是 round2 过的数字)
 *   `Number(x.toFixed(2)).toString()`         → 1.2(连尾部零一起去掉)
 *
 * 同一个 1.2,在人物页印「×1.20」,在转世确认页印「×1.2」。两处说的是同一个数,
 * 看上去却像两个精度。
 *
 * `core/battleAnalysis` 里那句 `ratioText` 说明有人已经注意到了 —— 它先 round 再
 * `toFixed(2)`,把两种写法合成一种。但那只在战斗分析那一处,别处各写各的。
 *
 * ## 这一轮怎么收
 *
 * 抽一个 `multText(n)`:固定两位小数,去掉尾部的零,统一带 `×` 前缀。
 * 为什么保留两位再削零而不是直接 `toFixed(2)`:倍率差 0.01 是有意义的
 * (灵根 1.02 与 1.03 差的是整条修速曲线),故**精度保两位**;
 * 但 1.20 与 1.2 是同数,尾部零只占位置,削掉。
 *
 * 与 `utils/format` 的分工:那里管百分数、时长、大数;倍率是本作自己的一档说法
 * (它总要带一个 `×`),放 `ui/multText`。
 */

/** 倍数的写法:两位精度、削尾零、带 × 前缀 */
export function multText(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  // 先定两位再削零:1.20 → "1.2"、1.00 → "1"、1.005 → "1.01"
  const fixed = rounded.toFixed(2).replace(/\.?0+$/, "");
  return `×${fixed}`;
}
