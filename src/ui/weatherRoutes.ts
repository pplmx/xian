/**
 * 天时 → 今天该去做什么 —— 「气运 +5%」这句话本身不指向任何页面。
 *
 * ## 由来
 *
 * 首页的定位在 `docs/development.md` 里写着:
 *
 * > **主页的定位是"指挥台"不是"操作台"** —— 它回答「现在该做什么」，
 * > 然后把玩家送到那一页。
 *
 * 天时那一块把**效果**说全了（`modsText` 同源、渡劫倍率带单位、明日预告同口径），
 * 却没有说**这件事意味着今天该去做什么**:
 *
 * ```text
 *   今日天时 · 月蚀        尚需修行 3 时 12 分
 *   月华暗涌，气运偏移。
 *   气运 +5% · 掉落率 +5%      ← 这两个词对新手完全不可行动
 * ```
 *
 * 「气运 / 掉落率」只在**打怪结算**里生效（`core/loot` 的 `dropEntriesFor` / `luck`），
 * 而打怪在历练页。这一层把那条推论写出来。
 *
 * 同一屏上的「今日日课」有过完全一样的问题并且已经修过（见 `ui/dailyRoutes`）:
 * 「今日击败 15 个敌人」原先也是八个不可点的 `<li>`，玩家知道要做什么、
 * 不知道去哪儿做。天时这一块是同一屏上**剩下那一处**同型缺失。
 *
 * ## 为什么按「活动」归，而不是按天时逐条手写
 *
 * 18 条天时分属四个界域、还在长（第 358 轮才发现池子从 5 条长到 9 条时
 * 权重没跟着改）。逐条手写一张 18 行的表，下一次加天时就会漏。
 *
 * 故映射的**键是「这一天该去做什么」**，而判据按 `mods` 反推:
 * 带战斗向词条的必须指向历练、带修炼向的必须指向修行。加一条天时只要它的
 * 词条落在这两类里，去处就是自明的；落不进任何一类时判据会红，由人来决定
 * 它算哪一类 —— 这比"忘了补表"要吵得早。
 *
 * ## 与「等一天值不值」的关系
 *
 * 两者都在天时这一块，但答的不是同一件事:
 *
 * ```text
 * 等一天值不值   破境卡上   跨的是渡劫那一天（今天渡还是过几天渡）
 * 今天该去哪     首页天时   跨的是今天这一整天（今天做什么划算）
 * ```
 *
 * 前者只在站到大关前才有意义，后者每一天都有 —— 故不合并。
 */
import type { StatMods } from "@/types";

/** 今天该去做什么 */
export interface WeatherRouteHint {
  /** 去哪儿做（绝对路由） */
  route: string;
  /** 那一格的入口名（写进行尾那枚小字） */
  label: string;
  /**
   * 一句提醒 —— 只在「今天的条件下做那件事要小心」时给。
   *
   * 目前只有渡劫更险的那几条天时用（雷鸣 / 仙劫日 / 神威日）:
   * 它们同时带攻击词条（故按词条会指向历练），而玩家在那些日子最该知道的
   * 不是"去打怪"，而是"别急着渡劫"。
   */
  caution?: string;
}

/**
 * 天时 id → 去处。
 *
 * 口径与 `ui/dailyRoutes` 同一条:**这件事在哪个页面由玩家亲手做**。
 * 不是「哪个系统在算它」—— `dropRate` 由战斗算，而玩家亲手打怪的地方是历练页。
 */
export const WEATHER_ROUTES: Readonly<Record<string, WeatherRouteHint>> = {
  // ---- 人间界 ----
  // 灵气恢复 + 修炼速度:静坐、闭关、攒修为
  lingyu: { route: "/cultivation", label: "宜静修" },
  // 攻击 + 伤害增幅:去打
  chiyang: { route: "/adventure", label: "宜历练" },
  // 气运 + 掉落率:打怪的掉落是它唯一的出口
  yueshi: { route: "/adventure", label: "宜历练" },
  // 攻击 + 御劫下降:能打,但渡劫更险 —— 两件事都说
  leiming: {
    route: "/adventure",
    label: "宜历练",
    caution: "雷伤加重，不宜此刻渡劫",
  },
  // 无效果:照常。整条不出会让这一行每三天消失一次
  qinghe: { route: "/", label: "今日无碍" },
  // 先手 + 闪避:都是战斗里的字
  gangfeng: { route: "/adventure", label: "宜历练" },
  // 防御 + 灵气恢复:偏守，且能修行
  ningshuang: { route: "/cultivation", label: "宜静修" },
  // 战斗修为 + 气运:两条都在打的时候才吃到
  xiaguang: { route: "/adventure", label: "宜历练" },
  // 灵气恢复 + 气血上限:能修行
  tianlang: { route: "/cultivation", label: "宜静修" },

  // ---- 仙界 ----
  xianyu: { route: "/cultivation", label: "宜静修" },
  ziqi: { route: "/adventure", label: "宜历练" },
  xianjie: {
    route: "/adventure",
    label: "宜历练",
    caution: "雷伤加重，不宜此刻渡劫",
  },

  // ---- 神界 ----
  shenhui: { route: "/adventure", label: "宜历练" },
  faze: { route: "/cultivation", label: "宜静修" },
  shenwei: {
    route: "/adventure",
    label: "宜历练",
    caution: "雷伤加重，不宜此刻渡劫",
  },

  // ---- 混沌海 ----
  hundunchao: { route: "/cultivation", label: "宜静修" },
  benyuan: { route: "/adventure", label: "宜历练" },
  // 气运 + 掉落率 + 进阶成功率:气运两项都只在打的时候吃到，
  // 而进阶成功率是全局的 —— 主要仍是「去打」
  daoyin: { route: "/adventure", label: "宜历练" },
};

/**
 * 某条天时的去处。
 *
 * 表里没有就返回 null —— 调用方据此整条不出（而不是编一句空话）。
 * 「表不满」由 `weatherRoutes.spec` 挡住，故产品里正常取不到 null。
 */
export function weatherRouteOf(weather: { id: string; mods?: StatMods }): WeatherRouteHint | null {
  return WEATHER_ROUTES[weather.id] ?? null;
}
