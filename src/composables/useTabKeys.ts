/**
 * 页签栏的方向键导航 —— 算出「该把焦点挪到第几个」。
 *
 * ## 为什么单独一个函数
 *
 * 这段逻辑原先在 `LegacyChapterRail` 与 `MarketChapterRail` 里**逐字相同地**
 * 各写一遍(11 行)。两处都做对了,但这类「索引怎么绕」的算术最容易改漏一处:
 * 向左越界要 `-1 + count`,向右要 `% count`,少个 `+ count` 就会算出 -1 并把焦点
 * 送到列表末尾 —— 而屏幕上什么都看不出来。
 *
 * 两个组件的**其余部分**差异很大(一个 `<section>` 一个 `<div>`,一个用 `<button>`
 * 一个用 `LedgerTally`),故只提这一个纯函数,不硬凑一个组件基类。
 *
 * ## 口径
 *
 * 返回目标索引;`-1` 表示这个键不管(调用方直接 return)。
 * 只管算索引,**不碰 DOM、不改选中态** —— 那两件事各组件做法不同。
 */
export interface TabKeyResult {
  /** 目标索引;-1 = 这个键不归本组件管 */
  index: number;
  /** 是否需要 `preventDefault`(方向键会滚动页面,Home/End 会跳文档) */
  handled: boolean;
}

export function tabKeyTarget(key: string, current: number, count: number): TabKeyResult {
  if (count <= 0) return { index: -1, handled: false };
  let index = -1;
  if (key === "ArrowRight") index = (current + 1) % count;
  else if (key === "ArrowLeft") index = (current - 1 + count) % count;
  else if (key === "Home") index = 0;
  else if (key === "End") index = count - 1;
  return { index, handled: index >= 0 };
}
