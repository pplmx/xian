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

/**
 * 「把 0~1 的比例变成 CSS 百分比字符串」—— 与 `unitRatio` 成对的那一步。
 *
 * `unitRatio(x) * 100` 后拼 `%` 在本仓出现多次(进度条宽度、切换钮的滑块宽度)。
 * 拆开写没有错,但每处都在重复同一个决定:乘多少、带不带 `%`、
 * 脏值怎么办。收成一处之后,「宽度」这个语义只有一个答案。
 *
 * 仍返回字符串而不是数字:调用点要的就是能直接塞进 `style` 的值,
 * 中间那一步数字没有别的用途。
 *
 * 与 `format/@utils formatPercent` 的分工(两者输入刻度相同,都是 0~1):
 *  - `percentWidth` 用来画:**越界夹住**(50 → 100%),因为不存在 5000% 宽的条;
 *  - `formatPercent` 用来说:不夹取(50 → "5000%"),因为读数失真的警告
 *    比强行掰回 100% 更有价值,脏值则显示 "--"。
 */
export function percentWidth(value: number): string {
  return `${unitRatio(value) * 100}%`;
}

/**
 * 「已经是百分数(0~100)」的那种夹取 —— 与 `unitRatio` 同病同药,只是刻度不同。
 *
 * 全仓 `Math.max(0, Math.min(100, x))` 写了九处:身上盘的扇段长度、
 * 好感度表的仪表目标、洞府进度、背包容量、学徒进度、限时券的剩余百分比……
 * 与 `unitRatio` 一样,`NaN` 会原样穿过去,而这些数几乎都被拿去拼 CSS。
 *
 * 两个刻度分开两个函数,是因为混用它们不会有编译错误:把 0~1 的数喂给
 * 这里会得到「1%」,反过来会得到「100」——都不报错,只是画错。
 * 名字里带 Percent 的就是 0~100 的那种。
 */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
