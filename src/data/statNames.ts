/** 属性中文名映射(展示层共用) */
import { formatSignedPercent } from "@/utils/format";
import type { AffixRarity, AnyStatKey, StatMods } from "@/types";

/**
 * 词条稀有度的名目与颜色(展示层)。
 *
 * 稀有度此前只在数据里参与加权抽取,界面上从没露过面;现在装备卡片按它排序上色,
 * 玩家才看得出「这一条是撞上的大运」还是「这条是搭头」。名目沿用本作的四档叫法。
 */
export const AFFIX_RARITY_META: Record<AffixRarity, { name: string; color: string }> = {
  common: { name: "常见", color: "var(--color-ink-faint)" },
  rare: { name: "稀有", color: "var(--color-qing)" },
  epic: { name: "珍稀", color: "var(--color-violet-ink)" },
  legendary: { name: "传世", color: "var(--color-gold-ink)" },
};

export const STAT_NAMES: Record<AnyStatKey, string> = {
  attackPct: "攻击",
  defensePct: "防御",
  maxHpPct: "气血上限",
  critRate: "暴击率",
  critDamage: "暴击伤害",
  /**
   * 先手判定(speed)——这个名字必须与机制同形。
   *
   * 它是一条**阈值**:1 + 本项修正 ≥ 对手速度即抢先(见 core/combat.ts)。
   * 从前叫「出手速度」,读起来像连续收益,于是「+6% 为什么还是后手」成了必然的困惑。
   */
  speed: "先手判定",
  damageBonus: "伤害增幅",
  damageReduction: "伤害减免",
  cultivationSpeed: "修炼速度",
  qiRegen: "灵气恢复",
  /**
   * 「进阶成功率」——**不是**大关成功率。
   *
   * 它只进 `breakthroughInfo` 的那一次掷点:每大境 9 次小进阶(一世约 180 次)。
   * 大关(筑基起,含三个跨界入口)一律走天劫的逐波推演,压根不掷这个骰子
   * (见 core/breakthrough 的 attemptBreakthrough 与 tribulationDecision)。
   * 所以这条作用域是**恰好等于**小进阶的 —— 没有例外,不必带星号。
   *
   * 从前这里叫「突破成功率」,读起来像"万事皆管":玩家把「天命」「破境」堆满再
   * 去渡大关,发现一点用没有 —— 那是名字在过度承诺,不是数值失效。
   */
  breakthroughRate: "进阶成功率",
  luck: "气运",
  explorationSpeed: "历练速度",
  lifespanPct: "寿元上限",
  spiritStoneGain: "灵石获取",
  dropRate: "掉落率",
  expGain: "战斗修为",
  alchemyYield: "炼丹双成率",
  craftExpGain: "炼丹心得",
  craftSalvage: "定心护料",
  /**
   * 「炼器省耗」—— 不是「炼器消耗」。
   *
   * forgeDiscount 的值是**省**:正值 = 耗材变少,数值上是折扣。名字若叫
   * 「炼器消耗」,显示层照抄 `+X%` 就变成「花销变多」,veinText 当年只能
   * 为它单开一个 -X% 特例。名字带「省」字,正号读起来才是「省耗 +X%」,
   * 显示层默认(modsText / formatSignedPercent)从此对,不必特例。
   */
  forgeDiscount: "炼器省耗",
  qiCapPct: "灵气上限",
  beastPct: "灵兽属性效果",
  armorPen: "破甲",
  // 与 speed 分开命名:那个管「谁先出手」,这个管「首回合打得更重」(先发/雷霆词条)
  firstStrike: "首回合伤害",
  counterRate: "反击概率",
  lifesteal: "吸血",
  shieldOnStart: "开战护盾",
  executeDamage: "处决伤害",
  regenPerRound: "回合回复",
  dodgeRate: "闪避",
  accuracy: "命中",
  lowHpReduction: "濒危减伤",
  breakRefund: "突破返还",
  doubleDropRate: "双倍战利",
  eventLuck: "际遇概率",
  tribulationResist: "御劫",
  comboRate: "连击",
  stunRate: "震慑",
  lowHpDamage: "背水增伤",
  fullHpDamage: "锋芒增伤",
  shieldPower: "罡盾增伤",
  comboDamage: "追击威力",
  counterDamage: "反击威力",
  overhealShield: "溢疗成盾",
};

