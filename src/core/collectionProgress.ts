export interface CollectionProgressCategory {
  key: string;
  name: string;
  known: number;
  total: number;
  newCount: number;
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
  const newRows = rows.filter((row) => row.newCount > 0);
  const nearestRows = rows
    .filter((row) => !row.complete && row.known > 0)
    .sort(
      (a, b) =>
        b.ratio - a.ratio ||
        a.remaining - b.remaining ||
        categories.findIndex((category) => category.key === a.key) -
          categories.findIndex((category) => category.key === b.key),
    );
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
