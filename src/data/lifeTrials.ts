/**
 * 逆旅契(道果的第一个非效率出口)
 *
 * ## 它要解决什么
 *
 * 道果此前只进不出:无限积累、零消费,且自动汇入修炼速度与战力。
 * 出口空间审计已经把边界钉死 —— **发放物不得属于 StatMods 命名空间,
 * 也不得是可兑换成它的资源**,否则回路只是多绕两跳又接回来。
 *
 * 逆旅契是按这条约束造出的第一个出口:
 *
 *   花道果 → 为这一世签一份只加难度的契 → 本世历练全程生效
 *          → 转世时记入履历 → 记录不进任何计算
 *
 * ## 为什么回报只能是「记录」
 *
 * 这不是保守,是判据推出来的唯一解。逐条试过:
 *   给属性   → 直接落在 StatMods 里
 *   给资源   → 灵石换强化换战力,三跳回环
 *   给宿慧   → 宿慧进 aptitudeFloorNow,资质进 growthMult,再进 cultivationSpeed
 *   给道果   → 自供能循环,道果生道果
 * 四条路全被堵死,剩下的只有「这一世确实与众不同,且它被记住了」。
 *
 * ## 只许加难,不许减难
 *
 * 契约施加的是 CombatRules。规则本身若让战斗变容易,等价于给了效率 ——
 * 所以每一条都必须是纯逆境,由 isPurelyAdverse 强制校验。
 */
import type { CombatRules, StatMods } from "@/types";

/** 这一世签下的契(存档结构) */
export interface LifeTrialState {
  trialId: string;
  /** 签约时刻 */
  at: number;
  /** 实付道果 —— 记账用,不参与任何计算 */
  paid: number;
}

export interface LifeTrialDef {
  id: string;
  name: string;
  /** 印文(单字) */
  seal: string;
  /** 契文 */
  desc: string;
  /** 规则说明(玩家可见) */
  ruleText: string;
  /** 签约要花的道果 */
  cost: number;
  /** 本世生效的战斗规则,只许加难 */
  rules: CombatRules;
  /**
   * 本世只走几段路(第 470 轮)。
   *
   * 这是第一份**不碰 CombatRules** 的契 —— `trialMotivation.spec` 的诊断说得很直白:
   *
   * > 改变只发生在战斗内部,一世的结构没变 —— 同样的区域、同样的顺序、同样的目标。
   * > 故要提高动机,该扩的是玩法面(历练/物品/顺序/目标),不是补奖励
   *
   * 而它给的边界里「历练路线」是可动的。故这一份只做一件事:**这一世短两段**。
   *
   * 为什么这是纯逆境:每段的强度不变,所以同样的层级要在更少的段里爬完;
   * 少走的段里那些敌群、首领与掉落也一并没了。它不是奖励,也不是减难,
   * 是这一世的**形状**变了。
   *
   * 与 `rules` 互斥地存在 —— 判据 `trialRouteBind.spec` 守着「填了这个就不许填 rules」,
   * 免得它悄悄退回老路。
   */
  routeStages?: number;
  /**
   * 本世禁用哪一类物品（第 473 轮）。
   *
   * 这是第三份**不碰 CombatRules** 的契，动的是可动空间里那第三项「可用物品」。
   *
   * 与 `rules` 的差别：`rules` 改的是**战斗怎么算**，这一项改的是**你带什么进场**。
   * 前者让同样的构筑打得更难，后者让构筑本身少一块 —— 玩家要换的不是打法，
   * 而是**这一世用什么立身**。
   *
   * 三份契（routeStages / bannedItemKind / rules）互斥地存在 ——
   * 判据 `trialItemBind.spec` 守着它们不互相侵占，免得日后三样混成一样。
   */
  bannedItemKind?: "artifact" | "pill";
  /**
   * 本世路线倒着走（第 474 轮）。
   *
   * 这是第四份**不碰 CombatRules** 的契，动的是可动空间里那第四项「解锁顺序」。
   *
   * ## 为什么倒着走是纯逆境
   *
   * ```text
   *   顺着走  2 → 4 → 7 → 11 → 15 → 17   层级递增，逐步变强
   *   倒着走 17 → 15 → 11 → 7 → 4 → 2    开局就撞终段
   * ```
   *
   * 收尾那几段确实白给，但它们不影响「能不能通关」，只影响「何时」——
   * 而开局那一段几乎必败，玩家必须先把装备与等级堆上去才能迈出第一步。
   * 同样的路，倒着走要难得多。
   *
   * 四种玩法面（rules / routeStages / bannedItemKind / reverseRoute）互斥地存在 ——
   * 判据 `trialUnlockBind.spec` 守着它们不互相侵占。
   */
  reverseRoute?: boolean;
  /**
   * 本世目标的说法（第 475 轮）。
   *
   * 这是第五份**不碰 CombatRules** 的契，动的是可动空间里那第五项「本世目标」。
   *
   * ## 与命题的区别
   *
   * `LifeThemeDef`（本世命题）也是「这一世要做什么」，但两者不可混:
   *
   * ```text
   *   命题  每世择一，达成给宿慧（跨世成长），破了只是所得落空
   *   契约  花道果签，达成只记进履历（不进任何计算），不签就没有
   * ```
   *
   * 而 `lifeTrialService.spec` 有四条出口判据守着「契约不发放宿慧、不发放资源、
   * 不产生道果」—— 那些是为了堵「道果 → 契约 → 宿慧 → … → 战力」的闭环。
   * 故 `vowGoal` **只改「做什么」，不改「做完得到什么」**。
   *
   * 它改变的是首页那张「下一步」卡:签了这份契之后，玩家抬头看到的就是
   * 自己立下的那句话，而不是系统建议的「去突破」。
   */
  vowGoal?: string;
}

