/**
 * 日课 → 去哪儿做 —— 「今日击败 15 个敌人」这句话没说要往哪走。
 *
 * ## 由来（第 163 轮，从「玩家不知道自己能做什么」这一侧看）
 *
 * 首页「今日日课」列着八笔，每笔都把进度、赏格摊开 —— 做得很好。而它们是八个
 * 不可点的 `<li>`（实测 `clickable: false` × 8）:
 *
 * ```text
 * 01 今日击败 15 个敌人   得 灵石 249.9万   0/15
 * 02 今日服用 1 枚丹药     得 灵草×8         0/1
 * 04 今日炼成 2 枚丹药     得 悟道点×6       0/2
 * ```
 *
 * 一个刚上手的玩家读完这八行，知道**要做什么**，却不知道**去哪儿做**：
 * 「击败敌人」在历练页、「炼成丹药」在背包的丹药册、「强化装备」也在背包、
 * 「完成历练」还是历练页。这些路径老玩家烂熟，新玩家没有一条是写在屏上的。
 *
 * ## 为什么这是可玩性缺陷，而不是「多此一举」
 *
 * 放置游戏的核心循环是「打开 → 看有什么该做 → 去做 → 关掉」。第三与第四步之间
 * 那一段导航，是玩家每天要重复八次的动作。首页已经是「今天该做什么」的那一屏，
 * 却把「怎么去」留在了玩家的记忆里。
 *
 * 别处没有这个问题：门径那两格（洞府 / 天界）都是 `RouterLink`，写着「入府 →」
 * 「踏天 →」。日课是首页**唯一**一组「给了任务却不给路」的条目。
 *
 * ## 判据
 *
 * 映射表必须是**满的**:每一个 `CounterKey` 都有去处，且去处是一条真路由。
 * 缺一条不是「少了个链接」—— 是那个日课永远只能靠玩家自己想起来。
 */
import type { CounterKey } from "@/types";

export interface DailyRouteHint {
  /** 去哪儿做 */
  route: string;
  /** 那一格的入口名（写进 aria-label 与行尾那枚小字） */
  label: string;
}

/**
 * 计数器 → 去处。
 *
 * 口径是「**这件事在哪个页面由玩家亲手触发**」，不是「哪个系统在算它」。
 * 例:`kills` 由战斗算，而玩家亲手打怪的地方是历练页（不是首页）。
 */
export const DAILY_ROUTES: Readonly<Record<CounterKey, DailyRouteHint>> = {
  // 打怪、斩将、成历练 —— 全在历练页
  kills: { route: "/adventure", label: "去历练" },
  battles: { route: "/adventure", label: "去历练" },
  bossKills: { route: "/adventure", label: "去斩将" },
  explores: { route: "/adventure", label: "去历练" },
  // 炼成丹药 / 服药 —— 背包的丹药册（开炉弹窗在那儿）
  pillsCrafted: { route: "/inventory", label: "去开炉" },
  pillsUsed: { route: "/inventory", label: "去服药" },
  pillsFailed: { route: "/inventory", label: "去开炉" },
  // 强化、分解、得装备 —— 背包
  upgrades: { route: "/inventory", label: "去强化" },
  decomposed: { route: "/inventory", label: "去分解" },
  equipsGained: { route: "/adventure", label: "去历练" },
  // 突破与渡劫 —— 修行页
  breakthroughs: { route: "/cultivation", label: "去破境" },
  breakthroughFails: { route: "/cultivation", label: "去破境" },
  tribulations: { route: "/cultivation", label: "去渡劫" },
  // 参悟功法 —— 修行页的功法章
  gongfaLearned: { route: "/cultivation", label: "去参悟" },
  // 际遇 —— 历练途中撞见
  events: { route: "/adventure", label: "去历练" },
  // 转世 —— 人物页的往生帖
  reincarnations: { route: "/character", label: "去转世" },
  // 魂修 —— 人物页 / 天界
  soulsRefined: { route: "/character", label: "去炼魂" },
  // 离线回执 —— 回首页就能领（本页即是）
  offlineClaims: { route: "/", label: "就在本页" },
  // 营造 —— 洞府页
  buildingUpgrades: { route: "/dongfu", label: "去营造" },
};

/** 一条日课的去处 —— 表里没有就返回 null（新加的计数器要先补表） */
export function dailyRouteOf(key: string): DailyRouteHint | null {
  return (DAILY_ROUTES as Record<string, DailyRouteHint | undefined>)[key] ?? null;
}
