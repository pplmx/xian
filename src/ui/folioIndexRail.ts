import { NAVIGATION_SECTIONS, navigationPositionOf } from "./navigation";

export interface FolioIndexRailItem {
  key: string;
  label: string;
  mark: string;
  to: string;
  hint: string;
  active: boolean;
}

/** 五卷书口签：始终从玄枢图同一份目录生成，每卷落到首册。 */
export function volumeRailItems(
  routeName: string | symbol | null | undefined,
): FolioIndexRailItem[] {
  const current = navigationPositionOf(routeName);
  return NAVIGATION_SECTIONS.map((section) => ({
    key: section.id,
    label: `${section.label}卷`,
    mark: section.label.slice(0, 1),
    to: section.entries[0]?.to ?? "/",
    hint: section.hint,
    active: current?.section.id === section.id,
  }));
}

/** 本卷册口签：把同卷兄弟册摊在卷首，当前册留朱砂落点。 */
export function chapterRailItems(
  routeName: string | symbol | null | undefined,
): FolioIndexRailItem[] {
  const current = navigationPositionOf(routeName);
  if (!current) return [];
  return current.section.entries.map((entry) => ({
    key: entry.name,
    label: entry.label,
    mark: entry.label.replace(/\s/g, "").slice(0, 1),
    to: entry.to,
    hint: entry.description,
    active: entry.name === current.entry.name,
  }));
}
