/**
 * 提示条停多久 —— 神品落地与灵品落地,不该停同样久。
 *
 * ## 问题:四条感官里,最后一条没跟着品阶走
 *
 * 品阶早已在**三层**分层了:
 *   颜色与边框(第 18 轮)   灵/玄/地 一档、天仙 一档、神 一档
 *   全屏那道光(第 21 轮)   1.1s / 1.35s / 1.6s(见 ui/flashTier)
 *   那一声玉振(第 22 轮)   rare / rareHigh / rareTop(见 ui/rareSfx)
 *
 * 而**提示条自己停多久**一直只有两档:`rare ? 4200 : 2600`。于是「神品法宝天降」
 * 与「拾得一件灵品」在屏幕上停的时间一模一样 —— 这作里最稀有的那一次,
 * 与寻常的一次,在场时长没有任何区别。
 *
 * ## 为什么停留时长是这里最有效的一把尺
 *
 * 光只有 1.1~1.6 秒,一闪而过;声音更短。而提示条是玩家**真正去读**的那一层:
 * 「天降机缘!获得法宝「混沌钟」」这种句子要读完,还要决定点不点开去看详情。
 * 神品那条更长、更值得读,却和灵品同时走 —— 读慢一点就没了。
 *
 * 且时长比颜色稳:颜色在暗场与亮场观感差别很大(品阶色有深有浅),
 * 而 4.2 秒与 5.4 秒的差别,人不需要对比就能感到 —— 与 flashTier 同一条理由。
 *
 * ## 分层的界与视觉/声音同源
 *
 * 三层照抄 `flashTier` 与 `rareSfx` 的界(rank < 6 / 6-7 / 8),不另立一套。
 * 同一条提示不许出现「光按神品闪、声按神品响、却按灵品的时长停」这种分叉 ——
 * 四层反馈读同一把尺。
 *
 * ## 本模块只管时长,不管分类
 *
 * 「哪一档算稀有」由 `data/qualities` 的 rank 决定,这里只把 rank 折成毫秒。
 * 不 import store / core / DOM —— 与 flashTier、weatherSky 同一条纪律:
 * 纯函数可独立测,界面只做薄接线。
 */
import type { QualityId } from "@/types";
import { qualityDef } from "@/data/qualities";

/**
 * 三档停留时长(毫秒)。
 *
 *   base      —— 寻常提示。与改造前**逐位相同**,不动。
 *   plainRare —— 带印但不到稀有段(灵/玄/地)。同样不动:它们虽也 rare,
 *                还不值得比别的 rare 停更久 —— 与那道光同一条判断。
 *   high      —— 天/仙:比寻常 rare 多一秒,先把那句读完。
 *   top       —— 神:再多四分之一秒。上限压在 8 秒内,不赖着不走。
 */
export const TOAST_LIFE = {
  base: 2600,
  plainRare: 4200,
  high: 5200,
  top: 5600,
} as const;

/** 稀有段的起点(天品)—— 与 ui/qualityTier 的 isRareQuality、ui/flashTier 同一条界 */
const RARE_RANK = 6;

export interface ToastLifeInput {
  /** 提示的种类(见 types 的 Toast) */
  kind: "info" | "success" | "warn" | "rare";
  /** 品阶印;没有印的 rare(转世/突破/里程碑)照旧走 plainRare */
  seal?: QualityId;
}

/**
 * 这一条提示该停多久(毫秒)。
 *
 * 坏值(认不得的品阶 id、未来误传的档)一律落回 `plainRare` ——
 * 不许因为一个写坏的字符串就长出一档不存在的时间。
 */
export function toastLifeMs(input: ToastLifeInput): number {
  // 印只在 rare 那一支有意义:info 带了 divine 也不该多停
  if (input.kind !== "rare") return TOAST_LIFE.base;
  if (!input.seal) return TOAST_LIFE.plainRare;
  const def = qualityDef(input.seal);
  const rank = typeof def?.rank === "number" && Number.isFinite(def.rank) ? def.rank : 0;
  if (rank >= 8) return TOAST_LIFE.top;
  if (rank >= RARE_RANK) return TOAST_LIFE.high;
  return TOAST_LIFE.plainRare;
}
