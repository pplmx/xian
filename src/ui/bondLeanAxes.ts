/**
 * 同行帖上的「素行之向」—— 你是谁，决定她怎么看同一件事。
 *
 * ## 缺口：契合里有一份来自「你是谁」，而界面从没说过你是谁
 *
 * `data/bondEvents` 的 `resolveChoice` 把契合拆成两份：
 *
 * ```text
 *   选项那份   选项体现的道途 vs 她的道途       +6 / -8 / -2
 *   素行那份   玩家一贯的道途 vs 她的道途       +3 / -5 / -1 / 0
 * ```
 *
 * 同行帖把第一份摊得很干净 —— 每个选项上都印着「契 +8」，`eventFlags` 还会标
 * 「触碰底线」「站在她那边」。而**第二份是无声的**：它在每一次结算里都算进去了，
 * 却没有任何一处告诉玩家自己的素行是哪一道、跟她在不在一条路上。
 *
 * 后果很具体：一位杀伐道的玩家对长生道的云舒做任何事，契合都会额外 -5；
 * 他不知道自己是杀伐道，于是把这条 -5 算到选项、算到随机、算到「这游戏对我不友好」。
 * 这正是本仓反复修的那一类：「报了结果，没报怎么来的」（同 `mentorBehaviorAxes`
 * 与 `swordPurityAxes`，那两处的形状照抄这里）。
 *
 * ## 报什么：行为与相背，不报权重
 *
 * 与师承那处同一条口径 —— 玩家要知道的是「我这道是这么做出来的」「她与我相左在哪」，
 * 而 `LEAN_SCALE` 的归一化倍数（400 / 300 / 30…）是内部细节，改平衡时会动。
 * 故：
 *
 *   · `from`    这一道由哪些行为推出来（读 `LEAN_COUNTERS`，不另写一份）
 *   · `stance`  她与你在哪一档（读 `leanStanceOf`，与结算同一个函数）
 *
 * ## 不在这里读 store
 *
 * 玩家素行由 `counter` 参数进来（同 `leanFromCounters` 与 `mentorVerdict` 的写法）。
 * 一个「把读数摊成两行字」的函数若自己去够 Pinia，判据里测它就要先建一整套存档。
 */
import {
  LEAN_COUNTERS,
  LEAN_STANCE_TEXT,
  leanShiftOf,
  leanStanceOf,
  type LeanStance,
} from "@/data/bondEvents";
import { leanFullName, type DaoLean } from "@/data/daolu";
import { counterBehavior } from "@/data/counterText";
import type { CounterKey } from "@/types";

export interface BondLeanAxes {
  /** 玩家一贯的素行；尚未走出时为 null */
  lean: DaoLean | null;
  /** 素行的全名（「杀伐道」「剑心道」「器道」—— 不叠字） */
  leanName: string;
  /** 她与玩家在哪一档 —— 与结算读同一处 */
  stance: LeanStance;
  /** 这一档的人话（「与她相左」…） */
  stanceText: string;
  /** 这一档带来的契合增减 —— 与结算同一个数 */
  shift: number;
  /** 她是哪一道（全名） */
  herLeanName: string;
  /** 玩家这一道由哪些行为推出来；未走出素行时为空数组 */
  from: string[];
}

/** 这一道由哪些行为推出来 —— 直接读 `LEAN_COUNTERS`,不另写一份 */
export function leanBehaviors(lean: DaoLean | null): string[] {
  if (!lean) return [];
  return LEAN_COUNTERS[lean].map((key: CounterKey) => counterBehavior(key));
}

/**
 * 同行帖上那两行读数。
 *
 * 她的素行恒有（`DaoluDef.lean` 是必填），故这个函数**不返回 null**：
 * 没有同行者时调用方整块不出，而不是让这里编一份空轴。
 */
export function bondLeanAxes(herLean: DaoLean, playerLean: DaoLean | null): BondLeanAxes {
  const stance = leanStanceOf(herLean, playerLean);
  return {
    lean: playerLean,
    leanName: playerLean ? leanFullName(playerLean) : "",
    stance,
    stanceText: LEAN_STANCE_TEXT[stance],
    // 与 resolveChoice 读同一个函数 —— 界面报的 -5 就是结算扣的那个 -5
    shift: leanShiftOf(herLean, playerLean),
    herLeanName: leanFullName(herLean),
    from: leanBehaviors(playerLean),
  };
}

/** 一行说完（窄屏与读屏用）—— 两列并排在 195 宽会折成三行 */
export function bondLeanSummary(axes: BondLeanAxes): string {
  const her = `她是${axes.herLeanName}`;
  if (!axes.lean) return `${her}；你尚未走出素行，这一份暂不增减（${axes.stanceText}）`;
  const delta = axes.shift > 0 ? `+${axes.shift}` : `${axes.shift}`;
  return `你是${axes.leanName}，${axes.stanceText}（契合 ${delta}）—— ${her}`;
}
