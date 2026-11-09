/**
 * 前世今生并排 —— 同一个天平,两边都得看得见
 *
 * ## 缺口:弹窗只摊开了「来世抽到什么」,没摊开「换掉了什么」
 *
 * 「来世根骨」把来世灵根、资质地板、一根资质的期望都写清了,玩家知道下一手大概什么水平。
 * 但灵根是**重掷**的:真正要权衡的是「我手里这副会不会被换掉」。弹窗一个字都没说本世
 * 灵根是什么,于是玩家只能凭记忆比较 —— 而记忆正好在这一刻最不可靠:这个弹窗只在
 * 寿元耗尽时出现,离上一次看人物页可能过了几天。
 *
 * ## 只比同一类量
 *
 * 灵根强弱由两件事决定:**根数**(越少倍率越高:单根 1.6 对五根 0.9)与**均资质**
 * (`growthMult` 用的就是这个口径,见 `rollLinggen`)。两者都在 `LinggenProfile` 上现成,
 * 不需要新算法。故对照只报这两样加一个差,**不编综合评分** —— 评分是第二套价值判断,
 * 迟早会与引擎的成长倍率分叉。
 *
 * ## 但真正的答案是倍率,不是根数
 *
 * 第一版只报了「根数 2 → 3 · 多 1 根」与均资质 —— 而根数越**多**倍率越**低**,
 * 于是「多 1 根」读起来像变好,实际是变差(实测:两枚根均 90 = 2.03,
 * 三枚根均 90 = 1.73)。真正要权衡的量是 `growthMult`,引擎已经在
 * `LinggenProfile` 上算好了(均资质 / 60 × 根数系数,混沌灵根再乘 1.5)。
 *
 * 故这里**直接读那个字段**,不按根数自己乘一遍 —— 自己乘会立刻漏掉混沌那 1.5
 * (它是 `rollLinggen` 里的独立分支),那就是第二本账。
 *
 * ## 这一层只算,不读 store
 *
 * 与 `ui/lifeLinggen`、`ui/reincarnationDesk` 同一条纪律:收参数、给纯值。
 */
import type { LinggenProfile } from "@/types";

/** 一副灵根里只拿来比较的那几样 */
export interface LinggenSide {
  /** 品阶名 */
  grade: string;
  /** 根数 —— 越少倍率越高 */
  count: number;
  /** 均资质 —— 与 `growthMult` 同一个口径 */
  average: number;
  /**
   * 修行倍率 —— **引擎算好的那一个**(`rollLinggen` 的 `growthMult`)。
   * 界面不许按根数自己乘一遍:混沌灵根走的是另一个分支(再乘 1.5),
   * 自己乘会把它漏掉。这才是玩家在天平上真正权衡的量。
   */
  mult: number;
}

export interface LinggenCompare {
  /** 本世(将被换掉的那一副) */
  from: LinggenSide;
  /** 来世(掷出来的那一副) */
  to: LinggenSide;
  /** 来世减本世的均资质差;正数是变好 */
  averageDelta: number;
  /** 来世减本世的根数差;负数是少几根(好事) */
  countDelta: number;
  /**
   * 来世减本世的修行倍率差 —— **这一项才是「变好还是变差」的答案**。
   * 根数差与它可能反向(根数变多、倍率反而变低),故两者都要报。
   */
  multDelta: number;
}

/** 资质要能读才算数 —— 与灵根牌面同一套口径 */
function sideOf(profile: LinggenProfile | undefined | null): LinggenSide | null {
  if (!profile || !Array.isArray(profile.roots) || profile.roots.length === 0) return null;
  const aptitudes = profile.roots
    .map((root) => root?.aptitude)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  // 有根但一根都读不出资质 → 不比(印一张「?」对照没有意义)
  if (aptitudes.length === 0) return null;
  const average = aptitudes.reduce((sum, value) => sum + value, 0) / aptitudes.length;
  /*
   * 倍率必须读得到 —— 它是这个对照的主角。缺失或不是有限数时整块不出:
   * 印一行「倍率 ?」比不印更糟(玩家会以为界面坏了)。
   */
  const mult = profile.growthMult;
  if (typeof mult !== "number" || !Number.isFinite(mult)) return null;
  return {
    grade: profile.gradeName,
    count: profile.roots.length,
    average,
    mult,
  };
}

/**
 * 本世与来世的灵根对照。
 *
 * 任一侧缺失或读不出资质时返回 `null` —— 宁可整块不出,也不印半张对照。
 * 调用方据此决定渲染与否,不必自己再判断一次(过滤口径只写在一处)。
 */
export function linggenCompare(
  from: LinggenProfile | undefined | null,
  to: LinggenProfile | undefined | null,
): LinggenCompare | null {
  const a = sideOf(from);
  const b = sideOf(to);
  if (!a || !b) return null;
  return {
    from: a,
    to: b,
    averageDelta: b.average - a.average,
    countDelta: b.count - a.count,
    multDelta: b.mult - a.mult,
  };
}