/**
 * 把一组词条摊成一行人话。
 *
 * 功法分支的词条既在择道界面出现,也在悟道录里出现 ——
 * 两处若各写一份格式化,措辞迟早分叉。
 *
 * 零值词条不显示:器魂这类现算模组(词条 × 品级系数)低品时会带 0 值键,
 * 印出去就是「攻击 +0%」的噪音。过滤收在这一处,各调用方共用同一口径
 * (曾有人为它另抄一份,见 uiLayering「界面不重造 modsText」审计)。
 */
export function modsText(mods: StatMods): string {
  return modsPills(mods)
    .map((p) => `${p.name} ${p.value}`)
    .join(" · ");
}

/**
 * 同一份词条的**结构化**版本 —— 给需要「一项一枚、并排对齐」的地方用。
 *
 * 为什么要它:师承那四张拜师卡是跨世保留的永久抉择,玩家要在按下之前把四张并着读。
 * 而四个师门的词条项数不一样、字面长短也不一样,摊成一句「攻击 +15% · 气血 +10%」
 * 之后,四句在卡里各占一行的不同位置 —— 想比「谁加攻击多」得来回扫两遍。
 *
 * 命名与过滤仍走上面那一条口径(本函数是唯一出口,modsText 也读它),
 * 不存在「界面自己又格式化一遍」的分叉:view 只负责排版,不负责措辞。
 */
export function modsPills(mods: StatMods): { name: string; value: string; pct: number }[] {
  return Object.entries(mods)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => ({
      name: STAT_NAMES[k as AnyStatKey] ?? k,
      value: formatSignedPercent(v as number),
      pct: v as number,
    }));
}

/**
 * 词条释义 —— 只收**名字读不出作用**的那一批。
 *
 * ## 为什么不是全表 45 条都给一句
 *
 * 多数名字是自明的:「攻击 +12%」「防御 +5%」「修炼速度 +8%」—— 读到就知道它管什么。
 * 给它们各写一句「提高攻击」是同义反复，只会把界面撑满、把真正需要解释的那几条埋掉。
 *
 * 故这里只收**读到名字仍然不知道它值多少**的那些:
 *
 * ```text
 *   气运          可能是掉落 / 事件 / 突破 —— 三样都沾，且都不大
 *   御劫          听起来像"对抗天劫"，而它具体乘在雷伤上
 *   双倍战利      在哪儿双倍
 *   溢疗成盾      "溢出"指的是什么
 *   定心护料      "定心"不指向炼丹保料
 * ```
 *
 * 它们出现在**不可逆的选择**里（天赋一生一次、灵脉投点不回收）时，
 * 玩家读到名字却不知道值多少，就只能靠猜。
 *
 * ## 释义的口径
 *
 * 一句、说机制、不重复名字、不超过 30 字（词条旁边放得下）。
 * **每一条都必须与代码对得上** —— 写错的释义比不写更糟，它会被当成说明来读。
 * 由 `statHints.spec` 用真实消费点对账。
 */
export const STAT_HINTS: Partial<Record<AnyStatKey, string>> = {
  /** `core/breakthrough`:`modOf(mods,"luck") × BT_LUCK_TO_RATE` → 小进阶成功率 */
  luck: "兼济掉落品质、际遇与进阶成功率（各占一点，都不大）",
  /** `core/tribulationDecision`:`settlementResist` 里乘在每道雷的伤害上 */
  tribulationResist: "渡劫时按每道雷的伤害折算，降低雷伤",
  /** `core/loot`:`rng.chance(doubleDropRate)` 命中则该次掉落翻倍 */
  doubleDropRate: "历练结算时按此概率让这一趟掉落翻倍",
  /** `core/buildSearch` 的战斗推演里，「治疗溢出」那部分转成护盾 */
  overhealShield: "治疗超过上限的部分不浪费，转为护盾",
  /** `core/engineCraft`:炼丹失败时保住材料的比例再乘 (1+craftSalvage) */
  craftSalvage: "炼丹失败时保住材料的比例更高",
  /** `core/exploration`:`EXPLORE_EVENT_CHANCE × (1+eventLuck)` */
  eventLuck: "历练途中撞见际遇的概率更高",
  /** `core/breakthrough`:`breakRefundOf` → 失败时少折修为（封顶 80%） */
  breakRefund: "突破失败时折损的修为更少（最多抵八成）",
  /** `data/pets` + 灵兽园：灵兽自身词条的放大倍率 */
  beastPct: "所携灵兽的词条按此倍率放大",
};

/**
 * 某条词条的释义；没有就返回 null。
 *
 * 调用方据此决定那一段要不要出 —— 不返回空串，因为「没有释义」与
 * 「释义是空的」是两件事（后者是数据写坏了）。
 */
export function statHintOf(key: string): string | null {
  return STAT_HINTS[key as AnyStatKey] ?? null;
}
