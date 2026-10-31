import {
  NAVIGATION_ENTRIES,
  navigationPositionOf,
  type NavigationEntry,
  type NavigationPosition,
} from "./navigation";

export interface FolioTurnNeighbors {
  position: NavigationPosition;
  index: number;
  total: number;
  previous?: NavigationEntry;
  next?: NavigationEntry;
}

/**
 * 卷末翻页签只按玄枢图的册序取前后,不另写一份页面顺序。
 *
 * 欢迎页与建号页尚未入册,返回 null;正式游戏页不论从底部、书脊还是玄枢图
 * 进入,翻页签都会落到同一本总目里的相邻两册。
 */
export function folioTurnNeighborsOf(
  routeName: string | symbol | null | undefined,
): FolioTurnNeighbors | null {
  const position = navigationPositionOf(routeName);
  if (!position) return null;
  const index = NAVIGATION_ENTRIES.findIndex((entry) => entry.name === position.entry.name);
  if (index < 0) return null;
  return {
    position,
    index,
    total: NAVIGATION_ENTRIES.length,
    previous: index > 0 ? NAVIGATION_ENTRIES[index - 1] : undefined,
    next: index + 1 < NAVIGATION_ENTRIES.length ? NAVIGATION_ENTRIES[index + 1] : undefined,
  };
}
