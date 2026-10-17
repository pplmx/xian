/**
 * Buff 定义 —— 丹药增益 / 事件祝福 / 负面状态
 *
 * ## desc 只写风味,不写数值
 *
 * 每个 buff 的 desc 与它的 mods 此前是两本账:desc 手抄「攻击提升 20%,防御提升 10%」,
 * 真值在 mods 里。两本账各自都"对",改 mods 的那一夜界面就开始撒谎 —— 而且描述用的
 * 名字还各自一套(desc 里叫「战斗伤害」「受伤降低」「灵气回复」「生命上限」,
 * STAT_NAMES 里叫「伤害增幅」「伤害减免」「灵气恢复」「气血上限」)——
 * 同一条词条在状态弹窗与装备词条上读起来像两样东西。
 *
 * 现在数值与名字只有一处真相:mods 的键 + ui/statNames.STAT_NAMES。
 * 界面上的数值行由 modsText / BuffDialog 的效果行现算;desc 只留这一句「它是什么感觉」。
 * 判据见 core/dataTextAudit「说明只说风味」一节 —— desc 里出现数字、百分号、
 * 中文数词或旧词条别名,当场红。
 */
import type { BuffDef, StatMods } from "@/types";
import { INJURY_DURATION } from "./constants";

function b(
  id: string,
  name: string,
  kind: BuffDef["kind"],
  durationSec: number,
  desc: string,
  mods: StatMods,
  icon = "sparkles",
): BuffDef {
  return { id, name, kind, durationSec, desc, mods, icon };
}

