import { navigationPositionOf } from "./navigation";

/** 翻卷方向只由玄枢目录决定:后册向前翻,前册向回翻,开局与未知页横向淡入。 */
export type FolioTurnDirection = "forward" | "back" | "cross";

export function folioTurnDirectionOf(
  fromName: string | symbol | null | undefined,
  toName: string | symbol | null | undefined,
): FolioTurnDirection {
  const from = navigationPositionOf(fromName);
  const to = navigationPositionOf(toName);
  if (!from || !to || from.entry.name === to.entry.name) return "cross";
  if (to.sectionIndex !== from.sectionIndex) {
    return to.sectionIndex > from.sectionIndex ? "forward" : "back";
  }
  return to.entryIndex > from.entryIndex ? "forward" : "back";
}
