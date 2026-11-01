import { INVENTORY_CHAPTERS } from "@/ui/navigation";

export type InventoryTab = (typeof INVENTORY_CHAPTERS)[number]["id"];

export type InventoryChapterKey =
  | "briefing"
  | "seats"
  | "collection"
  | "workshop"
  | "cabinet"
  | "craft"
  | "stock"
  | "artifact";

export interface InventoryChapter {
  key: InventoryChapterKey;
  tab: InventoryTab;
  index: string;
  title: string;
  hint: string;
}

const CHAPTER_SPECS = {
  equip: [
    {
      key: "briefing",
      tab: "equip",
      index: "壹",
      title: "今日检点",
      hint: "新得在前,可换只看真实战差",
    },
    {
      key: "seats",
      tab: "equip",
      index: "贰",
      title: "九佩",
      hint: "九席随身,空悬与可换各归其位",
    },
    {
      key: "collection",
      tab: "equip",
      index: "叁",
      title: "藏品",
      hint: "一册续排,新得先列",
    },
  ],
  pill: [
    {
      key: "workshop",
      tab: "pill",
      index: "壹",
      title: "丹房",
      hint: "开炉与补草,两处入口",
    },
    {
      key: "cabinet",
      tab: "pill",
      index: "贰",
      title: "丹匣",
      hint: "按味收存,点一格看火候",
    },
  ],
  material: [
    {
      key: "craft",
      tab: "material",
      index: "壹",
      title: "炉材",
      hint: "进炉的草、铁、尘与残页",
    },
    {
      key: "stock",
      tab: "material",
      index: "贰",
      title: "账材",
      hint: "悟道点与灵石,修行所积",
    },
  ],
  artifact: [
    {
      key: "artifact",
      tab: "artifact",
      index: "壹",
      title: "法宝",
      hint: "位次、祭炼与随身取舍",
    },
  ],
} satisfies Record<InventoryTab, readonly InventoryChapter[]>;

/**
 * 行囊四册只装配阅读顺序与章名。
 *
 * 容量、新得、换装候选、丹味、材料分组与法宝事实仍由 InventoryView
 * 直读原结算函数;这里不另算第二份账。
 */
export function inventoryChapters(tab: InventoryTab = "equip"): InventoryChapter[] {
  return CHAPTER_SPECS[tab].map((chapter) => ({ ...chapter }));
}

export function inventoryChapter(key: InventoryChapterKey): InventoryChapter {
  for (const tab of Object.keys(CHAPTER_SPECS) as InventoryTab[]) {
    const chapter = inventoryChapters(tab).find((candidate) => candidate.key === key);
    if (chapter) return chapter;
  }
  throw new Error(`unknown inventory chapter: ${key}`);
}
