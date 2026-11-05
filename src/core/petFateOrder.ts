/**
 * 灵兽谱的「命途」排序 —— 把同一种走法排在一起,走法之间再排一次。
 *
 * ## 为什么灵兽谱要按命途重排
 *
 * 灵兽的性格决定历练时的行为倾向(`data/petTraits` 六种:贪宝 / 慢稳 / 好战 /
 * 谨慎 / 疾行 / 守拙)。这是「选伙伴 = 选走法」的全部依据 —— 而玩家要在四十只
 * 里挑出一只,做这个判断时,他真正想比较的是**同一种走法里哪只数值最合**。
 *
 * 按品阶降序排,六种走法被打散在四十行里:想比较「贪宝型哪只好」,得先从头
 * 到尾扫一遍,先把性格认出来,再心算把同类的凑到一起。这个本可以一眼做完的
 * 决定,被排序逼成了逐行读。
 *
 * 故灵兽谱的排序键(自外向内):
 *
 *   一 **相伴中**置顶 —— 正在身上的那只永远第一;
 *   二 **已结缘的在前** —— 未逢的沉到底下,那一段读起来是「下一步想要哪一只」的榜;
 *   三 已契这一段按**命途**(性格)聚,命途之间按「已拥有几只」降序,空命途沉底;
 *   四 热度相等时按 `data/petTraits` 的**命途定序** —— 不然两条同热度的走法会按品阶交错;
 *   五 同一命途里按**同行深浅**(相伴中 > 曾相伴 > 已结缘 > 未结缘);
 *   六 同一段同行史里再按品阶降序、id 兜底。
 *
 * 「已拥有几只」当命途间的排序键,是因为灵兽谱先看的是「我手上有哪些伙伴」——
 * 收藏得多的那几类先浮上来,比按六种性格的固定编号排更贴玩家的实际进度。
 *
 * 第四键与第五键都不是装饰,是这一版在真浏览器门(`scripts/layout-check.mjs` 的灵兽谱
 * 探针)里补出来的两处:
 *
 *   · 缺第四键,新号(或两种走法各拥三只)热度打平,贪宝与谨慎的灵兽一行行交错在一起,
 *     「按命途聚」只在收藏悬殊时才成立;
 *   · 缺第五键,一只**从没遇过**的高品阶灵兽会插在你真正的伙伴中间 —— 而谱上
 *     「伴 / 曾 / 契 / 未」这四档本来是同一份相伴史(`quests.petCompanions`)撑起来的,
 *     让未逢者压过已契者等于把这份史又拆散一次。
 *
 * ## 为什么是纯函数、不塞进视图
 *
 * 排序是判断,不是渲染:`name-ledger__entry` 那一行只负责把排好的顺序画出来。
 * 放 `core` 才能直接测、才能被别的册(将来若有)复用,也才符合本仓
 * 「core 放纯逻辑、view 只做薄接线」的分层(见 core/layeringAudit)。
 *
 * ## 命途本身的定名/定序在数据层
 *
 * 六种性格的先后、名字、一句说明都归 `data/petTraits`;这里只决定**怎么排**,
 * 不重抄一份性格表。命途标签的文字由调用方从 `PERSONALITY_NAMES` 取。
 */

// 相对路径而不是 "@/data/…":这个纯函数要能被 scripts/ 下的真浏览器门直接 import
// (bun 在那里不解析 tsconfig 的 @/ 别名)。同一条先例见 ui/codex.ts 的 ../data/statNames。
import { PET_TRAITS } from "../data/petTraits";

/**
 * 排序只认这几件事:有没有、是不是、同行到哪一步,以及它属于哪一命途。
 */
export interface FateSortRow {
  id: string;
  /** 此刻相伴 */
  active: boolean;
  /** 已结缘(拥有) */
  owned: boolean;
  /** 命途(性格 id);缺省视作「无名命途」,排在最后 */
  personality?: string;
  /** 品阶序号(rank),组内降序 */
  qualityRank: number;
  /**
   * 同行深浅:相伴中 > 曾相伴 > 已结缘 > 未结缘。
   *
   * 由调用方从 `ui/titlesDesk` 的 `PET_ENTRY_DEPTH`(与图鉴 `PET_STAGE_NAMES` 同一条
   * ladder)取一份刻度 —— core 只认数,不 import 展示层。
   */
  depthRank: number;
}