/**
 * 定价说明:金丹圆满转世一次凝 21 枚道果。
 * 故最低一档约合一世所得,最高一档需攒三世 ——
 * 让「签不签」在头几世就是真问题,而不是等余额自然淹没
 */
export const LIFE_TRIALS: LifeTrialDef[] = [
  {
    id: "tr_gu",
    name: "孤行契",
    seal: "孤",
    desc: "此生不假外力,伤处只能自己熬过去。",
    ruleText: "本世一切治疗效力 25%",
    cost: 24,
    rules: { healMult: 0.25 },
  },
  {
    id: "tr_ji",
    name: "疾行契",
    seal: "疾",
    desc: "缠斗非你所长。拖得越久,越不是你的道。",
    ruleText: "本世战斗回合上限 30",
    cost: 30,
    rules: { maxRounds: 30 },
  },
  {
    id: "tr_can",
    name: "残躯契",
    seal: "残",
    desc: "以不足之身入世,每一战都从力竭处起手。",
    ruleText: "本世每场开局气血 70%",
    cost: 36,
    rules: { playerStartHpPct: 0.7 },
  },
  {
    id: "tr_ni",
    name: "逆锋契",
    seal: "逆",
    desc: "你要走的这一程,天地会把最凶的一面留给你。",
    ruleText: "本世敌人攻击 +30%、生命 +20%",
    cost: 48,
    rules: { enemyAtkMult: 1.3, enemyHpMult: 1.2 },
  },
];

/**
 * 第五份契:只改路线长度,不动一条战斗规则。
 *
 * 定价低于同「痛感」的战斗契(36 / 48),因为它的痛是**少拿东西**,而不是打不过 ——
 * 少两段意味着少两组敌群与两个首领的掉落,但不至于卡关。
 */
const ROUTE_TRIAL: LifeTrialDef = {
  id: "tr_duan",
  name: "断径契",
  seal: "断",
  desc: "这一程只有三处地界。天地不肯多给你一寸路。",
  ruleText: "本世路线只有 3 段",
  cost: 30,
  rules: {},
  routeStages: 3,
};

LIFE_TRIALS.push(ROUTE_TRIAL);

