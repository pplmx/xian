import type { CollectionProgressRow } from "@/core/collectionProgress";

/** 九册的单字印。册名可以更长，卷首与格架只留这一枚便于扫读。 */
export const COLLECTION_CATEGORY_MARKS: Record<string, string> = {
  equip: "器",
  gongfa: "功",
  branch: "悟",
  pill: "丹",
  material: "材",
  artifact: "宝",
  pet: "兽",
  event: "闻",
  talent: "赋",
};

/** 成就方向同取一枚单字印；未知方向退回首字，不另造一套条件表。 */
const ACHIEVEMENT_DIRECTION_MARKS: Record<string, string> = {
  历练征战: "战",
  地界首领: "首",
  历练: "历",
  历练际遇: "遇",
  装备: "器",
  丹药: "丹",
  炼丹: "炉",
  功法参悟: "功",
  突破与渡劫: "劫",
  轮回转世: "轮",
  器魂: "魂",
  闭关归来: "归",
  洞府经营: "府",
  境界精进: "境",
  掉落与鉴宝: "鉴",
  历程节点: "程",
};

export interface CollectionCabinetCell {
  key: string;
  mark: string;
  known: number;
  ratio: number;
  complete: boolean;
  newCount: number;
}

export function collectionCategoryMark(key: string): string {
  return COLLECTION_CATEGORY_MARKS[key] ?? key.slice(0, 1);
}

export function achievementDirectionMark(direction: string): string {
  return ACHIEVEMENT_DIRECTION_MARKS[direction] ?? direction.slice(0, 1);
}

/** 藏珍格只接九册汇总，不再从条目重数一遍。 */
export function collectionCabinetCells(
  rows: readonly CollectionProgressRow[],
): CollectionCabinetCell[] {
  return rows.map((row) => ({
    key: row.key,
    mark: collectionCategoryMark(row.key),
    known: row.known,
    ratio: row.ratio,
    complete: row.complete,
    newCount: row.newCount,
  }));
}
