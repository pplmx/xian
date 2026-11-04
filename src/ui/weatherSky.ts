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
 * 十二种天时各归哪一档。
 *
 * 读解:月蚀(月色被吞)、罡风(风刃割面)、仙劫日(劫云压顶)、雷鸣(雷声隐隐)
 * 四者都是"天被挡住了" → 沉。赤阳(烈日)、霞光(云霞染天)、紫气东来(紫气)
 * 三者都是"天被染上颜色" → 暖。其余五者天干净着 → 清。
 */
const BY_WEATHER: Record<string, WeatherSky> = {
  yueshi: DIM,
  gangfeng: DIM,
  xianjie: DIM,
  leiming: DIM,
  chiyang: WARM,
  xiaguang: WARM,
  ziqi: WARM,
  qinghe: CLEAR,
  tianlang: CLEAR,
  ningshuang: CLEAR,
  lingyu: CLEAR,
  xianyu: CLEAR,
};

/**
 * 今日夜色。认不得的天时(新加的、旧档里的、传了个 undefined)给最平常的那一档 ——
 * 不抛错、不空白。
 */
export function skyOfWeather(id: string | undefined | null): WeatherSky {
  if (!id) return CLEAR;
  return BY_WEATHER[id] ?? CLEAR;
}
