import { NAVIGATION_SECTIONS, navigationPositionOf } from "./navigation";

/** 当前路由落在哪一卷；未入册时回第一卷，玄枢图打开后总有可跳之处。 */
export function atlasSectionIdForRoute(name: string | symbol | null | undefined): string {
  return navigationPositionOf(name)?.section.id ?? NAVIGATION_SECTIONS[0]!.id;
}

/**
 * 五卷快引的键盘游标。
 *
 * 左/右循环，Home/End 落到两端；其余按键原样返回，交给浏览器处理。
 * 单独抽成纯函数，避免组件里再手写一套与卷数绑死的分支。
 */
export function atlasJumpIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  const index = Math.max(0, Math.min(count - 1, Number.isFinite(current) ? current : 0));
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}
