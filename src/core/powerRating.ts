/**
 * 战力分解 —— Phase 30.2
 *
 * 战力总数继续存在,但降级为"综合参考";五维星级承担"读懂构筑形状"的职责:
 * 进攻 / 生存 / 身法 / 恢复 / 机制。
 * 星级基于词条合计的定性分段,不做精确排名——两个 4 星构筑谁强,由环境与相性决定。
 */
import type { AnyStatKey, FinalStats, StatMods } from "@/types";
import { detectBuild } from "./buildDetect";
import { modOf } from "./statsCalc";

export interface PowerRating {
  /** 1~5 星 */
  attack: number;
  survival: number;
  speed: number;
  recovery: number;
  mechanics: number;
  labels: PowerDimension[];
  /** 星级分档:得分跨过哪一档就得几星 —— 界面解释「为什么是这个星」读它 */
  thresholds: Record<PowerDimKey, [number, number, number, number]>;
}

export type PowerDimKey = "attack" | "survival" | "speed" | "recovery" | "mechanics";

/** 一条「算进得分里的东西」:词条名 + 折算后的贡献(贡献之和 = 该维得分) */
export interface PowerTerm {
  label: string;
  /** 按该维权重折算后的贡献 —— 相加就是得分 */
  contribution: number;
  /** 原始词条值(面板上那个数),便于玩家对照 */
  raw: number;
}

export interface PowerDimension {
  key: PowerDimKey;
  name: string;
  stars: number;
  score: number;
  terms: PowerTerm[];
}

/**
 * 词条战力权重 —— 五维得分的线性项系数,单一来源。
 *
 * 战力面板的每一项(星级明细里的 contribution)与一键换装(equipBest.equippablePower)
 * 从这里取 —— 两边不各编一套数字(不做两本账)。两个特例不进表:
 *   · critRate 按「会心 ×(1+会心伤)」联乘,单独成式;
 *   · 机制维的「成路」是流派契合度,不是词条,也不在表里。
 */
export const POWER_STAT_WEIGHTS: Partial<Record<AnyStatKey, number>> = {
  // 进攻
  attackPct: 1,
  damageBonus: 1,
  armorPen: 0.8,
  executeDamage: 0.5,
  lowHpDamage: 0.5,
  fullHpDamage: 0.5,
  comboDamage: 0.4,
  counterDamage: 0.4,
  // 生存
  defensePct: 1,
  maxHpPct: 1,
  damageReduction: 2,
  shieldOnStart: 1,
  shieldPower: 0.5,
  dodgeRate: 1.5,
  // 身法
  speed: 2,
  firstStrike: 1,
  comboRate: 1.5,
  counterRate: 1.2,
  // 恢复(小数值键放大,量纲归一)
  lifesteal: 8,
  regenPerRound: 20,
  overhealShield: 0.6,
  lowHpReduction: 0.8,
};

/** 分段:score 依次跨过阈值得 2/3/4/5 星(低于首档为 1 星) */
function toStars(score: number, thresholds: [number, number, number, number]): number {
  let stars = 1;
  for (const t of thresholds) {
    if (score >= t) stars += 1;
  }
  return stars;
}

const THRESHOLDS: Record<PowerDimKey, [number, number, number, number]> = {
  attack: [0.25, 0.6, 1.0, 1.6],
  survival: [0.25, 0.6, 1.0, 1.6],
  speed: [0.15, 0.4, 0.7, 1.1],
  recovery: [0.15, 0.4, 0.8, 1.3],
  mechanics: [0.3, 0.55, 0.8, 1.1],
};

const DIM_NAMES: Record<PowerDimKey, string> = {
  attack: "进攻",
  survival: "生存",
  speed: "身法",
  recovery: "恢复",
  mechanics: "机制",
};

/**
 * 五维评级 —— 每一维都带上「它是怎么算出来的」。
 *
 * 面板此前只给星级:玩家看到「生存 ★★☆☆☆」,不知道差在哪一条词条。故这里
 * 每维都返回 terms —— **贡献之和恰好等于该维得分**,星级只是得分跨过阈值的结果。
 * 这与属性来源明细是同一条规矩:解释这个数,就得算得回这个数。
 */
