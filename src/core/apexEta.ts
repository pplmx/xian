/**
 * 「按此刻行速，到大道尽头还要多久」—— 长线目标的时间尺度。
 *
 * ## 为什么需要这个函数
 *
 * 修行页原本只有**本境 ETA**（「约 13 秒」）。而用 `core/progressionSim`
 * 跑完整条曲线，到末境要 **5477 小时（约 228 天）**。那条曲线是刻意的，
 * 但它对玩家完全不可见:玩家在第一天只能看到「下一层 13 秒」，
 * 没有任何办法判断这条路有多长。
 *
 * ## 与 `progressionSim` 的分工
 *
 * - `progressionSim` 回答「**模型假设下**每一境要多久」—— 它用
 *   `estimateCultMult(major, daoFruit)` 推算一个**通用**玩家的加成倍率，
 *   服务于设计对账（「真仙 73 天」这类文档读数）。
 * - 本模块回答「**这位玩家此刻**到顶还要多久」—— 它拿玩家真实的
 *   `cultPerSec`，按每个剩余境界的**基础速度比例**折过去。
 *
 * 两者不能互相顶替:模型假设对设计对账是对的，对单个玩家是错的
 * （他可能刚吃了丹、刚换了法宝、刚转世）。
 *
 * ## 算法
 *
 * 设玩家当前基础速度 `base0`（不含任何加成），实际速度 `cult`，
 * 则他的加成倍率 `mult = cult / base0`。对每个剩余层 `(m, s)`:
 *
 * ```text
 * 耗秒 = expRequirement(m, s) / (baseCultPerSec(m, s) × mult)
 * ```
 *
 * **加成倍率在整个剩余旅程里按常数处理** —— 这是刻意的简化，也是文案里
 * 必须写「按此刻行速」的原因:玩家会继续变强，所以真实时间通常**更短**。
 * 报一个精确到达日才是撒谎。
 */
import { baseCultPerSec, expRequirement } from "./formulas";
import { toNum } from "@/utils/gnum";
import { formatDuration } from "@/utils/format";
import { SUB_LEVELS } from "@/data/constants";
import { MAX_MAJOR } from "@/data/realms";

export interface ApexEta {
  /** 剩余秒数；已到顶为 0 */
  remainSec: number;
  /** 是否已至大道尽头 */
  atApex: boolean;
  /**
   * 这一刻的加成倍率（`cultPerSec / baseCultPerSec(当前层)`）。
   * 界面拿它说「按此刻行速」的那层限定；<=0 表示速度不可用。
   */
  speedMult: number;
}

/**
 * 按玩家此刻的修为速度，算到末境圆满还要多久。
 *
 * @param major 当前大境界
 * @param sub 当前层（0..SUB_LEVELS-1）
 * @param cultPerSec 玩家此刻的修为/秒（含全部加成）
 */
export function apexEta(major: number, sub: number, cultPerSec: number): ApexEta {
  const atApex = major >= MAX_MAJOR && sub >= SUB_LEVELS - 1;
  if (atApex) return { remainSec: 0, atApex: true, speedMult: 0 };

  /*
   * 速度不可用（0 / NaN / 负数）时不给一个假的「∞」——
   * 返回 remainSec = 0 但 atApex = false，由界面决定怎么讲（通常是「速度不可用」）。
   * 直接返回 Infinity 会让 formatDuration 印出「Infinity 天」。
   */
  const base = baseCultPerSec(major, sub);
  const speed = Number.isFinite(cultPerSec) && cultPerSec > 0 ? cultPerSec : 0;
  if (base <= 0 || speed <= 0) return { remainSec: 0, atApex: false, speedMult: 0 };
  const speedMult = speed / base;

  let sec = 0;
  for (let m = major; m <= MAX_MAJOR; m += 1) {
    // 当前这一境只算「还没修完的那几层」；
    // 越界（major < 0 / sub >= SUB_LEVELS）按起点或全境处理，不崩
    const from = m === major ? Math.max(0, sub) : 0;
    for (let s = from; s < SUB_LEVELS; s += 1) {
      const need = toNum(expRequirement(m, s));
      const rate = baseCultPerSec(m, s) * speedMult;
      if (rate > 0 && Number.isFinite(need)) sec += need / rate;
    }
  }
  return { remainSec: Number.isFinite(sec) ? sec : 0, atApex: false, speedMult };
}

/**
 * 把 `apexEta` 的结果拼成**给玩家看的那一句**。
 *
 * 抽成纯函数是为了可测:第一版把这句写死在视图的 computed 里，
 * 于是「数百天报到了小时」这种虚假精度只能靠肉眼看出来。
 *
 * 分档见 `longRangePrecision.spec`:
 *
 * ```text
 * 到顶        已至大道尽头 —— 此世修行到此为止。
 * 一天以内    交给 formatDuration（秒/分/小时在那个量级有意义）
 * 一天 ~ 百天  报「N 天」
 * 百天以上    报「约 N 天」,百位取整
 * ```
 *
 * 百位取整是刻意的:数百天量级上,个位与十位没有决策价值 ——
 * 玩家要判断的是「这是几个月的事,还是几年的事」。而那个数随 buff 到期
 * 与灵气涨落每刷新都在跳,**看起来精确却在抖**比明确粗粒度更误导。
 */
export function apexEtaText(major: number, sub: number, cultPerSec: number): string {
  const eta = apexEta(major, sub, cultPerSec);
  if (eta.atApex) return "已至大道尽头 —— 此世修行到此为止。";
  // 速度不可用（0 / NaN / 负数）:不印数字，也不印 Infinity
  if (eta.remainSec <= 0) {
    return Number.isFinite(cultPerSec) && cultPerSec > 0
      ? ""
      : "此刻行速不可用 —— 先让修为跑起来。";
  }
  const days = eta.remainSec / 86400;
  if (days < 1) return `按此刻行速,至大道尽头约 ${formatDuration(eta.remainSec)}`;
  if (days < 100) return `按此刻行速,至大道尽头约 ${Math.round(days)} 天`;
  return `按此刻行速,至大道尽头约 ${Math.round(days / 100) * 100} 天`;
}
