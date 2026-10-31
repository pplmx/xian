export type FolioLayout = "spread" | "wide" | "single";

const SPREAD_ROUTES = new Set(["cultivation", "inventory", "character", "collection"]);
const WIDE_ROUTES = new Set([
  "home",
  "adventure",
  "world",
  "celestial",
  "souls",
  "dongfu",
  "market",
  "apprentice",
  "build",
  "titles",
  "legacy",
  "codex",
]);

/**
 * 桌面按阅读密度分三档,而不是把所有页面一起拉宽。
 *
 * 「双页」只给能稳定落成「主账 + 清单 / 选择 + 细节」的四册;这些页面直接切成
 * 两栏也不会打断顺序。首页虽同样信息密集,却由自己的暗场指挥台与纸面仪表盘
 * 编排整张宽案,不再套全站双页网格;历练、地界、坊市等内部已有两到三栏账目的
 * 页面也只放宽成 60rem。设置这类线性读卷留在 48rem,避免把说明文字拉成长行。
 */
export function folioLayoutOf(routeName: unknown): FolioLayout {
  if (typeof routeName !== "string") return "single";
  if (SPREAD_ROUTES.has(routeName)) return "spread";
  if (WIDE_ROUTES.has(routeName)) return "wide";
  return "single";
}
