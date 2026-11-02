/**
 * 分批翻页后的焦点落点 —— 四处列表共用的那一件小事。
 *
 * 续开/回翻一批之后,被点的那枚「再看 N」按钮往往已经不在原位:DOM 重排了,
 * 键盘用户与读屏会掉回页面顶部,得重新 Tab 一整轮才回到刚才那一行。
 * 所以每个分批列表都在翻完之后把焦点送到「新露出的第一件」——
 * 索引由 core/listRender 的 firstNewVisibleIndex 算出,这里只负责落焦。
 *
 * 这段逻辑原先在四个视图里各写一遍(TitlesView / LegacyView / SoulsView /
 * MarketView),写法几乎逐字相同,却各自带一份「索引越界怎么夹」——
 * 那正是最容易改漏的一行:夹错了会把焦点送到列表末尾,而屏幕上什么都看不出来。
 */
import { nextTick } from "vue";

/**
 * 等本轮渲染落地后,把焦点交给 `selector` 命中的第 `index` 件。
 *
 * - 索引越界时夹到末件(负数夹到首件):调用方算出的「新露出一件」在最后一页
 *   可能超出实际行数(批量与余量不一致时);
 * - 一件都没命中就什么都不做 —— 不是错误,列表可能已经清空。
 */
export function focusListRow(selector: string, index = 0): void {
  void nextTick(() => {
    if (typeof document === "undefined") return;
    const rows = document.querySelectorAll<HTMLElement>(selector);
    if (rows.length === 0) return;
    const at = Math.min(Math.max(0, Math.trunc(index)), rows.length - 1);
    rows[at]?.focus();
  });
}
