/**
 * 册目读法 —— 「第几册」在整句里怎么写,收在一处。
 *
 * ## 问题:一句话里两种数字
 *
 * 星图的当前落点读作:
 *
 *   卷三 · 第 03 册
 *
 * 同一行里,前半句用汉字、后半句用两位阿拉伯数字。顶栏那枚是「03 · 行囊」——
 * 也更像页码而不像册次。而这一作在**别处**早就是统一的:「卷三」「壹贰叁」
 * 「乙」「丙」。上一轮把卷首水印也从 `01` 改成了汉字,于是这三处成了最后的例外。
 *
 * ## 但行号不是册次
 *
 * 需要分清两类数字,混为一谈会把该留阿拉伯数字的地方也汉字化:
 *
 *   **册次 / 卷次** —— 基数很小(五卷、十七册),是**体例**,读作「卷三」「第三册」。
 *   **列表行号** —— 动辄几十上百条(行囊 200 件、藏珍 400 枚),是**计量**,
 *                 两位阿拉伯数字(01、02……)更易扫读、对齐也更整齐。
 *
 * 故本模块只负责前者。行号仍是 `padStart(2, "0")`,不动。
 *
 * ## 为什么不用 cnNumber 直接拼
 *
 * `cnNumber` 给的是数字(**三**),而「第几册」要的是**序数词**(第三册)。
 * 两者在十位以内一致,从「十」起就出现分叉:续作里若册数涨到十几,
 * 「第 十 册」「第 十一 册」读起来是数字不是序数。这里把「第…册」的**外壳**
 * 与数字分开,外壳由本模块提供,数字仍走 cnNumber —— 一个来源,两种拼法。
 */
import { cnNumber } from "@/utils/format";

/** 「第三册」—— 只给册次用;行号不走这里 */
export function folioBookMark(entryIndex: number): string {
  if (!Number.isFinite(entryIndex) || entryIndex < 0) return "未入册";
  return `第${cnNumber(Math.floor(entryIndex) + 1)}册`;
}

/** 「卷三」—— 卷次 */
export function folioVolumeMark(sectionIndex: number): string {
  if (!Number.isFinite(sectionIndex) || sectionIndex < 0) return "卷首";
  return `卷${cnNumber(Math.floor(sectionIndex) + 1)}`;
}

/**
 * 星图/顶栏那一行:「卷三 · 第三册」。
 *
 * 没有位置时读「未入册」而不是空串 —— 那两处都在导航骨架上,
 * 空一格会让整行向左塌一块。
 */
export function folioPositionMark(
  sectionIndex: number | null | undefined,
  entryIndex: number | null | undefined,
): string {
  if (sectionIndex == null || entryIndex == null) return "未入册";
  return `${folioVolumeMark(sectionIndex)} · ${folioBookMark(entryIndex)}`;
}
