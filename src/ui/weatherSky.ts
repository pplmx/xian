/**
 * 夜色随天时 —— 首页那片星空该跟着今日天时变。
 *
 * ## 现状
 *
 * 首页顶上有「今日天时 · 凝霜 · 尚余 2:14」这一行 —— 信息对,也及时。
 * 但那片星空**永远一个样**:十一颗金星、同样的亮度、同样的呼吸。
 *
 * 玩家读到「月蚀」两个字,抬头看到一片明亮的星空 —— 那两个字就白写了。
 *
 * ## 做什么
 *
 * 把天时折成夜色的三个读数:星的**色**、星的**亮**、星的**多寡**。
 * 只影响首页那片装饰用的星空,不碰任何数值、判定、掉落。
 *
 * 十二种各写一套是内容工程;而"夜色有个调子"这件事,三档就够:
 *
 *   沉  —— 月蚀、罡风、仙劫日、雷鸣:星稀而晦
 *   暖  —— 赤阳、霞光、紫气东来:星偏赤金、偏浓
 *   清  —— 清和、天朗、凝霜、灵雨、仙雨:星清明(最平常的那一档)
 *
 * 分组依据是**天时本身的意思**:天被遮住/被吹动 → 沉;天被照亮/被染上颜色 → 暖;
 * 天干净着 → 清。这不是机械平均,是对十二个名字的读解。
 *
 * ## 为什么这值得做
 *
 * 这是本作里**唯一一个完全没有功能的东西**:不提示、不奖励、不判定 ——
 * 只是让"今天"与"昨天"在抬头时不一样。
 *
 * 放置游戏最缺的往往不是内容,是**此刻感**:玩家每次打开看到的都是同一屏。
 * 一行天时文字与一片跟着变的夜色,后者才让人觉得"现在是此刻,不是任意时刻"。
 *
 * ## 只做装饰
 *
 * 不 import store、不 import core —— 这个模块不该知道任何玩法。
 * 调用方把天时 id 传进来,它只回一份色与亮。
 */

/** 三档夜色的名字 —— 用于 data 锚与判据,不给玩家看 */
export const SKY_TIERS = ["clear", "warm", "dim"] as const;
export type SkyTier = (typeof SKY_TIERS)[number];

export interface WeatherSky {
  tier: SkyTier;
  /** 星的颜色:调色板 token 名,由界面换成 rgb() */
  tint: string;
  /** 星的亮度比例(0~1) */
  brightness: number;
  /** 露几颗星(1~11,与模板里 v-for 的 11 同源) */
  stars: number;
}

const CLEAR: WeatherSky = {
  tier: "clear",
  tint: "--color-gold-ink-rgb",
  brightness: 0.62,
  stars: 11,
};

const WARM: WeatherSky = {
  tier: "warm",
  tint: "--color-cinnabar-rgb",
  brightness: 0.74,
  stars: 11,
};

const DIM: WeatherSky = {
  tier: "dim",
  tint: "--color-ink-rgb",
  brightness: 0.34,
  stars: 6,
};

/**
 * 十八种天时各归哪一档 —— 四界全覆盖。
 *
 * 读解,按「天此刻是什么样子」:
 *
 *   天被挡住了 → 沉   月蚀(月色被吞) 罡风(风刃割面) 仙劫日(劫云压顶)
 *                     雷鸣(雷声隐隐) 法则潮(潮涌笼罩) 混沌潮(混沌覆天)
 *                     神威日(众神威压)
 *   天被照亮/染色 → 暖  赤阳(烈日) 霞光(云霞染天) 紫气东来(紫气)
 *                     神辉(神光普照) 本源涌动(本源翻涌)
 *   天干净着 → 清     清和 天朗 凝霜 灵雨 仙雨 道音(虚空澄明)
 *
 * ## 补全神界与混沌海那一半(飞升之后抬头要看得见换了个世界)
 *
 * 这张表原先只写前十二种(人界 9 + 仙界 3)。神界的神辉 / 法则潮 / 神威日
 * 与混沌海的混沌潮 / 本源涌动 / 道音**一个都没进来**,全走 `?? CLEAR` 兜底 ——
 * 玩家飞升之后,顶上写着「今日天时 · 神辉」,抬头还是人间界「天朗」那片星空。
 *
 * `weather.ts` 的文件头自己写着「飞升之后天象随界域而变」。界域名变了、
 * 境界名变了、天时名变了,只有那片天没变 —— 飞升最该有的体感正在这里失守。
 *
 * 三档够不够:够。这三档量的是「天此刻是什么样子」,与在哪个界无关;
 * 神辉与赤阳同为「被照亮」,归暖是对的。要的是**跨界之后夜色换了调子**,
 * 不是给十八个天时各写一套。
 */
const BY_WEATHER: Record<string, WeatherSky> = {
  // 人界
  yueshi: DIM,
  gangfeng: DIM,
  leiming: DIM,
  chiyang: WARM,
  xiaguang: WARM,
  qinghe: CLEAR,
  tianlang: CLEAR,
  ningshuang: CLEAR,
  lingyu: CLEAR,
  // 仙界
  xianjie: DIM,
  ziqi: WARM,
  xianyu: CLEAR,
  // 神界 —— 这一半原先整块漏着
  shenwei: DIM,
  faze: DIM,
  shenhui: WARM,
  // 混沌海 —— 同上
  hundunchao: DIM,
  benyuan: WARM,
  daoyin: CLEAR,
};

/**
 * 今日夜色。认不得的天时(新加的、旧档里的、传了个 undefined)给最平常的那一档 ——
 * 不抛错、不空白。
 */
export function skyOfWeather(id: string | undefined | null): WeatherSky {
  if (!id) return CLEAR;
  return BY_WEATHER[id] ?? CLEAR;
}

/**
 * 这个天时在表里有没有落处 —— 与 `skyOfWeather` 分开,是因为**「归清」与
 * 「没认出来」读出来是同一个值**(两者都返回 CLEAR)。
 *
 * 判据需要分得开这两件事:「道音」归清是对的(虚空澄明,天是干净的),
 * 而「神辉」走兜底是漏的。只看返回值分不出,故另开一只眼。
 */
export function knowsWeather(id: string | undefined | null): boolean {
  return Boolean(id) && id! in BY_WEATHER;
}