/**
 * 第六份契:禁用一类物品,不动战斗规则,也不改路线。
 *
 * 定价与断径契同档 —— 两者的痛都是「少拿东西」:一个少走两段路,一个少一块面板。
 */
const BAN_TRIAL: LifeTrialDef = {
  id: "tr_qiqi",
  name: "弃器契",
  seal: "弃",
  desc: "法宝皆是外物。这一世空手上路,只凭一身修为。",
  ruleText: "本世不得祭用任何法宝",
  cost: 30,
  rules: {},
  bannedItemKind: "artifact",
};

LIFE_TRIALS.push(BAN_TRIAL);

/**
 * 第七份契:倒着走,不动战斗规则、不改段数、不禁物品。
 *
 * 定价最高一档(48)—— 它的痛是「开局就打终局」，比少走两段或禁用一类物品重得多。
 */
const REVERSE_TRIAL: LifeTrialDef = {
  id: "tr_nixing",
  name: "逆行契",
  seal: "溯",
  desc: "这一世自终而始。最难的那一关,就在你脚下。",
  ruleText: "本世路线由末段向首段推进",
  cost: 48,
  rules: {},
  reverseRoute: true,
};

LIFE_TRIALS.push(REVERSE_TRIAL);

/**
 * 第八份契:本世目标换成契约要求的那件事。
 *
 * 定价最低一档(12)—— 它不增加任何难度，只是**换一件事去做**。
 * 契约的痛在这里是「注意力」:这一世你被自己绑在了一件事上。
 */
const VOW_TRIAL: LifeTrialDef = {
  id: "tr_zhinian",
  name: "执念契",
  seal: "执",
  desc: "这一世只做一件事。做完，就行。",
  ruleText: "本世以「在历练中斩敌二百」为唯一目标",
  cost: 12,
  rules: {},
  vowGoal: "在历练中斩敌二百",
};

LIFE_TRIALS.push(VOW_TRIAL);

export function lifeTrialDef(id: string): LifeTrialDef | undefined {
  return LIFE_TRIALS.find((t) => t.id === id);
}

/** 战斗默认回合上限;契约只许把它压低 */
export const DEFAULT_MAX_ROUNDS = 40;

/** 违反「纯逆境」的原因;空数组表示合法 */
export function adverseViolations(rules: CombatRules): string[] {
  const bad: string[] = [];
  const gte = (v: number | undefined, min: number, name: string): void => {
    if (v !== undefined && v < min) bad.push(`${name}=${v} 低于 ${min},这是在减难`);
  };
  const lte = (v: number | undefined, max: number, name: string): void => {
    if (v !== undefined && v > max) bad.push(`${name}=${v} 高于 ${max},这是在减难`);
  };
  // 对玩家不利的方向:己方倍率只能降,敌方倍率只能升
  lte(rules.playerAtkMult, 1, "playerAtkMult");
  gte(rules.enemyAtkMult, 1, "enemyAtkMult");
  gte(rules.enemyHpMult, 1, "enemyHpMult");
  lte(rules.healMult, 1, "healMult");
  lte(rules.shieldCapRatio, 1, "shieldCapRatio");
  lte(rules.playerStartHpPct, 1, "playerStartHpPct");
  lte(rules.maxRounds, DEFAULT_MAX_ROUNDS, "maxRounds");
  // 属性修正:给玩家的只能是负数,给敌人的只能是正数
  const scan = (mods: StatMods | undefined, sign: 1 | -1, name: string): void => {
    for (const [k, v] of Object.entries(mods ?? {})) {
      if (typeof v === "number" && v * sign > 0) bad.push(`${name}.${k}=${v} 方向错误`);
    }
  };
  scan(rules.playerExtraMods, 1, "playerExtraMods");
  scan(rules.enemyExtraMods, -1, "enemyExtraMods");
  // perRounds 是长生印那类增益结构,契约不许携带
  if (rules.perRounds) bad.push("perRounds 是增益结构,契约不得携带");
  return bad;
}

/** 该规则是否纯逆境 */
export function isPurelyAdverse(rules: CombatRules): boolean {
  return adverseViolations(rules).length === 0;
}
