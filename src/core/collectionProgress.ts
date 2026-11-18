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
  /** `name` 可选 —— 本模块的进度读数只用 id 与 stage，而「最近收录」要报得出名字 */
  entries: readonly { id: string; stage: number; name?: string }[];
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
  /**
   * 最薄的那一册 —— 完赛度最低、且还有剩的那一册。
   *
   * ## 它答的不是「哪一册快集齐了」（第 558 轮）
   *
   * `nearestRows` 按 **ratio 降序**排,答的是「哪一册再补一点就满了」——
   * 那是对**收尾**有用的读数。
   *
   * 而玩家翻到图鉴卷首时更常问的是另一句:**「我该去补哪一册」**。
   * 那一册的答案在**另一端**:完赛度最低的那册。此前没有任何一格答它。
   *
   * 空册（total 为 0）不参与 —— 它没有「薄」可言，分母是零。
   */
  thinnest: CollectionProgressRow | null;
  /**
   * 最快能补完的那一册 —— 完赛度最高的那册，且还有剩。
   *
   * ## 与 `thinnest` 成对（第 559 轮）
   *
   * ```text
   *   thinnest   ratio 升序   「我该去补哪一册」   —— 缺口最大的
   *   nearest    ratio 降序   「哪一册快集齐了」   —— 差得最少的
   * ```
   *
   * `nearestRows` 此前**只用来决定自动展开哪一格**（`initialOpenKeys`），
   * 它算出的「哪一册快集齐了」这个信息从未显示给玩家。
   * 玩家翻图鉴时那是个真问题:哪一册再补几件就满了。
   */
  nearest: CollectionProgressRow | null;
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
  /*
   * 最薄那一册:按 ratio 升序取第一个，同 ratio 时取剩余多的那册
   * （同样薄的情况下，剩得多的那册更值得去补）。
   * 只挑**还有剩**的 —— 已集齐的册子不是「薄」。
   */
  const thinnestRows = rows
    .filter((row) => !row.complete && row.total > 0)
    .sort((a, b) => a.ratio - b.ratio || b.remaining - a.remaining || byCategoryOrder(a, b));

  return {
    rows,
    thinnest: thinnestRows[0] ?? null,
    /* 与 thinnest 同一条筛选，只是排序相反 —— 已集齐的不是「快」，空册没意义 */
    nearest: thinnestRows.length > 0 ? thinnestRows[thinnestRows.length - 1]! : null,
    known: rows.reduce((sum, row) => sum + row.known, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
    newCount: rows.reduce((sum, row) => sum + row.newCount, 0),
    newRows,
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

/**
 * 最近收录的三条 —— 「我刚刚收了什么」。
 *
 * ## 为什么它要单开一个纯函数（第 565 轮）
 *
 * `quests.collectedAt` 记着每一条**首次收录**的时刻，而它此前只用来判
 * 「是不是新得的」（`isEntryNew`，与「上次打开图鉴」比）。**从没用来排序** ——
 * 九柜一律按 `byBest`（品阶 / 深度）排，那是「这一册里什么最好」的答案，
 * 而不是「我刚刚收了什么」。
 *
 * 两者不是一回事：前者回答「该看哪一条」，后者回答「上次之后发生了什么」。
 *
 * ## 口径
 *
 * ```text
 * 只取 stage >= 1   —— 未收录的没有收录时刻
 * 时刻必须 > 0      —— 老存档缺这一栏时是 0，不能当成 1970 年
 * 同一时刻按名字排  —— 排序要稳定，否则同一份存档刷新两次顺序会变
 * ```
 *
 * @param categories 九册（只用得到 key / name / entries）
 * @param collectedAtOf 取某条首次收录时刻的回调；返回 0 / 负数 / 非数一律视为没记
 * @param limit 取前几条
 */
export function recentCollects(
  categories: readonly CollectionCodexCategory[],
  collectedAtOf: (categoryKey: string, id: string) => number,
  limit = 3,
): { categoryKey: string; categoryName: string; id: string; name: string; at: number }[] {
  const rows: {
    categoryKey: string;
    categoryName: string;
    id: string;
    name: string;
    at: number;
  }[] = [];
  for (const category of categories) {
    for (const entry of category.entries) {
      if (entry.stage < 1) continue;
      const raw = collectedAtOf(category.key, entry.id);
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
      rows.push({
        categoryKey: category.key,
        categoryName: category.name,
        id: entry.id,
        /* 没有名字时退回 id —— 界面宁可显示一个 id，也不显示空字符串 */
        name: entry.name ?? entry.id,
        at: raw,
      });
    }
  }
  /*
   * 时刻降序；同一时刻按名字升序 —— 没有第二条键时，`Array#sort` 在部分引擎上
   * 不稳定，同一份存档刷新两次顺序会变。
   */
  rows.sort((a, b) => b.at - a.at || a.name.localeCompare(b.name, "zh"));
  return rows.slice(0, Math.max(0, limit));
}

/**
 * 九柜里「参到什么程度」—— 一册有几条走到了最深的那一档。
 *
 * ## 它答的是哪个问题
 *
 * 图鉴每一条都有自己的收录深度（`stage`）:
 *
 * ```text
 *   丹药   未录 → 已录 → 已得方 → 通晓
 *   法宝   未录 → 已录 → 曾祭炼 → 祭炼圆满
 *   装备   未录 → 已入目 → 曾上手 → 见过天品
 *   灵兽   未录 → 已结缘 → 曾相伴 → 相伴中
 *   功法   未见 → 已见 → 已择
 *   灵材   未识 → 已辨识 → 已知性 → 已通用
 * ```
 *
 * 而九柜此前只报「录了几条」（`known / total`）——
 * 录了 80 条、其中 0 条通晓，与 80 条全通晓，界面说同一句话。
 *
 * ## 口径
 *
 * ```text
 * 顶档 = 这一册 entries 里出现过的最大 stage
 *        —— 名称表在 ui/codex，而这里只用得到「第几档」，不引那份表
 * 只数 stage >= 1 的 —— 未录的由 known/total 单独报
 * 一册一条都没录时跳过 —— 界面不印一排 0
 * ```
 */
/**
 * 六册的档数（含「未录」那一档），与 `ui/codex` 的 `*_STAGE_NAMES` 长度一致。
 *
 * 这份表必须在这里，因为「顶档是哪一档」是**这一册的定义**，不是玩家当前进度。
 * 若从玩家已录条目的最大 stage 推顶档，一位只收到「已录」的玩家
 * 会看到「通顶 20」—— 而他一条都没通晓（第 238 轮修正）。
 *
 * 只有这六册有「参到什么程度」可言；gongfa / event / talent 三册是二态的
 * （收 / 未收），没有中间档，故不在此表 —— 它们也就不会印通顶读数。
 */
const STAGE_DEPTH_BY_KEY: Record<string, number> = {
  equip: 4,
  artifact: 4,
  pill: 4,
  pet: 4,
  branch: 3,
  material: 4,
};

export interface CollectionStagePeak {
  /**
   * 册的 key —— 界面靠它对回柜面。
   *
   * 不能用 `name` 去对：那是给人看的册名，两册同名（或将来改过名）
   * 就会静默对错格，而错的那格会显示「通顶 0」—— 看起来像真的还没通顶。
   */
  key: string;
  /** 册名 */
  name: string;
  /** 走到最深那一档的条数 */
  peakCount: number;
  /** 已录条数（stage >= 1） */
  known: number;
}

export function collectionStagePeak(
  categories: readonly CollectionCodexCategory[],
): CollectionStagePeak[] {
  const out: CollectionStagePeak[] = [];
  for (const category of categories) {
    const depth = STAGE_DEPTH_BY_KEY[category.key];
    /* 二态册（收 / 未收）没有「参到什么程度」可言 —— 不报 */
    if (depth === undefined) continue;
    const topStage = depth - 1;
    let known = 0;
    let peak = 0;
    for (const entry of category.entries) {
      if (entry.stage < 1) continue;
      known += 1;
      if (entry.stage >= topStage) peak += 1;
    }
    if (known === 0) continue;
    out.push({ key: category.key, name: category.name, peakCount: peak, known });
  }
  return out;
}
