/**
 * 器谱进度 —— 二百八十八张谱,只报「读通 N 张」是不够的
 *
 * ## 缺口:连续掌握度只报了到顶那一档
 *
 * 器谱的掌握度是 **0~1 的连续值**(见 `core/blueprintMastery`),每成功重铸一次
 * 增一档,满掌握才算「读通」。而修仙录「随身所知」那一行只印
 * `读通器谱 0 / 288 张`。玩家因此读不出三件真会影响决策的事:
 *
 *   · **哪些快读通了**(差一两次的那几张,再砸一锤就落地)
 *   · **下一锤该砸哪张**(288 张里挑「最接近的」,现在只能凭记忆)
 *   · 自己到底读到了几分(0.9 与 0.1 在「0/288」里长得一模一样)
 *
 * 与敌手谱同一个形状:一个连续/分档系统,界面只报了终点。
 *
 * ## 只列**读过**的,未读的不点名
 *
 * `blueprintLore[id]` 为 0 或缺失 = 一张还没研读过的谱。把它们列出来既没用
 * (288 行),也泄漏「还有哪些谱存在」—— 与图鉴的 `???` 纪律一致。
 *
 * ## 「还差几次」读引擎那一份
 *
 * 差几次由 `blueprintReforgesUntilMastered` 给 —— 它向上取整并扣浮点余量
 * (0.98 不会被算成两次),非法增量返回 `Infinity`。界面不许自己写
 * `Math.ceil((1 - x) / step)`:`Infinity` 那一档会印出「还差 Infinity 次」,
 * 而那是「这张谱的增量坏了」的意思,得单独标。
 *
 * ## 这一层只算,不读 store
 *
 * 掌握度表由调用方传入(`lore.blueprintLore`),故判据不必搭 Pinia。
 */
import {
  blueprintReforgesUntilMastered,
  clampBlueprintMastery,
  isBlueprintMastered,
} from "@/core/blueprintMastery";
import { BLUEPRINT_MASTERY_PER_REFORGE } from "@/data/constants";

/** 谱上一行 */
export interface BlueprintProgressRow {
  id: string;
  name: string;
  /** 掌握度百分数(0~100 的整数) */
  percent: number;
  /** 还差几次重铸才读通;已读通为 0;增量坏掉时为 null */
  untilMastered: number | null;
  /** 已读通 */
  mastered: boolean;
  /** 增量坏掉(不会涨)—— 界面要单独说,不能冒充已读通,也不能印 Infinity */
  stalled: boolean;
}

export interface BlueprintProgress {
  /** 读过的谱,按「差几次」从少到多排;读通的排最后 */
  rows: BlueprintProgressRow[];
  /** 读过几张 */
  known: number;
  /** 读通几张 */
  mastered: number;
  /** 其中几张已近读通(差 ≤ nearThreshold 次) */
  nearlyDone: number;
}

/**
 * 差几次之内算「已近读通」—— 再砸几锤就落地。
 *
 * 取 5 而不是 2:真实增量是 `BLUEPRINT_MASTERY_PER_REFORGE = 0.02`,也就是
 * **五十锤才读通一张**。差 2 次等于掌握度 96% 以上 —— 那种谱几乎见不到,
 * 这条汇总就会永远是「近读通 0 张」,等于没做。
 * 差 5 次(90% 以上)是玩家真会停下来想一想「要不要先砸这张」的位置。
 */
const NEAR_THRESHOLD = 5;

const EMPTY = (): BlueprintProgress => ({ rows: [], known: 0, mastered: 0, nearlyDone: 0 });

/**
 * 由掌握度表算出器谱进度。
 *
 * `perReforge` 缺省读 `BLUEPRINT_MASTERY_PER_REFORGE`;可显式传入以便判据验边界。
 */
export function blueprintProgress(
  blueprintLore: Readonly<Record<string, number>>,
  defs: readonly { id: string; name: string }[],
  options: { perReforge?: number; nearThreshold?: number } = {},
): BlueprintProgress {
  const perReforge = options.perReforge ?? BLUEPRINT_MASTERY_PER_REFORGE;
  const nearThreshold = options.nearThreshold ?? NEAR_THRESHOLD;
  const nameOf = new Map(defs.map((d) => [d.id, d.name]));

  const rows: BlueprintProgressRow[] = [];
  for (const [id, raw] of Object.entries(blueprintLore)) {
    const name = nameOf.get(id);
    // 查不到定义的谱不列 —— 不印一个没有名字的 id
    if (!name) continue;
    // 与引擎同一套夹法:坏值按尚未研读处理,超 1 夹到 1
    const mastery = clampBlueprintMastery(raw);
    const mastered = isBlueprintMastered(mastery);
    // 未读过的(掌握度 0)不点名 —— 那是图鉴 ??? 的纪律
    if (!mastered && mastery <= 0) continue;
    const until = blueprintReforgesUntilMastered(mastery, perReforge);
    const stalled = !mastered && !Number.isFinite(until);
    rows.push({
      id,
      name,
      percent: Math.round(mastery * 100),
      untilMastered: mastered ? 0 : Number.isFinite(until) ? until : null,
      mastered,
      stalled,
    });
  }
  if (rows.length === 0) return EMPTY();

  /*
   * 差得少的排前面 —— 那才是「下一锤该砸哪张」。
   * 读通的排最后(它们的 `untilMastered` 是 0,若直接按数排会跑到最前)。
   * 停滞的(增量坏掉)排在未读通那一档的最后:它们砸不动。
   * 同档按 id 稳定排,免得顺序随刷新变。
   */
  const rank = (row: BlueprintProgressRow): number => {
    if (row.mastered) return 2;
    if (row.stalled) return 1;
    return 0;
  };
  rows.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (!a.mastered && !a.stalled && !b.stalled) {
      const diff = (a.untilMastered ?? 0) - (b.untilMastered ?? 0);
      if (diff !== 0) return diff;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const mastered = rows.filter((r) => r.mastered).length;
  const nearlyDone = rows.filter(
    (r) => !r.mastered && r.untilMastered !== null && r.untilMastered <= nearThreshold,
  ).length;
  return { rows, known: rows.length, mastered, nearlyDone };
}
