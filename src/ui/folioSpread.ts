export type FolioLayout = "spread" | "single";

const SPREAD_ROUTES = new Set(["home", "cultivation", "character"]);

/**
 * 宽屏版式只给能成对阅读的主册。
 *
 * 两栏不是「屏幕够宽就自动切开」:历练页还有一整段顺序说明与地区清单,
 * 硬切会把阅读顺序拆散。那些页仍走一张 48rem 的单叶。
 */
export function folioLayoutOf(routeName: unknown): FolioLayout {
  return typeof routeName === "string" && SPREAD_ROUTES.has(routeName) ? "spread" : "single";
}
