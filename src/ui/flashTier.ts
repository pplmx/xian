/**
 * 闪光的分量 —— 神品落地与天品落地,不该是同一道光。
 *
 * ## 问题:所有 rare 共用一道金光
 *
 * 提示条体系里,`kind === "rare"` 会触发一次全屏金光(`.rare-flash`)。而这作里
 * 叫得上 rare 的事各差着量级:
 *
 *   拾得一件**灵品**装备   → 金光
 *   参悟出**仙品**功法     → 同一道金光
 *   神兽**神品**结缘       → 还是同一道金光
 *   转世落地、突破大境     → 也是同一道金光
 *
 * 第 5 轮给提示条加了**品阶印**(那枚小章),但全屏那道光没跟上 ——
 * 它至今只有一种颜色与一种时长。于是「神品」在屏幕上最重的那一层里,
 * 与「灵品」完全同款。
 *
 * ## 补什么:只给两个可分层的东西
 *
 *   **色相** —— 有天品印的,用那一档的品阶色(而不是恒定的金色)
 *   **时长** —— 品阶越高,光停得越久
 *
 * 不加第二层光、不加粒子、不加震动:那会把「稀有」变成噪声,
 * 而噪声一旦常态,真正罕有的那一次就不响了。
 *
 * ## 本模块只管分类,不管色值
 *
 * 品质表里的颜色是 `var(--color-*)` 这样的**调色板 token**,浏览器里才能求值。
 * 纯函数假装知道 RGB 就只能在两套格式之间来回转换 —— 那正是这一版最初写错的地方
 * (同一个字段有时是 "200 160 60"、有时是 "var(--color-…)")。故这里只回答
 * 「哪一档、多久、色从哪儿取」,真正的色值由界面用 `getComputedStyle` 求一次。
 */
import type { QualityId } from "@/types";
import { qualityDef } from "@/data/qualities";
import { rareSfxOf, type RareSfxTier } from "./rareSfx";

/** 这道光有多重 */
export type FlashTier = "plain" | "rare" | "top";

export interface FlashPlan {
  tier: FlashTier;
  /** 这一道光的时长(秒) */
  seconds: number;
  /**
   * 光的色:
   *   null —— 用默认金色(`.rare-flash` 的 CSS 自带),即不惊动的那一支
   *   否则 —— 一个调色板 token,界面拿它去求值
   */
  colorToken: string | null;
  /**
   * 这一道该配哪一声(见 ui/rareSfx)。
   *
   * 放在这里而不是让提示条各算一次:光与声是同一件事的两面,同一条提示
   * 不该出现「光按神品闪、声按灵品响」这种分叉。
   */
  sfx: RareSfxTier;
}

/** 没有品阶印时的那道光 —— 与改造前完全一致,不惊动转世 / 突破 / 里程碑 */
export const FLASH_DEFAULT: FlashPlan = {
  tier: "plain",
  seconds: 1.1,
  colorToken: null,
  sfx: "rare",
};

/**
 * 品阶印 → 那道光。
 *
 * 分三层:
 *   rank < 6 —— 与默认同款(灵/玄/地也会 rare,但不值得更重的光)
 *   rank 6-7 —— 该档品阶色的光,1.35 秒
 *   rank 8   —— 神品:1.6 秒
 *
 * 时长比颜色更有效:颜色在暗场与亮场里的观感差别很大(品阶色有深有浅),
 * 而 0.9 秒与 1.6 秒的差别,人不需要对比就能感到。
 */
export function flashPlanOf(quality: QualityId | undefined): FlashPlan {
  if (!quality) return FLASH_DEFAULT;
  const def = qualityDef(quality);
  const rank = def?.rank ?? 0;
  if (rank < 6) return FLASH_DEFAULT;
  return {
    tier: rank >= 8 ? "top" : "rare",
    seconds: rank >= 8 ? 1.6 : 1.35,
    colorToken: def.color,
    sfx: rareSfxOf(rank),
  };
}