export function ratePower(stats: FinalStats): PowerRating {
  const m: StatMods = stats.mods;
  const v = (k: Parameters<typeof modOf>[1]): number => Math.max(0, modOf(m, k));
  const term = (label: string, raw: number, weight = 1): PowerTerm => ({
    label,
    raw,
    contribution: raw * weight,
  });

  // 进攻:直接增伤 + 暴击期望 + 破甲/处决
  const critRaw = v("critRate");
  const critTerm: PowerTerm = {
    label: "暴击率×(1+暴伤)",
    raw: critRaw,
    contribution: critRaw * (1 + v("critDamage")),
  };
  const w = (k: AnyStatKey): number => POWER_STAT_WEIGHTS[k] ?? 0;
  const attackTerms = [
    term("攻击加成", v("attackPct"), w("attackPct")),
    term("造成伤害", v("damageBonus"), w("damageBonus")),
    critTerm,
    term("破甲", v("armorPen"), w("armorPen")),
    term("处决伤害", v("executeDamage"), w("executeDamage")),
    term("背水增伤", v("lowHpDamage"), w("lowHpDamage")),
    term("锋芒增伤", v("fullHpDamage"), w("fullHpDamage")),
    term("追击威力", v("comboDamage"), w("comboDamage")),
    term("反击威力", v("counterDamage"), w("counterDamage")),
  ];
  // 生存:防御/生命/减伤/盾/闪避
  const survivalTerms = [
    term("防御加成", v("defensePct"), w("defensePct")),
    term("气血加成", v("maxHpPct"), w("maxHpPct")),
    term("伤害减免", v("damageReduction"), w("damageReduction")),
    term("开战护盾", v("shieldOnStart"), w("shieldOnStart")),
    term("护盾强度", v("shieldPower"), w("shieldPower")),
    term("闪避率", v("dodgeRate"), w("dodgeRate")),
  ];
  // 身法:先手判定(阈值)/首回合伤害/连击率 —— 名字与 statNames 一致,面板与战力理由不许各叫各的
  const speedTerms = [
    term("先手判定", v("speed"), w("speed")),
    term("首回合伤害", v("firstStrike"), w("firstStrike")),
    term("连击率", v("comboRate"), w("comboRate")),
    term("反击概率", v("counterRate"), w("counterRate")),
  ];
  // 恢复:吸血/回合回复/溢疗(量纲归一:小数值键放大)
  const recoveryTerms = [
    term("吸血", v("lifesteal"), w("lifesteal")),
    term("回合回复", v("regenPerRound"), w("regenPerRound")),
    term("溢疗转盾", v("overhealShield"), w("overhealShield")),
    term("残血减伤", v("lowHpReduction"), w("lowHpReduction")),
  ];
  // 机制:流派成路程度 + 混合副系
  const build = detectBuild(m);
  const mechanicsTerms: PowerTerm[] = [];
  if (build) {
    mechanicsTerms.push({
      label: `成路·${build.style.name}`,
      raw: build.affinity,
      contribution: build.affinity,
    });
    const second = build.secondary;
    if (second) {
      mechanicsTerms.push({
        label: `副系·${second.style.name}`,
        raw: second.affinity,
        contribution: second.affinity * 0.6,
      });
    }
  }

  const dims: Record<PowerDimKey, PowerTerm[]> = {
    attack: attackTerms,
    survival: survivalTerms,
    speed: speedTerms,
    recovery: recoveryTerms,
    mechanics: mechanicsTerms,
  };
  /*
   * 得分与 terms 是两条独立的表达式,但**权重都从 POWER_STAT_WEIGHTS 取** ——
   * 那不是同义反复:明细那一路仍要逐条列出键、得分这路仍要逐一列键,
   * 哪边漏了键、或键不在表上,«明细之和 = 得分» 的判据立刻红。
   * 权重表是唯一的事实源,不在这两处各写一遍数字。
   */
  const linear = (keys: AnyStatKey[]): number =>
    keys.reduce((s, k) => s + (POWER_STAT_WEIGHTS[k] ?? 0) * v(k), 0);
  const scores: Record<PowerDimKey, number> = {
    // 会心是「会心 ×(1+会心伤)」的联乘,不进线性表;其余进攻项全走表
    attack:
      v("critRate") * (1 + v("critDamage")) +
      linear([
        "attackPct",
        "damageBonus",
        "armorPen",
        "executeDamage",
        "lowHpDamage",
        "fullHpDamage",
        "comboDamage",
        "counterDamage",
      ]),
    survival: linear([
      "defensePct",
      "maxHpPct",
      "damageReduction",
      "shieldOnStart",
      "shieldPower",
      "dodgeRate",
    ]),
    speed: linear(["speed", "firstStrike", "comboRate", "counterRate"]),
    recovery: linear(["lifesteal", "regenPerRound", "overhealShield", "lowHpReduction"]),
    mechanics: build ? build.affinity + (build.secondary?.affinity ?? 0) * 0.6 : 0,
  };
  const labels: PowerDimension[] = (Object.keys(DIM_NAMES) as PowerDimKey[]).map((key) => {
    const terms = dims[key].filter((t) => t.contribution !== 0);
    const score = scores[key];
    return { key, name: DIM_NAMES[key], stars: toStars(score, THRESHOLDS[key]), score, terms };
  });
  const stars = Object.fromEntries(labels.map((l) => [l.key, l.stars])) as Record<
    PowerDimKey,
    number
  >;
  return { ...stars, labels, thresholds: THRESHOLDS };
}

/** ★★★☆☆ 形式 */
export function ratingStars(stars: number): string {
  const n = Math.max(1, Math.min(5, stars));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
