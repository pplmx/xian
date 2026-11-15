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
import {
  buildTribulationPlan,
  tribulationKindFor,
  verdictLabel,
  NO_STAT_GUARD,
  type TribStatGuard,
  type TribulationPlan,
} from "@/core/tribulationDecision";
import { weatherDef, type WeatherId } from "@/core/weather";
import { NO_RELIEF, type TribulationRelief } from "@/data/linggenAffinity";
import type { StatMods } from "@/types";

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

/** 「那一天渡劫怎么样」—— 一行里的一格 */
export interface DayPayoff {
  /** 第几天(今天之后的第 N 天,1 起) */
  day: number;
  /** 那天的天时 */
  weatherId: WeatherId;
  /** 那天渡劫的把握(与 `buildTribulationPlan` 同一个数) */
  rate: number;
  /** 那天的决策档中文名(「稳渡 / 可渡 / 中等 / 高风险」) */
  verdict: string;
}

/** 「等一天值不值」的读数 */
export interface TribulationWaitPayoff {
  /** 今天渡的把握 */
  todayRate: number;
  /** 今天渡的决策档 */
  todayVerdict: string;
  /** 接下来几天逐天的读数(含今天,**已按天排好**) */
  days: DayPayoff[];
  /** 其中把握最高的那一天(第几天,1 起;等于今天时是 0) */
  bestDay: number;
  /** 最好那天的把握 */
  bestRate: number;
  /** 最好那天的决策档 */
  bestVerdict: string;
  /**
   * 这一眼望出去**看得到几天**（含今天）。
   *
   * 它是「再等 N 天最好也只到 Y%」那一句里的 N 的来源,必须与真正被算过的天数
   * 一致 —— 用 `days.length` 会少算:与今天同天时的那几天被跳过了(它们的结果
   * 必然与今天相同),于是「再等 3 天」说的其实是一个只看了 2 天的视野。
   */
  horizonDays: number;
  /**
   * 值不值得等 —— **只看档位有没有变**,不看把握涨了几个百分点。
   *
   * 理由在判据文件头:天时只把伤害乘上 0.92~1.12,而决策档是按水位切的。
   * 把握从 33% 涨到 39% 在界面上仍然是同一个「高风险」—— 那时说"等更好"
   * 就是让玩家白等一天。跨档才是他读得懂、也真的会改变决定的那个变化。
   */
  worthWaiting: boolean;
}

/**
 * 「等一天值不值」—— 上一轮那一行只报了劫名,却没答这个问题。
 *
 * ## 为什么这一行必须给出数
 *
 * 第 358 轮补的那行是「此劫随天时变 · 今日「裂魂」，此后还会遇「重压」、「雷鸣」」。
 * 它说清了答案每天会变,却**没说变好还是变坏**。而实测下来:
 *
 * ```text
 * m1 裸身   20 天里档位恒为「高风险」   把握 33~39%
 * m3 裸身   20 天里档位恒为「高风险」   把握 29~33%
 * m8 裸身   20 天里档位恒为「高风险」   把握 27~29%
 * ```
 *
 * 把三个劫名摆出来,读起来像"三选一",而实际上**选哪个都掉在同一档里**。
 * 玩家会为了一个不存在的好处去等 —— 那比不告诉他更糟。
 *
 * 而堆过抗性之后确实能跨档:
 *
 * ```text
 * m3 中量抗性   档位 [可渡 / 高风险 / 中等]   把握 40~65%
 * m5 重度抗性   档位 [稳渡 / 可渡]             把握 80~95%
 * ```
 *
 * 故这一行的口径是**「等下去最好的那天能好多少」**,而不是「还有哪几种劫」。
 *
 * ## 不做两本账
 *
 * 每一个把握都由 `buildTribulationPlan` 算出 —— 与破境卡上「此劫」那一格、
 * 与真正的结算都是同一个函数。这一层只负责把天时喂进去、把结果按天排开。
 *
 * ## 不读 store
 *
 * 天时 id 由调用方给(界面本来就有 `todayWeather` / `upcomingWeather`)。
 * 往这里塞 `todayWeather()` 会把 pinia 拉进一个本该纯的模块 ——
 * 本仓为这件事已经付过一次代价(见文件头的 `getActivePinia()` 那条)。
 */
export function bestDayToBreakThrough(
  targetMajor: number,
  mods: StatMods,
  relief: TribulationRelief = NO_RELIEF,
  todayWeatherId: string = "",
  upcomingWeatherIds: readonly string[] = [],
  stat: TribStatGuard = NO_STAT_GUARD,
): TribulationWaitPayoff | null {
  if (!Number.isFinite(targetMajor) || targetMajor < 0) return null;
  if (upcomingWeatherIds.length === 0) return null;

  /** 某一天渡劫的完整计划 —— 与结算同一个入口 */
  const planOn = (weatherId: string): TribulationPlan | null => {
    const w = weatherDef(weatherId as WeatherId);
    if (!w) return null;
    return buildTribulationPlan(
      targetMajor,
      mods,
      tribulationKindFor(targetMajor, weatherId),
      relief,
      w.tribulationMult,
      stat,
    );
  };

  const todayPlan = planOn(todayWeatherId);
  if (!todayPlan) return null;

  /*
   * 「今天」也放进 `days` 里,`day = 0`。
   *
   * 这样「最好的一天」的计算天然包含"今天就是最好的那天"这个答案 ——
   * 否则它会永远从明天开始找,于是**今天已经最优时仍报出一个更差的明天**,
   * 那就是让玩家朝坏方向走。
   */
  const days: DayPayoff[] = [
    {
      day: 0,
      weatherId: todayWeatherId as WeatherId,
      rate: todayPlan.expectedRate,
      verdict: verdictLabel(todayPlan.verdict),
    },
  ];
  let best = days[0]!;
  for (const [i, wid] of upcomingWeatherIds.entries()) {
    if (typeof wid !== "string" || wid.length === 0) continue;
    // 与今天同一条天时不必重复算 —— 它的结果必然与今天相同
    if (wid === todayWeatherId) continue;
    const plan = planOn(wid);
    if (!plan) continue;
    const row: DayPayoff = {
      day: i + 1,
      weatherId: wid as WeatherId,
      rate: plan.expectedRate,
      verdict: verdictLabel(plan.verdict),
    };
    days.push(row);
    if (row.rate > best.rate) best = row;
  }

  return {
    todayRate: todayPlan.expectedRate,
    todayVerdict: verdictLabel(todayPlan.verdict),
    days,
    bestDay: best.day,
    bestRate: best.rate,
    bestVerdict: best.verdict,
    // 今天 + 看得见的未来那几天（含与今天相同的天时 —— 它们也是"被望到的一天"）
    horizonDays: 1 + upcomingWeatherIds.length,
    // 只看档位:涨了几个百分点但没跨档,玩家在界面上看到的是同一个词
    worthWaiting: best.verdict !== verdictLabel(todayPlan.verdict),
  };
}
