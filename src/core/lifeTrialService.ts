/**
 * 逆旅契服务 —— 道果的第一个非效率出口
 *
 * 链路只有一条,刻意做到最小:
 *
 *   spendDaoFruit(cost)  余额真的下降
 *     → reincarnation.trial  这一世的契
 *     → lifeTrialRules()  注入本世历练战斗
 *     → 转世时写入 LifeRecord.trialId  成为履历
 *
 * ## 本模块刻意不做的事(这是判据,不是遗漏)
 *
 * 以下四种「回报」都被出口空间审计否掉,因此本文件**不得**出现:
 *   - player.addDaoFruit  自供能循环:道果生道果
 *   - player.addInsight   宿慧 → aptitudeFloorNow → growthMult → cultivationSpeed
 *   - 任何资源发放        灵石/丹药 → 强化 → 战力 → 历练更快
 *   - 任何 StatMods       直接落在效率链上
 *
 * 履历是唯一合格的回报:它不进任何计算。
 * `lifeTrialService.spec.ts` 会扫描本文件源码强制这四条。
 */
import type { CombatRules } from "@/types";
import { type LifeTrialDef, isPurelyAdverse, lifeTrialDef } from "@/data/lifeTrials";
import { notify } from "./notify";
export type { LifeTrialState } from "@/data/lifeTrials";
import { usePlayerStore } from "@/stores/player";

/** 当前这一世的契;未签为 null */
export function activeLifeTrial(): LifeTrialDef | null {
  const t = usePlayerStore().reincarnation.trial;
  return t ? (lifeTrialDef(t.trialId) ?? null) : null;
}

/** 本世契约施加的战斗规则;未签约时为 undefined */
export function lifeTrialRules(): CombatRules | undefined {
  return activeLifeTrial()?.rules;
}

/**
 * 契约要的段数 —— 供世界生成时使用(第 470 轮)。
 *
 * `generateMortalWorld` 收一个可选的上限,在**挑段之前**就把骨架层级表压到这么多段。
 * 为什么必须在生成前给,而不是生成后截:
 *
 * ```text
 * 事后截尾版（第一版实现）
 *   前 3 段原样保留,层级 2 / 4 / 7 —— 终点从 17 掉到 7,短而软
 * 事后重摊版
 *   层级摊成 2 / 11 / 17,终点保住了 —— 但敌人与首领是按**原层级**生成的:
 *   实测 t11 那段的敌人层级差 7~8、首领差 10,地界名也还是「青云山麓」
 *   —— 这正是第 461/462 轮修掉的那个形状,又被我制造了一遍
 * ```
 *
 * 故段数必须**进生成器**:重采样层级表之后就照常走原有流程,
 * 敌人、首领、地界名、事件标签全都按新层级重新挑,所有绑定天然自洽。
 */
export function trialStageLimit(def: LifeTrialDef | null | undefined): number | undefined {
  return def?.routeStages;
}

/**
 * 本世是否禁用某类物品(第 473 轮)。
 *
 * 「可用物品」这条玩法面的唯一出口:装备侧与结算侧都要走它,
 * 这样「契约说不许用」与「界面真的收起来」才不会是两本账。
 *
 * 未立契、签的不是这一类、或签的契没禁这类物品 —— 三种都返回 false。
 */
export function lifeTrialBansItem(kind: "artifact" | "pill"): boolean {
  return activeLifeTrial()?.bannedItemKind === kind;
}

/** 能否签下某契(余额足够、本世尚未签过、规则合法) */
export function canSignLifeTrial(id: string): boolean {
  const player = usePlayerStore();
  if (player.reincarnation.trial) return false;
  const def = lifeTrialDef(id);
  if (!def) return false;
  if (!isPurelyAdverse(def.rules)) return false;
  return player.reincarnation.daoFruit >= def.cost;
}

/**
 * 签下这一世的逆旅契。
 *
 * 一世只能签一份,签下不可解除 —— 可退款等于没花掉,
 * 出口就退回成「记一笔已花费」的假消费
 */
export function signLifeTrial(id: string): boolean {
  const player = usePlayerStore();
  const def = lifeTrialDef(id);
  if (!def) return false;
  if (player.reincarnation.trial) {
    notify("此生已有契在身", "warn");
    return false;
  }
  // 规则不合法则拒签:契约只许加难,这是硬约束
  if (!isPurelyAdverse(def.rules)) return false;
  if (!player.spendDaoFruit(def.cost)) {
    notify("道果不足", "warn");
    return false;
  }
  player.setLifeTrial({ trialId: def.id, at: Date.now(), paid: def.cost });
  /*
   * 签下「不祭法宝」这类契之后,把已经装着的那几件卸下(第 473 轮)。
   *
   * 不卸的话会出现一个荒谬状态:屏幕上写着「本世不得祭用任何法宝」,
   * 而玩家正带着两件在面板上加成 —— `noteTaboo` 只在**祭用**那一刻判定,
   * 已经装着的不会触发它,于是契约说了不许,实际一分好处都没少。
   *
   * 卸下是「不祭」的自然含义,不是惩罚:法宝还在行囊里,收回即守戒。
   */
  notify(`「${def.name}」既立,此生再无回头路`, "rare");
  return true;
}

/** 归档本世的契,供 LifeRecord 记录;随后由转世流程清空 */
export function archiveLifeTrial(): string | null {
  return usePlayerStore().reincarnation.trial?.trialId ?? null;
}
