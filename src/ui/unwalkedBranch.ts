/**
 * 未走之道 —— 择定之后,那几条没走的路不该从眼前消失。
 *
 * ## 问题:关闭对话框那一刻,另外几条道就没了
 *
 * 择道是这一作里少数**不可撤销**的决定之一,界面上为此写了二步确认、终身不改。
 * 而按下「确认择道」之后,那段列表整个消失 —— 只剩自己这一条的名字与词条。
 * 玩家想知道「当初另一条给的是什么」,得去藏珍的悟道录里翻(那里确实留着),
 * 而这正是他刚刚做完决定的那一页。
 *
 * 悟道录的判据(`branchStage`)已经把「没走的那条」记为「已见」而非「未见」——
 * 数据侧承认它们还在;界面侧却把它们藏了。这一处不对称就是本模块要补的。
 *
 * ## 补什么
 *
 * 择定之后,在那一条的下面补一行:**未行之道** —— 其余几条的名字,各带一句
 * 「它当时会给什么」。写明「未行」,不写成可点的选项:它们已经不可选了,
 * 长得像按钮才是骗人。
 *
 * ## 为什么不复述自己那条
 *
 * 自己那条的名字、说明与词条就在上一行。再列一遍是同一屏说两遍 ——
 * 那正是本仓反复清掉的那类。故这里**只列没走的**。
 */
import type { GongfaBranchDef } from "@/data/gongfaBranches";

/** 一条「没走的道」 */
export interface UnwalkedBranch {
  id: string;
  name: string;
  /** 它当时会给什么(一句话) */
  effect: string;
}

/**
 * 其余几条道的摘要。
 *
 * @param branches 同一部功法的全部分支(按原表顺序,不重排 —— 与择道时看到的顺序一致)
 * @param pickedId 已择定的分支 id;未择定时传 null,返回空表(择道前用主列表)
 */
export function unwalkedBranches(
  branches: readonly GongfaBranchDef[],
  pickedId: string | null | undefined,
): UnwalkedBranch[] {
  if (!pickedId) return [];
  return branches
    .filter((b) => b.id !== pickedId)
    .map((b) => ({ id: b.id, name: b.name, effect: b.desc }));
}
