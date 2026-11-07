/**
 * 一趟历练的**规模账** —— 这一趟会走多久、交几次手、撞几次际遇。
 *
 * ## 为什么单独成文件
 *
 * 出行方式窗一直摆着四个档位,旁边写着「30分 / 1小时 / 2小时 / 4小时」与一串
 * 「预计材料 ≈ N 件 / 装备 约 N 趟一件」。那几个期望值算的是**一场胜战**的掉落
 * (`core/loot` 的 dropEntriesFor 就是 afterWin 用的那张表),却被摆在「整趟」的
 * 时长旁边读。实测四个档的整趟战斗场次是 126 / 252 / 504 / 1008 —— 也就是说
 * 界面上那个数小了整整两个到三个数量级。
 *
 * 数字算错只是症状;病根是**没有人说过「一趟是几场」**。这一份把它说出来,
 * 于是「每场多少」与「整趟多少」之间第一次有了可换算的距离。
 *
 * ## 口径
 *
 * 场次 = 整趟时长 ÷ 遭遇间隔,与离线结算同一道算式(见 `encountersIn`)。
 * 在线是逐次排期的(`nextBattleAt += 间隔`),离线是整段估算的,两边必须同源 ——
 * 从前在线的间隔带历练速度、离线也带,但算式各写一遍;现在只剩这里一份。
 */
import { EXPLORE_BATTLE_INTERVAL, EXPLORE_MODES } from "@/data/constants";
import type { ExploreMode, StatMods } from "@/types";
import { modOf } from "./statsCalc";
import { personalityEffects } from "./petPersonality";

export interface ExploreTripPlan {
  mode: ExploreMode;
  /** 实发时长(已乘灵兽性格的 `exploreDurMult`)—— 慢稳/疾行真的改它 */
  durationSec: number;
  /** 每次遭遇的间隔秒数(已含历练速度词条);墙钟秒,不取整 */
  cadenceSec: number;
  /** 整趟的遭遇格数(战斗 + 际遇) */
  encounters: number;
  /** 其中际遇的次数(不交战,只结算事件) */
  events: number;
  /** 其中真正交手的场次 —— 掉落与修为都只在这几场里结算 */
  battles: number;
}

/** 历练速度:出行间隔的唯一倍率来源(装备/功法/灵脉词条) */
export function explorationSpeedMult(mods: StatMods): number {
  return 1 + modOf(mods, "explorationSpeed");
}

/**
 * 一段时长里能排下几场遭遇 —— **在线 Tick 与离线结算共用这一道算式**。
 *
 * 间隔 = `EXPLORE_BATTLE_INTERVAL / 历练速度`,故场次 = 时长 × 速度 ÷ 间隔,
 * 与 `core/offline` 那句 `Math.floor((simSec / EXPLORE_BATTLE_INTERVAL) * speed)` 等价。
 */
export function encountersIn(durationSec: number, speed: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.floor((durationSec / EXPLORE_BATTLE_INTERVAL) * speed);
}

/** 遭遇格数里有多少次是际遇(与离线同取整口径) */
export function eventsIn(encounters: number, eventChance: number): number {
  if (!Number.isFinite(encounters) || encounters <= 0) return 0;
  const p = Number.isFinite(eventChance) ? Math.max(0, Math.min(1, eventChance)) : 0;
  return Math.round(encounters * p);
}

/**
 * 实发时长:基础时长 × 灵兽性格。
 *
 * 与 `startExploration` 里那句 `Math.round(modeDef.durationSec * petEff.exploreDurMult)`
 * 同一份算法 —— 界面若报基础时长,带「慢稳」上路的玩家会看到 30 分变成 33 分,
 * 而弹窗上明明写着 30 分。
 */
export function exploreDurationSec(mode: ExploreMode, petId: string | null): number {
  return Math.round(EXPLORE_MODES[mode].durationSec * personalityEffects(petId).exploreDurMult);
}

/**
 * 整趟规模账。`eventChance` 由调用方从 `exploreEventChance` 取 —— 它带今日星象之利,
 * 而这正是玩家要的:值日之宿所利的地界际遇更多、交手随之更少。
 */
export function exploreTripPlan(input: {
  mode: ExploreMode;
  petId: string | null;
  mods: StatMods;
  eventChance: number;
}): ExploreTripPlan {
  const speed = explorationSpeedMult(input.mods);
  const durationSec = exploreDurationSec(input.mode, input.petId);
  const encounters = encountersIn(durationSec, speed);
  const events = eventsIn(encounters, input.eventChance);
  return {
    mode: input.mode,
    durationSec,
    cadenceSec: EXPLORE_BATTLE_INTERVAL / speed,
    encounters,
    events,
    battles: Math.max(0, encounters - events),
  };
}
