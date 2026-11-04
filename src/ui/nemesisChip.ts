/**
 * 宿敌那一枚章 —— 把「结怨多深」与「雪没雪耻」写出来。
 *
 * ## 现状
 *
 * 同一个敌人把玩家打败三次之后,战斗界面会挂一枚小章,只写两个字:**宿敌**。
 * (阈值见 `core/worldMemory.NEMESIS_THRESHOLD`。)
 *
 * 而那枚章背后有两个字段一直没上界面:
 *
 *   `NemesisRecord.lossCount`  —— 输给它几次
 *   `NemesisRecord.avengedAt`  —— 哪一次赢回来的
 *
 * 雪耻那一刻尤其安静:打赢之后 `isNemesis` 立刻返回 false,章**直接消失**,
 * 玩家看到的是"什么都没发生"。而 `core/worldMemory` 那边已经把 `avengedAt` 记上,
 * 还会据此产出「残魂」形态 —— 世界记得,界面不说。
 *
 * ## 章里写门槛值,不写实际次数
 *
 * `lossCount` 的值域是 3 到 ∞,一章变长的读数撑不住。故写**门槛值**(三次)——
 * 它说明的是"够格称宿敌"这件事本身。具体次数留给传承页那张宿敌表(那里有地方)。
 *
 * 也因此这里读 `NEMESIS_THRESHOLD` 而不是手写 3:阈值若改了,这两句话要跟着变。
 *
 * ## 只做措辞
 *
 * 不 import store、不碰结算 —— 与 `ui/eventRecall`、`ui/multText` 同一条纪律。
 */

import { NEMESIS_THRESHOLD } from "@/core/worldMemory";

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function cnCount(n: number): string {
  return n >= 0 && n <= 10 ? CN[n]! : String(n);
}

/**
 * 未雪耻时那枚章的文案。不到门槛、或已雪耻时返回空串(调用方据此不渲染)。
 *
 * 写法固定为「宿敌 · 已败三次」—— 中点与页脚其它读数的分隔符同一套。
 */
export function nemesisChipText(n: { lossCount: number; avengedAt?: number }): string {
  if (n.avengedAt !== undefined) return "";
  if (!(n.lossCount >= NEMESIS_THRESHOLD)) return "";
  return `宿敌 · 已败${cnCount(NEMESIS_THRESHOLD)}次`;
}

/**
 * 雪耻之后那一句。**只在已雪耻时**出 —— 未雪耻返回空串,两者互斥。
 *
 * 它出现在打赢那一次的战斗界面上:章不在了,但这句还在,玩家才看得见
 * 「刚才那一场把旧账清了」。
 */
export function nemesisAvengedText(n: { lossCount: number; avengedAt?: number }): string {
  if (n.avengedAt === undefined) return "";
  if (!(n.lossCount >= NEMESIS_THRESHOLD)) return "";
  return "旧仇已雪";
}
