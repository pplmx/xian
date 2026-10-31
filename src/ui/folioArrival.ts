import { cnNumber } from "@/utils/format";
import { navigationPositionOf } from "./navigation";

/**
 * 翻到下一页后交给读屏的一句短报。
 *
 * 视觉上卷首、顶栏和书口签已经同时换了一页，但单页应用只替换 DOM，
 * 读屏不会自己宣布「现在到了哪一册」。这里仍从玄枢册目取卷次与册次，
 * 不另写一份路由标题。
 */
export function folioArrivalTextOf(routeName: unknown): string {
  const position = typeof routeName === "string" ? navigationPositionOf(routeName) : null;
  if (!position) return "";
  return `已翻至第${cnNumber(position.sectionIndex + 1)}卷「${position.section.label}」第${cnNumber(
    position.entryIndex + 1,
  )}册「${position.entry.label}」`;
}
