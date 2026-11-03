/**
 * 提示条的去处 —— 有些话说出口之后,还该能点开看。
 *
 * ## 问题:提示条只能点掉
 *
 * 「灵光乍现,拾得「天品·玄铁重剑」· 铭「问山」」—— 这一条是玩家**唯一**看见
 * 「我得到了什么」的地方,几秒后消失。此后想再看那一件的详情(词条、器铭、
 * 与当前佩戴的对比),得自己判断它落在行囊的哪一格、翻进去、再点开。
 *
 * 行囊满时更麻烦:它会先替你挤掉一件。那一瞬间的提示里,哪个是新的、
 * 被挤掉的是哪个,只有这一条在说。
 *
 * ## 补什么
 *
 * 提示条多一个**可选去路**:填了 `to` 的那种,点一下打开对应详情
 * (装备 → 器评帖,法宝 → 法宝详情),没填的照旧点掉自己。
 *
 * ## 为什么去路是「动作」而不是「链接」
 *
 * 提示条浮在任意页面上,有些目标(器评帖)本身就是全局浮层,而不是一条路由。
 * 做成路由链接会**把玩家从现在这一页带走** —— 他可能正在看战斗回放。
 * 故去路只携带「打开哪个详情」这一个动作,由上层决定怎么兑现。
 *
 * ## 为什么不是所有提示都带去路
 *
 * 「灵石 +3」「丹药不足」这类话没有可看的东西,给了去路反而让整条提示
 * 变成可疑的可点区域。故去路是**opts 里显式给的**,不填就没有。
 */

/** 提示条能打开的详情种类 —— 与界面既有的全局浮层一一对应 */
export type ToastTargetKind = "equipment" | "artifact";

export interface ToastTarget {
  kind: ToastTargetKind;
  /** 装备:实例 uid;法宝:定义 id */
  id: string;
}

/**
 * 这条提示能不能点开。
 *
 * 认两种:装备与法宝。写坏的 kind / 空 id 一律当没有 —— 一条点了没反应的
 * 提示比一条不可点的提示更让人困惑。
 */
export function toastTargetOf(target: ToastTarget | null | undefined): ToastTarget | null {
  if (!target) return null;
  const { kind, id } = target;
  if (typeof id !== "string" || id.length === 0) return null;
  if (kind !== "equipment" && kind !== "artifact") return null;
  return { kind, id };
}
