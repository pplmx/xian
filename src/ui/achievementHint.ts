/**
 * 成就的「方向」—— 每条成就都要能归到一条可读的路
 *
 * 名称与条件已在界面上摊开;方向仍负责把它们收成卷目,让玩家一眼看见
 * 「这一路在做什么、还差哪些」。
 *
 * 故按条件给一条方向(「历练际遇」「炼丹」「渡劫与突破」…)。方向由**条件本身**推出,
 * 不是另写一张清单 —— 后者迟早与新条件脱节。achievementHint.spec 会扫 CounterKey
 * 的联合类型,要求每一个计数器都有方向:新增计数器却忘了给它定方向,测试直接点名。
 */
import type { AchvCond, CounterKey } from "@/types";

/** 计数器 → 方向。新增 CounterKey 必须在此补齐(由 achievementHint.spec 守着) */
export const COUNTER_DIRECTIONS: Record<CounterKey, string> = {
  kills: "历练征战",
  bossKills: "地界首领",
  battles: "历练征战",
  explores: "历练",
  events: "历练际遇",
  equipsGained: "装备",
  upgrades: "装备",
  decomposed: "装备",
  pillsUsed: "丹药",
  pillsCrafted: "炼丹",
  pillsFailed: "炼丹",
  gongfaLearned: "功法参悟",
  breakthroughs: "突破与渡劫",
  breakthroughFails: "突破与渡劫",
  tribulations: "突破与渡劫",
  reincarnations: "轮回转世",
  soulsRefined: "器魂",
  offlineClaims: "闭关归来",
  buildingUpgrades: "洞府经营",
};

/** 一条成就条件对应的方向 —— 未达成的条目靠它指路 */
export function achievementDirection(cond: AchvCond): string {
  switch (cond.type) {
    case "counter":
      return COUNTER_DIRECTIONS[cond.key];
    case "realm":
      return "境界精进";
    case "quality":
      return "掉落与鉴宝";
    case "custom":
      return "历程节点";
  }
}
