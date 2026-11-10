/**
 * 师承的「行为契合」—— 报了分数，却没报分数怎么来的
 *
 * ## 缺口:玩家看得到 0.35，看不到是什么扣的
 *
 * `core/mentorService` 用一张权重表把玩家的行为计数器折算成契合度:
 *
 * ```text
 *   swordsman（剑修）  kills +1 · bossKills +2 · breakthroughs +0.5 · pillsCrafted -0.6
 *   alchemist（丹修）  pillsCrafted +1 · pillsUsed +1 · kills -0.8
 *   arraymaster（阵师）buildingUpgrades +0.4 · offlineClaims +0.5 · explores -0.8
 *   hunter（猎户）     explores +1 · equipsGained +1 · events +0.5 · buildingUpgrades -0.6
 * ```
 *
 * 而 `MentorDialog` 只印一个数(「行为契合 0.35」)与一句师尊评价。玩家读到
 * 「剑意未纯。你心中有剑,手里却无剑。」时,**看不出是自己丹药炼多了** ——
 * 那条 `-0.6` 的权重只活在代码里。
 *
 * 更要紧的是**负权重**:加分项玩家迟早会撞对,减分项却是无声的 ——
 * 他可能一直在做让师承更远的事,还以为是别的原因。
 *
 * ## 报行为，不报权重数
 *
 * 玩家不需要知道 `kills` 的权重是 1 还是 2(那是内部归一化的细节),
 * 他要知道的是「这条师承看重什么、忌讳什么」。故只报两侧的**行为名**:
 *
 *   · `toward` —— 与师承同向的行为
 *   · `against` —— 与师承相左的行为
 *
 * 权重数值刻意不外露:改平衡时那些数会动,而「看重什么」不会。
 *
 * ## 权重表只有一份
 *
 * 这里从 `core/mentorService` 的 `MENTOR_WEIGHTS` 读,**不另写一份**。
 * 若这一层自己维护「什么加分」,改平衡时两边必然分叉(本仓「不做两本账」)。
 */
import { MENTOR_WEIGHTS } from "@/core/mentorService";
import type { MentorId } from "@/data/mentors";

/** 计数器键名 → 人话。玩家读的是行为,不是内部字段名。 */
const BEHAVIOR_TEXT: Record<string, string> = {
  kills: "斩妖除魔",
  bossKills: "斩落妖王",
  breakthroughs: "破境精进",
  pillsCrafted: "炼丹",
  pillsUsed: "服丹",
  buildingUpgrades: "营造洞府",
  offlineClaims: "坐收离线产出",
  explores: "游历四方",
  equipsGained: "寻得兵刃",
  events: "撞见际遇",
};

export interface MentorBehaviorAxes {
  /** 与师承同向的行为 */
  toward: string[];
  /** 与师承相左的行为 —— 这一半此前是无声的 */
  against: string[];
}

/**
 * 某条师承的行为轴。没有师承时返回 `null` —— 不造一份空的轴。
 *
 * 顺序沿用权重表里的键序,故同一份数据在界面上每次出现的位置都相同。
 */
export function mentorBehaviorAxes(mentorId: MentorId | null): MentorBehaviorAxes | null {
  if (!mentorId) return null;
  const weights = MENTOR_WEIGHTS[mentorId];
  if (!weights) return null;
  const toward: string[] = [];
  const against: string[] = [];
  for (const [key, weight] of Object.entries(weights)) {
    if (typeof weight !== "number" || weight === 0) continue;
    // 表里没有的键不猜 —— 宁可漏一条,也不印一个键名给玩家看
    const text = BEHAVIOR_TEXT[key];
    if (!text) continue;
    (weight > 0 ? toward : against).push(text);
  }
  return { toward, against };
}
