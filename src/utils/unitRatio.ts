/**
 * 0~1 比例的夹取 —— 进度条、仪表盘、环图共用的那一件小事。
 *
 * `Math.max(0, Math.min(1, x))` 这句全仓写了三十来处,看上去朴素,却有一个
 * 不显眼的洞:**`NaN` 会原样穿过去**(`Math.min(1, NaN)` 是 `NaN`,
 * `Math.max(0, NaN)` 还是 `NaN`)。而这类比例几乎都是拿去拼 CSS 的
 * ——`width: NaN%` 不报错、不警告,那一条样式被浏览器整条丢弃,
 * 于是进度条**停在 0 或者干脆不出现**,而控制台一片干净。
 *
 * 三个仪表盘组件(SettingsCompass / LegacyWheel / BuildAtlas)各自意识到了这点,
 * 于是各写一遍 `Number.isFinite` 守卫;其余二十多处没有。
 *
 * 故把「夹到 0~1 且脏值归零」收成这一处:
 *  - 非有限值(NaN / ±Infinity)→ 0。ProgressBar 的语义是「没有进度」,
 *    而不是「进度不明」——后者没有可画的样子。
 *  - 其余按 0~1 夹。
 *
 * 注意它**不**做四舍五入、不转百分比字符串:那些各有各的格式化函数
 * (formatPercent / 各仪表盘的刻度),这里只管「这个数能不能直接当比例用」。
 */
export function unitRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