export const BUFFS: BuffDef[] = [
  b(
    "buff_juling",
    "聚灵",
    "pill",
    1800,
    "灵气汇聚,周天自转,一呼一吸皆有所得",
    { cultivationSpeed: 0.5 },
    "wind",
  ),
  b(
    "buff_ningshen",
    "凝神",
    "pill",
    600,
    "心神凝定,关隘前不慌 —— 只在小进阶上生效,大关天劫不吃此益",
    { breakthroughRate: 0.08 },
    "moon",
  ),
  b(
    "buff_zhanli",
    "战意沸腾",
    "pill",
    900,
    "战意沸腾,攻守皆锐",
    { attackPct: 0.2, defensePct: 0.1 },
    "sword",
  ),
  b("buff_huxin", "护心", "pill", 900, "护住心脉,外伤难侵", { damageReduction: 0.15 }, "shield"),
  b(
    "buff_shenxing",
    "神行",
    "pill",
    900,
    "脚下生风,行路如飞",
    { explorationSpeed: 0.3, speed: 0.1 },
    "footprints",
  ),
  b("buff_wudao", "茶香悟道", "pill", 1800, "茶烟未散,所悟自多", { expGain: 0.3 }, "leaf"),
  b(
    "buff_jingang",
    "金刚护体",
    "pill",
    900,
    "护体如金刚,开阵便有盾在",
    { maxHpPct: 0.2, shieldOnStart: 0.1 },
    "mountain",
  ),
  b(
    "buff_tianyun",
    "天运加身",
    "pill",
    1200,
    "天运眷顾,所遇皆丰",
    { luck: 0.15, dropRate: 0.1 },
    "star",
  ),
  b(
    "buff_xuanming",
    "玄冥护体",
    "pill",
    600,
    "玄冥加护,雷火难伤",
    { tribulationResist: 0.2 },
    "cloud",
  ),
  b(
    "buff_pojing",
    "破境",
    "pill",
    300,
    "破境之意盈胸 —— 只在小进阶上生效,大关天劫不吃此益",
    { breakthroughRate: 0.15 },
    "zap",
  ),
  b(
    "injury",
    "重伤",
    "injury",
    INJURY_DURATION,
    "气血亏损,周天迟滞,战力大减",
    { cultivationSpeed: -0.5, attackPct: -0.2, defensePct: -0.2 },
    "skull",
  ),
  b(
    "bless_qingfeng",
    "清风拂面",
    "blessing",
    900,
    "清风拂面,心旷神怡",
    { cultivationSpeed: 0.2 },
    "wind",
  ),
  // 名字里不带「机缘」:「机缘」已专属 ft_ 取/弃事件,这条祝福给的是气运与际遇概率
  b(
    "bless_jiyuan",
    "气运加身",
    "blessing",
    1200,
    "气运加身,机缘自来",
    { luck: 0.2, eventLuck: 0.15 },
    "star",
  ),
  b(
    "bless_daoyun",
    "道韵加身",
    "blessing",
    1800,
    "道韵加身,行止皆合于道",
    { cultivationSpeed: 0.4, expGain: 0.2 },
    "scroll",
  ),
  b(
    "curse_xinmo",
    "心魔缠身",
    "injury",
    600,
    "心魔滋生,周天紊乱,关隘前尤易失手",
    { cultivationSpeed: -0.3, breakthroughRate: -0.1 },
    "ghost",
  ),
  b(
    "buff_pofu",
    "破釜沉舟",
    "pill",
    900,
    "断却生路,方见杀机 —— 血将尽时,出手最重,也最耐打",
    { lowHpDamage: 0.3, lowHpReduction: 0.15 },
    "flame",
  ),
  b(
    "buff_gangdun",
    "罡气盾",
    "pill",
    900,
    "罡气成盾;盾在,锋芒更盛",
    { shieldOnStart: 0.15, shieldPower: 0.12 },
    "shield",
  ),
  // ---- Phase 28 前期玩法:悟道顿悟(数值就是这里的 mods —— earlyGame.ts 的文案
  // 只剩风味,界面数值行由 ui/earlyGameText 现算,改这里界面就跟着变) ----
  b(
    "enlighten_cult",
    "静心凝神",
    "blessing",
    600,
    "心神沉静,周天运转更顺",
    { cultivationSpeed: 0.2 },
    "moon",
  ),
  b(
    "enlighten_cult_strong",
    "道心通明",
    "blessing",
    300,
    "道心澄澈,一念无滞",
    { cultivationSpeed: 0.35 },
    "sun",
  ),
  b(
    "enlighten_dmg",
    "锤炼筋骨",
    "blessing",
    600,
    "筋骨如钢,出手更重",
    { damageBonus: 0.15 },
    "sword",
  ),
  /*
   * 凝气护体 —— 与「锤炼筋骨」并排的那一条,给的是伤害减免而不是防御加成。
   *
   * 原先写 `defensePct: 0.12`(防御加成 +12%)。名字上是一回事,结算上是另一回事:
   * 防御走 `攻 × 攻 /(攻 + 防)` 那条除法曲线,同一个 +12% 打在不同对手身上收益不同 ——
   * 玩家防御等于敌人攻击的一半时只减伤 3.8%,等于攻击时才 5.7%。而并排的
   * 锤炼筋骨是 `damageBonus: 0.15`,纯乘数,输出就是 ×1.15。
   * 于是「二选一」实际只有一个值得点:面板写了两件事,数字上只有一件。
   *
   * 换成伤害减免(纯乘数)之后两边才同量级:承伤 ×0.88 → 生存 ×1.136,
   * 对输出 ×1.15。护体本来就该是「护住周身」而不是「筋骨更硬」,词条与名目也对上了。
   * 判据见 src/core/enlightenBalance.spec.ts —— 拿真引擎打一场,量两个倍数。
   */
  b(
    "enlighten_def",
    "凝气护体",
    "blessing",
    600,
    "灵气护体,皮膜自坚",
    { damageReduction: 0.12 },
    "shield",
  ),
  b(
    "enlighten_bt",
    "悟透瓶颈",
    "blessing",
    1800,
    "瓶颈松动,关隘易过",
    { breakthroughRate: 0.08 },
    "zap",
  ),
  b("enlighten_qi", "吐纳有序", "blessing", 600, "气息绵长,吐纳有序", { qiRegen: 0.25 }, "wind"),
  // ---- Phase 28 洞府巡游奖励 buff(修复前是纯空转:addBuff 查无此定义静默返回) ----
  b(
    "cave_furnace_cult",
    "药气入体",
    "blessing",
    600,
    "丹炉药气入体,周身温润",
    { cultivationSpeed: 0.2 },
    "flame",
  ),
  b(
    "cave_array_qicap",
    "阵枢焕新",
    "blessing",
    600,
    "修复后的阵法运转如意,炉鼎可纳更多",
    { qiCapPct: 0.25 },
    "wind",
  ),
  b(
    "cave_garden_pet",
    "灵兽相随",
    "blessing",
    600,
    "安抚之后,灵兽更愿随你出力",
    { beastPct: 0.3 },
    "paw",
  ),
  // 惩罚 buff:id 与 penalty.type 对齐(见 earlyGameService.chooseCaveOption)
  b(
    "cave_penalty_cultivationSpeed",
    "修炼倦怠",
    "injury",
    300,
    "强行吸纳伤了根基,周天不再顺畅",
    { cultivationSpeed: -0.15 },
    "skull",
  ),
  // ---- Phase 28 闭关:5 分钟 +150% 修炼、期间禁止历练。
  // durationSec=300 必须与 earlyGameService.startRetreat 的 5 分钟口径一致(同一真相源=buff 本身) ----
  b(
    "retreat",
    "闭关",
    "blessing",
    300,
    "闭关静修,心无旁骛 —— 期间无法外出历练",
    { cultivationSpeed: 1.5 },
    "mountain",
  ),
  // ---- 仙界及以上丹药增益(每 buff 仅一味丹产出,见 pillValue 法则 C) ----
  b(
    "buff_xianli",
    "仙力加身",
    "pill",
    1200,
    "仙力贯体,出手如崩山",
    { attackPct: 0.35, critDamage: 0.3 },
    "sword",
  ),
  b(
    "buff_shenwei",
    "神威临世",
    "pill",
    1200,
    "神威临世,诸邪辟易,身亦不损",
    { damageBonus: 0.25, damageReduction: 0.12 },
    "crown",
  ),
  b(
    "buff_hundun",
    "本源归一",
    "pill",
    1800,
    "混沌本源入体,法理自明",
    {
      cultivationSpeed: 0.8,
      breakthroughRate: 0.1,
    },
    "sparkles",
  ),
  // ---- 炼丹自增益三味(概念契约):不是"炼丹专属工具",而是 静心/安神/定心 一族的通用状态丹 ——
  // 服下后心性好转,炼丹面(双成/心得/护料)只是它众多用处里的一格,另配一个通用面(回灵/会心/破境)。
  // id 沿用旧拼音(huohou→安神、cuidan→澄心 是改名前的占位),名称与机制才是真身。
  b(
    "buff_huohou",
    "安神",
    "pill",
    900,
    "神魂安泰,气息绵长;凝神观炉,开炉多成",
    { qiRegen: 0.25, alchemyYield: 0.2 },
    "flame",
  ),
  b(
    "buff_chengxin",
    "澄心",
    "pill",
    900,
    "心念澄澈,出手如神;炼丹时心有所得",
    { critRate: 0.08, craftExpGain: 0.3 },
    "sparkles",
  ),
  b(
    "buff_dingxin",
    "定心",
    "pill",
    900,
    "心定则神闲;纵是炸炉,手法也不乱",
    { breakthroughRate: 0.08, craftSalvage: 0.5 },
    "shield",
  ),
  // ---- 修速族中段(法则 I2):星驰/御风丹的增益 —— 时长 1800 与聚灵/本源同一炷香口径 ----
  // 目标:单位材料性价比不低于开局聚灵(它 14 草换 15 分)。星驰/御风靠高强度和低草耗,
  // 让玩家在 4/6 境有"换一味更强的前期丹"的理由,而不是补两味没人炼的填充物。
  b(
    "buff_xingchi",
    "星驰电掣",
    "pill",
    1800,
    "照夜星驰,一息千里",
    { cultivationSpeed: 0.6 },
    "wind",
  ),
  b(
    "buff_yufeng",
    "御风而行",
    "pill",
    1800,
    "长风入体,御虚而行",
    { cultivationSpeed: 0.75 },
    "cloud",
  ),
  // ---- 神君补位(多维审视 P1):神将丹唯一增益,攻伐向,不与神威/仙力撞涌(法则 C) ----
  // 压线设计:神品(15)须稳压仙品(10)的 仙力加身(攻 35%+暴伤 30%)——不再出现「拿神丹换仙丹」的下位替代
  b(
    "buff_shenjiang",
    "神将之威",
    "pill",
    1200,
    "神将临阵,攻伐无双,身亦不损",
    { attackPct: 0.45, critDamage: 0.3, damageReduction: 0.1 },
    "sword",
  ),
  // ---- 气运爆点(P2 首落):不是天运的弱化版,是高量级短窗「赌一把」—— 天运 15% 它 50% ----
  b(
    "buff_yunji",
    "鸿运当头",
    "pill",
    600,
    "气运喷薄,鸿运齐天 —— 押上所有运气赌一场",
    {
      luck: 0.5,
      eventLuck: 0.4,
    },
    "star",
  ),
];

const BY_ID = new Map(BUFFS.map((x) => [x.id, x]));

export function buffDef(id: string): BuffDef | undefined {
  return BY_ID.get(id);
}