/**
 * 命途之间的**稳定次序**:取 `data/petTraits` 的书写顺序(贪宝 → 慢稳 → 好战 →
 * 谨慎 → 疾行 → 守拙)。认不出的命途排到最后。
 *
 * 这一键看着小,真浏览器门第一跑就是它漏出来的:两条命途的「已拥有几只」相等时
 * (新号谁都没几只、或两种走法各拥三只),热度键归零,排序直接落到品阶 ——
 * 于是贪宝与谨慎的灵兽按品阶一行行交错下去,「按命途聚」当场失效。
 * 热度决定**哪一段在前**,定序决定**同热度不打散**,两键缺一不可。
 */
const FATE_ORDER: readonly string[] = PET_TRAITS.map((trait) => trait.id);

/** 认不出的命途给一个比谁都大的序,好让它沉底 */
function fateIndex(personality: string | undefined): number {
  if (!personality) return FATE_ORDER.length;
  const at = FATE_ORDER.indexOf(personality);
  return at < 0 ? FATE_ORDER.length : at;
}

/**
 * 统计每个命途**已拥有**多少只 —— 命途之间的排序键。
 *
 * 只数已结缘的:谱上四十只全在,但玩家关心的是「我手上这一类有几只、
 * 值不值得在这一类里挑」。未结缘的挂在这里数进命途热度,会让一条
 * 一只都没有的走法浮到前面,反而挡住了正在用的几种。
 */
export function fateOwnedCounts(rows: readonly FateSortRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.owned) continue;
    const fate = row.personality ?? "";
    counts[fate] = (counts[fate] ?? 0) + 1;
  }
  return counts;
}

/**
 * 按「相伴中 → 已结缘 → 命途(热度降序 → 数据层定序)→ 同行深浅 → 品阶降序 → id」
 * 排出一份新数组。
 *
 * **命途聚只作用于已结缘那一段。** 未逢的灵兽在谱上是一行「???」,把它们也按命途
 * 聚在一起,玩家看见的仍然是一串认不出的名字 —— 那一段按品阶降序排更有用:它读起来
 * 是「下一步想要哪一只」的榜,而不是「哪一种走法还缺几只」。
 *
 * 不原地改入参:`petRows` 是 computed 的产物,就地 sort 会把只读语义搅乱。
 */
export function orderPetsByFate<T extends FateSortRow>(rows: readonly T[]): T[] {
  const counts = fateOwnedCounts(rows);
  const heat = (row: T): number => counts[row.personality ?? ""] ?? 0;
  // 走到这一行时,两行必在同一档(相伴中 / 已结缘 / 未结缘)—— 上一键已按档分开
  const grouped = (row: T): boolean => row.owned;
  return [...rows].sort(
    (a, b) =>
      // 一 相伴中的那只永远第一
      Number(b.active) - Number(a.active) ||
      // 二 已结缘的在前,未逢的沉底成一条榜
      Number(b.owned) - Number(a.owned) ||
      // 三 已契这一段按命途聚,收藏多的走法先浮上来(未契段这一键归零)
      (grouped(b) ? heat(b) - heat(a) : 0) ||
      // 四 热度相等时按数据层的命途定序 —— 少了这一键,两条同热度的走法会按品阶交错
      (grouped(b) ? fateIndex(a.personality) - fateIndex(b.personality) : 0) ||
      // 五 同一命途里,同行深一点的在前(未契段全是 0,这一键自然归零)
      b.depthRank - a.depthRank ||
      // 六 同一段里品阶高的在前
      b.qualityRank - a.qualityRank ||
      // 七 兜底按 id 稳定,避免 sort 的不确定性
      a.id.localeCompare(b.id),
  );
}
