/**
 * 天数可窥 —— 「熟知天界」以后，下一境将遇何劫提前看得见
 *
 * ## 这个字段此前没有落点
 *
 * `SamsaraStageDef.heavenInsight` 的注释是「天劫与终局规则的细节提前可见」。
 * 但全仓没有一处产品代码读它 —— 只有数据定义与一条单调性判据。
 *
 * 第 35 轮补文案时发现了它，第 36 轮试着接上时判断「不接」：天劫面板在破境时
 * 就把 `desc` / `risks` / `advice` / 四项读数全给了，要让这一阶决定
 * 「能不能看见细节」，只能把现有信息藏起来 —— 那是对非高阶玩家的净损失。
 *
 * ## 换个方向：不是「藏起来」，是「提前给一件新东西」
 *
 * 同一批字段里的 `enemyInsight` 有实现，做法值得照抄（见 `ui/enemyLore`
 * 的 `effectiveEnemyStage`）：它不藏任何东西，而是**把门槛下调一档** ——
 * 解锁的是「本来要再打几场才看得到的情报」。
 *
 * 天劫这边对应的「本来要等到某一刻才知道的事」是:**下一境将遇何劫**。
 *
 * ```text
 *   rollTribulation(targetMajor) = f(境界, 当日天时)      ← 确定性,不是随机
 * ```
 *
 * 也就是说，一个没开 `heavenInsight` 的玩家要**练到那一境才第一次知道**自己
 * 撞上的是哪一劫;开了的人，在**上一境**就能看见，从而提前备词条、换灵根、
 * 等天时。这正好是「提前可见」四个字：**解锁的是时间，不是内容**。
 *
 * ## 为什么它不会制造两本账
 *
 * 劫型仍由 `rollTribulation` 一处给出 —— 本模块只是提前调用它，
 * 不另立一套推导。玩家此刻看到的「下一境是雷鸣劫」与真到那一境时的
 * `buildTribulationPlan` 必然一致（同一个函数、同一个种子）。
 *
 * ## 这一层只算，不读 store
 */
import { tribulationDef, type TribulationKind } from "@/data/tribulations";

/** 下一境将遇之劫 —— 提前看得见的只有这四样 */
export interface NextTribulationPreview {
  /** 劫型 id */
  kind: TribulationKind;
  /** 劫名（「雷鸣劫」） */
  name: string;
  /** 一句话说它会怎么伤到你 */
  desc: string;
  /** 这一境的大境界编号（劫型由它派生） */
  major: number;
}

/**
 * 若这一阶开了「天数可窥」，把**已经算好的**下一境劫型包成预览；否则 null。
 *
 * 劫型由调用方传进来，不在这里算 —— 因为 `rollTribulation` 要读当日天时
 * （`todayWeather` 直接 `useGameStore()`），一旦在这里调用，这个本该是纯函数的
 * 模块就被拉进 pinia 依赖，判据得先建 store 才能跑（实测踩过：
 * `getActivePinia() was called but there was no active Pinia`）。
 *
 * 分工因此是：**调用方算劫型（它本来就有 store），这一层只决定「给不给看」。**
 *
 * 到顶时调用方传 `null` —— 没有下一境，就没有可窥的天数。
 */
export function nextTribulationPreview(
  heavenInsight: boolean,
  kind: TribulationKind | null,
  nextMajor: number,
): NextTribulationPreview | null {
  if (!heavenInsight || kind === null) return null;
  if (!Number.isFinite(nextMajor) || nextMajor < 0) return null;
  const def = tribulationDef(kind);
  if (!def) return null;
  return { kind: def.id, name: def.name, desc: def.desc, major: nextMajor };
}
