export interface CollectionProgressCategory {
  key: string;
  name: string;
  known: number;
  total: number;
  newCount: number;
}

/** 图鉴侧的最小条目形状：只认 id 与收录深度，不把 UI 文案搬进 core。 */
export interface CollectionCodexCategory {
  key: string;
  name: string;
  entries: readonly { id: string; stage: number }[];
}

export interface CollectionProgressRow extends CollectionProgressCategory {
  ratio: number;
  remaining: number;
  complete: boolean;
}

export interface CollectionProgressOverview {
  rows: CollectionProgressRow[];
  known: number;
  total: number;
  newCount: number;
  newRows: CollectionProgressRow[];
  nearestRows: CollectionProgressRow[];
  initialOpenKeys: string[];
}

export const COLLECTION_INITIAL_OPEN_MAX = 3;

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

/**
 * 把九册图鉴的收录数折成卷首与册目共用的读数。
 * 已录数、总数与新得数都由调用方从同一份 Codex 条目派生，这里只做汇总与排序。
 */
export function collectionProgressOverview(
  categories: readonly CollectionProgressCategory[],
): CollectionProgressOverview {
  const orderOf = new Map(categories.map((category, index) => [category.key, index]));
  const rows = categories.map((category) => {
    const total = Math.max(0, finiteInt(category.total));
    const known = Math.min(total, Math.max(0, finiteInt(category.known)));
    const newCount = Math.min(known, Math.max(0, finiteInt(category.newCount)));
    return {
      ...category,
      known,
      total,
      newCount,
      ratio: total > 0 ? known / total : 0,
      remaining: Math.max(0, total - known),
      complete: total > 0 && known >= total,
    };
  });
  const byCategoryOrder = (a: CollectionProgressRow, b: CollectionProgressRow) =>
    (orderOf.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
    (orderOf.get(b.key) ?? Number.MAX_SAFE_INTEGER);
  const newRows = rows
    .filter((row) => row.newCount > 0)
    .sort((a, b) => b.newCount - a.newCount || b.ratio - a.ratio || byCategoryOrder(a, b));
  const nearestRows = rows
    .filter((row) => !row.complete && row.known > 0)
    .sort((a, b) => b.ratio - a.ratio || a.remaining - b.remaining || byCategoryOrder(a, b));
  return {
    rows,
    known: rows.reduce((sum, row) => sum + row.known, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
    newCount: rows.reduce((sum, row) => sum + row.newCount, 0),
    newRows,
    nearestRows,
    initialOpenKeys:
      newRows.length > 0
        ? newRows.slice(0, COLLECTION_INITIAL_OPEN_MAX).map((row) => row.key)
        : nearestRows.slice(0, 1).map((row) => row.key),
  };
}

/**
 * 九册图鉴的卷首读数只从 CodexEntry.stage 派生。
 *
 * 人物页入口与藏珍页此前各数一遍：一边数 quests.collections 的 id，一边数
 * stage ≥ 1。装备「已入目」、灵材「已辨识」、悟道「已见」都可能是 stage 1
 * 而尚未进收藏 id 的合法状态，两处迟早分叉。这里把「已录」与「新得」的判据
 * 一起收口，页面只负责把同一份九册递进来。
 */
export function collectionProgressOverviewFromCodex(
  categories: readonly CollectionCodexCategory[],
  isNew: (categoryKey: string, id: string) => boolean = () => false,
): CollectionProgressOverview {
  return collectionProgressOverview(
    categories.map((category) => {
      const knownEntries = category.entries.filter((entry) => entry.stage >= 1);
      return {
        key: category.key,
        name: category.name,
        known: knownEntries.length,
        total: category.entries.length,
        newCount: knownEntries.filter((entry) => isNew(category.key, entry.id)).length,
      };
    }),
  );
}
