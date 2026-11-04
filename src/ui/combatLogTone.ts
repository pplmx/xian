/**
 * 战报里的品阶语气 —— 神品那一件出手,不该与凡品那一件长得一样。
 *
 * ## 缺口:战报是全作唯一没有品阶通道的一屏
 *
 * 品阶在这一作里已经有很完整的表达(角章 / 光 / 声 / 停留时长 / 器铭),
 * 唯独**战斗回放里那几十行字**没有任何品阶信息:每行只有 `t`
 * (atk / skill / crit / shield / heal / dodge / proc / info / win / lose),
 * 颜色按 `t` 分档。
 *
 * 而法宝自动出手走的是 `t: "proc"`,与「锋连诀」「罡盾崩碎」同一个桶,
 * 且 CSS 没给 proc 写规则 —— 它落回默认墨色。于是凡品墨玉葫芦回血,
 * 与神品混沌钟轰出 205% 单位伤害,在战报里是**一模一样的灰字**。
 *
 * ## 为什么只折三档,不照搬九档
 *
 * 战报是密排的几十行,不是名册。九档九色在密排里认不出(见 ui/qualityTier
 * 对同一件事的判断:玩家记不住哪色是哪档)。故这里只回答「这一行要不要
 * 比寻常重」:
 *
 *   plain —— 凡 / 良 / 精 / 灵 / 玄 / 地,以及没有品阶的老战报:默认墨色
 *   rare  —— 天 / 仙:该档的色
 *   top   —— 神:该档的色,并加一点分量(竖线加厚)
 *
 * 这条界与 `ui/qualityTier` 的 isRareQuality、`ui/flashTier`、`ui/toastLife` 同源
 * (rank ≥ 6 起稀有),不另立一套。
 *
 * ## 本模块只管分类,不管色值
 *
 * 与 flashTier 同一条理由:品质表里是调色板 token,DOM 之外求不了值。
 * 这里只回答"哪一档",真正的色由界面用 CSS 变量取。
 */
import type { QualityId } from "@/types";
import { qualityDef } from "@/data/qualities";

/** 战报一行该有多重 */
export type LogQualityTone = "plain" | "rare" | "top";

/**
 * 品阶 → 战报语气。
 *
 * 坏值(认不得的 id、老存档缺字段)一律 `plain` —— 不让一个坏键把整行
 * 染成一档不存在的色,也不给没有品阶的行凭空加分量。
 */
export function logQualityTone(quality: QualityId | null | undefined): LogQualityTone {
  if (!quality) return "plain";
  const def = qualityDef(quality);
  // qualityDef 对认不得的 id 返回第一档(凡品),故这里天然落到 plain
  const rank = typeof def?.rank === "number" && Number.isFinite(def.rank) ? def.rank : 0;
  if (rank >= 8) return "top";
  if (rank >= 6) return "rare";
  return "plain";
}
