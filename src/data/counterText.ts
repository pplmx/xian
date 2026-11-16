/**
 * 计数器 → 行为的**人话**：一处唯一的说法。
 *
 * ## 为什么单独成文件
 *
 * 这张表原先只有半份，住在 `ui/mentorBehaviorAxes` 里，只收师承用得到的十个键。
 * 而「这一世的素行由哪些行为推出来」(`data/bondEvents` 的 `LEAN_COUNTERS`)
 * 用到了另外五个键（`tribulations` / `battles` / `upgrades` / `decomposed` /
 * `gongfaLearned`）—— 那里此前没有说法，于是同一件事在两处各有一张半表。
 *
 * 半表的问题不是「不够用」，是**它会诱导人再写第三张**。故收成全表：
 * `Record<CounterKey, string>` 强制满，新增计数器时类型系统当场点名。
 *
 * ## 与 `achievementHint` 的 `COUNTER_DIRECTIONS` 不是一回事
 *
 * ```text
 *   COUNTER_DIRECTIONS   「这一路归到哪个卷目」  历练征战 / 丹药 / 器魂
 *   COUNTER_BEHAVIOR     「你做了什么」          斩妖除魔 / 炼丹 / 参悟功法
 * ```
 *
 * 前者用来把成就收成可读的几组，后者用来告诉玩家「这一道是这么走出来的」。
 * 有几项字面相同（`kills` 两边都带「斩」），但它们的**用途**不同：
 * 改卷目分类不该改行为叙述，反之亦然。
 */
import type { CounterKey } from "@/types";

/** 计数器 → 行为。新增 CounterKey 必须在此补齐（`counterText.spec` 双向守着） */
export const COUNTER_BEHAVIOR: Record<CounterKey, string> = {
  kills: "斩妖除魔",
  bossKills: "斩落妖王",
  battles: "征战四方",
  explores: "游历四方",
  events: "撞见际遇",
  equipsGained: "寻得兵刃",
  upgrades: "淬炼装备",
  decomposed: "分解旧物",
  pillsUsed: "服丹",
  pillsCrafted: "炼丹",
  pillsFailed: "炸炉",
  gongfaLearned: "参悟功法",
  breakthroughs: "破境精进",
  breakthroughFails: "破境未成",
  tribulations: "渡劫",
  reincarnations: "兵解转世",
  soulsRefined: "凝炼器魂",
  offlineClaims: "坐收离线产出",
  buildingUpgrades: "营造洞府",
};

/** 一条计数器的行为说法 —— 表里没有时退回键名（宁可难看，也不静默编一个） */
export function counterBehavior(key: CounterKey): string {
  return COUNTER_BEHAVIOR[key] ?? key;
}
