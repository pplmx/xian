/**
 * 逆旅契进履历 —— 「被记住」是这份契约**唯一**的回报。
 *
 * ## 缺口:契约把回报押在履历上,履历却不记它
 *
 * `data/lifeTrials.ts` 的文件头把这份设计讲得很清楚:
 *
 * ```text
 * 花道果 → 为这一世签一份只加难度的契 → 本世历练全程生效
 *       → 转世时记入履历 → 记录不进任何计算
 * ```
 *
 * 为什么回报只能是「记录」—— 四条给收益的路(属性/资源/宿慧/道果)全被出口空间
 * 审计堵死,「剩下的只有『这一世确实与众不同,且它被记住了』」。
 *
 * `core/reincarnation` 照做了,写进 `LifeRecord.trialId`,注释也是同一句:
 *
 *     // 逆旅契入履历 —— 这是契约唯一的回报:被记住,且不进任何计算
 *
 * 而**历世履历那一屏从头到尾没读过这一栏**:`LegacyView` 的 `lifeRows` 只取
 * 境界名、寿数、命题与宿慧。玩家花道果买下一世的逆境,转世后翻履历,
 * 看到的与从没签过契的那一世**一模一样** —— 这份契约在玩家眼里确实没有任何回报。
 *
 * ## 只翻名字与印,不带代价
 *
 * 实付道果(`paid`)是签约那一刻的账,不是履历该记的事 —— 履历要说的是
 * 「那一世你立过此契」,不是一个价签。故这里只返回名与印。
 */
import type { LifeTrialDef } from "@/data/lifeTrials";
import { lifeTrialDef } from "@/data/lifeTrials";

/** 履历上那一行要显示的东西 */
export interface LifeTrialArchiveRow {
  /** 契名,如「孤行契」 */
  name: string;
  /** 印文(单字),如「孤」 */
  seal: string;
}

/**
 * 把存档里的 `LifeRecord.trialId` 翻成履历可显示的一行。
 *
 * 没签过契(老存档缺这一栏)或认不得的 id 一律返回 null ——
 * 履历上就不出那一行,不印一句残缺的契文。
 */
export function lifeTrialArchive(trialId: string | null | undefined): LifeTrialArchiveRow | null {
  if (!trialId) return null;
  const def: LifeTrialDef | undefined = lifeTrialDef(trialId);
  if (!def) return null;
  return { name: def.name, seal: def.seal };
}
