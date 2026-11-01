export type InventoryChapterKey = "briefing" | "seats" | "collection";

export interface InventoryChapter {
  key: InventoryChapterKey;
  index: string;
  title: string;
  hint: string;
}

const CHAPTER_SPECS = [
  {
    key: "briefing",
    index: "壹",
    title: "今日检点",
    hint: "新得在前,可换只看真实战差",
  },
  {
    key: "seats",
    index: "贰",
    title: "九佩",
    hint: "九席随身,空悬与可换各归其位",
  },
  {
    key: "collection",
    index: "叁",
    title: "藏品",
    hint: "一册续排,新得先列",
  },
] satisfies InventoryChapter[];

/**
 * 行囊续卷只装配阅读顺序与章名。
 *
 * 容量、新得、换装候选和九席事实仍由 InventoryView 直读原结算函数;
 * 这里不另算第二份账。
 */
export function inventoryChapters(): InventoryChapter[] {
  return CHAPTER_SPECS.map((chapter) => ({ ...chapter }));
}

export function inventoryChapter(key: InventoryChapterKey): InventoryChapter {
  const chapter = inventoryChapters().find((candidate) => candidate.key === key);
  if (!chapter) throw new Error(`unknown inventory chapter: ${key}`);
  return chapter;
}
