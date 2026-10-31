export type FolioLayout = "spread" | "wide" | "single";

const SPREAD_ROUTES = new Set(["home", "cultivation", "inventory", "character", "collection"]);
const WIDE_ROUTES = new Set([
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
 * 「双页」只给能稳定落成「主账 + 清单 / 选择 + 细节」的主册;这五页直接切成
 * 两栏也不会打断顺序。历练、地界、坊市、构筑、轮回这类页面内部已有两到三栏
 * 账目,硬切双页反而会把同一件事拆散,故只放宽成 60rem 的「宽案」,仍沿一条
 * 阅读顺序。设置这类线性读卷留在 48rem,避免把说明文字拉成长行。
 */
export function folioLayoutOf(routeName: unknown): FolioLayout {
  if (typeof routeName !== "string") return "single";
  if (SPREAD_ROUTES.has(routeName)) return "spread";
  if (WIDE_ROUTES.has(routeName)) return "wide";
  return "single";
}
