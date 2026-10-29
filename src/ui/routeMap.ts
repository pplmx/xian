export interface RoutePoint {
  x: number;
  y: number;
}

function coord(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * 把路线节点连成一条有坡度的手卷。
 *
 * 节点之间用水平切线过渡，而不是折线直连：折线读起来像统计图，
 * 手卷里的山路则应当从一处山坳缓缓翻到下一处。x 由 worldView 保证递增，
 * 这里只负责把同一组坐标画顺，不重新解释层级或路程。
 */
export function smoothRoutePath(points: readonly RoutePoint[]): string {
  const first = points[0];
  if (!first) return "";
  let path = `M ${coord(first.x)} ${coord(first.y)}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const point = points[i]!;
    const mid = (prev.x + point.x) / 2;
    path +=
      ` C ${coord(mid)} ${coord(prev.y)}` +
      ` ${coord(mid)} ${coord(point.y)}` +
      ` ${coord(point.x)} ${coord(point.y)}`;
  }
  return path;
}

/**
 * 已走路线的实线只画到最后一个已通节点。
 *
 * 不能用「已通段数 / 总段数」当 pathLength 比例：节点之间按真实层级跨度
 * 分配横距，等比例截线会在一段还没走完时就越过节点，视觉进度比事实快。
 */
export function clearedRoutePath(points: readonly RoutePoint[], clearedCount: number): string {
  const count = Math.max(0, Math.min(points.length, Math.floor(clearedCount)));
  return count < 2 ? "" : smoothRoutePath(points.slice(0, count));
}
