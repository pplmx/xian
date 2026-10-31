import { navigationPositionOf } from "./navigation";

export interface FolioIndexRailItem {
  key: string;
  label: string;
  shortLabel: string;
  mark: string;
  to: string;
  hint: string;
  active: boolean;
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
    shortLabel: entry.shortLabel,
    mark: entry.label.replace(/\s/g, "").slice(0, 1),
    to: entry.to,
    hint: entry.description,
    active: entry.name === current.entry.name,
  }));
}
