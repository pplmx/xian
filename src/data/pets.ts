/** 灵兽 —— 事件与灵兽园获得,佩戴一只;全表 44 只,按品阶自低而高排列
 * Phase 31.0 S4:增加性格(personality)—— 历练时的行为倾向,
 * 让玩家选伙伴而非只看数值
 *
 * 品阶阶梯已补齐为九档中的七档:精品 → 灵品 → 玄品 → 地品 → 天品 → 仙品 → 神品。
 *
 * 性格六种(贪宝 / 慢稳 / 好战 / 谨慎 / 疾行 / 守拙)。四种加六种那次只加性格、
 * 不加维度,并补了开局三档的分配 —— 否则新走法只在境界三十以上才见得到。
 * 地品(earth)是后补的一档,从此九级品质里灵兽不再跳过第 5 级 ——
 * 「玄品之上、天品之下」也有物可挑,而不是玄品直接跳到天品。
 *
 * 图标与敌人同一套规矩:这里写**族类**(`family`),形由 data/beastFamilies.ts 给出。
 * 原先直接写 icon,于是应龙与螭龙幼子是一枚星芒、麒麟是一枚兽爪、雪背小龟是一面盾 ——
 * 灵兽位只有一个,玩家要看的就是「这是只什么」,形对不上名物最刺眼。 */
import type { PetDef } from "@/types";

/**
 * 品阶纪律:品质更高,总词条预算(各词条绝对值之和)与同一词条键的数值,都不许
 * 比低品阶回落 —— 由 core/petQuality.spec 钉死(同法宝品阶阶梯的规矩)。加新灵兽
 * 或调数值都会被那道测试卡住,别绕过它:高品却出低数,正是玩家一眼看穿的失配。
 */
export const PETS: PetDef[] = [
  // ---- 精品 ----
  {
    id: "pet_qingyu",
    name: "青羽灵狐",
    desc: "尾生青羽,善寻机缘",
    icon: "fox",
    family: "fox",
    quality: "excellent",
    mods: { explorationSpeed: 0.1, eventLuck: 0.05 },
    personality: "greedy",
  },
  {
    id: "pet_xuegui",
    name: "雪背小龟",
    desc: "背驮微型山岳,稳如泰山",
    icon: "turtle",
    family: "turtle",
    quality: "excellent",
    mods: { defensePct: 0.08, maxHpPct: 0.05 },
    personality: "steady",
  },
  {
    id: "pet_huoque",
    name: "赤火雀",
    desc: "羽翼含火,性子急躁",
    icon: "bird",
    family: "bird",
    quality: "excellent",
    mods: { attackPct: 0.08, speed: 0.05 },
    personality: "fierce",
  },
  /*
   * 后补的两种性格(疾行 / 守拙)原本只落在地品以上 —— 开局三档(精品/灵品/玄品)
   * 的十一只全是原来那四种走法,补性格的意义就落空了。这三只补在开局段,
   * 预算各按同档已有的量级(见 core/petQuality.spec 的品阶不回落)。
   */
  {
    id: "pet_tashou",
    name: "踏霜鹿",
    desc: "蹄下不沾雪,一程走得比谁都快",
    icon: "deer",
    family: "deer",
    quality: "excellent",
    mods: { explorationSpeed: 0.09, speed: 0.05 },
    personality: "rapid",
  },
  {
    id: "pet_bimao",
    name: "碧眼灵猫",
    desc: "碧瞳如夜,专寻埋藏的机缘",
    icon: "paw",
    family: "beast",
    quality: "excellent",
    mods: { dropRate: 0.06, explorationSpeed: 0.08 },
    personality: "greedy",
  },
  {
    id: "pet_wudiao",
    name: "雾影灵貂",
    desc: "雾里来去,药香随身",
    icon: "paw",
    family: "beast",
    quality: "excellent",
    mods: { qiRegen: 0.08, luck: 0.04 },
    personality: "steady",
  },
  // ---- 灵品 ----
  {
    id: "pet_xuanshui",
    name: "玄水蛟",
    desc: "潜龙于渊,血脉延年 —— 附灵则气息绵长",
    icon: "dragon",
    family: "dragon",
    quality: "spirit",
    mods: { qiRegen: 0.12, lifespanPct: 0.06 },
    personality: "steady",
  },
  {
    id: "pet_yueying",
    name: "月影狸",
    desc: "昼伏夜出,来去无声",
    icon: "moon",
    family: "moon",
    quality: "spirit",
    mods: { dodgeRate: 0.05, dropRate: 0.12 },
    personality: "cautious",
  },
  {
    id: "pet_jinchan",
    name: "三足金蟾",
    desc: "口衔铜钱,天生聚财",
    icon: "gem",
    family: "treasure",
    quality: "spirit",
    mods: { spiritStoneGain: 0.15, luck: 0.05 },
    personality: "greedy",
  },
  {
    id: "pet_shouyan",
    name: "守岩貘",
    desc: "卧在洞口不动,来去的路它都记得",
    icon: "bear",
    family: "bear",
    quality: "spirit",
    mods: { explorationSpeed: 0.12, damageReduction: 0.06 },
    personality: "wary",
  },
  // ---- 玄品 ----
  {
    id: "pet_yaoguang",
    name: "摇光鹿",
    desc: "角悬星光,踏梦而行",
    icon: "deer",
    family: "deer",
    quality: "profound",
    mods: { cultivationSpeed: 0.08, qiRegen: 0.12 },
    personality: "steady",
  },
  {
    id: "pet_leihou",
    name: "御雷猴",
    desc: "生于雷泽,不惧天威",
    icon: "ape",
    family: "ape",
    quality: "profound",
    mods: { tribulationResist: 0.1, attackPct: 0.1 },
    personality: "fierce",
  },
  /*
   * 玄品档此前只有三种性格(steady / fierce / cautious),缺 rapid 与 wary。
   *
   * 数值不是随手取的 —— 灵兽有两条硬约束同时生效(`core/petQuality`):
   *   ① 同一词条键,高品阶不许低于**任意**低品阶;
   *   ② 总预算随品阶不回落。
   * 所以玄品每键的可写区间被夹在 [低四阶最高, 高三阶最低] 之间,拿到的区间是:
   *
   *   spiritStoneGain [0.15, 0.18] · eventLuck [0.05, 0.11] · attackPct [0.08, 0.10]
   *   lifespanPct [0.06, 0.08]     · luck [0.05, 0.07]       · speed [0.05, 0.07]
   *
   * 下面两只就取在这些区间里,一次到位。
   */
  {
    id: "pet_jifeng",
    name: "疾风貂",
    desc: "来去只有一阵风,风过了才听见动静",
    icon: "fox",
    family: "fox",
    quality: "profound",
    mods: { speed: 0.07, luck: 0.07, attackPct: 0.08 },
    personality: "rapid",
  },
  {
    id: "pet_shoumo",
    name: "守岩貘",
    desc: "趴着不动的时候,看上去就是一块石头 —— 记路却比谁都清楚",
    icon: "qilin",
    family: "qilin",
    quality: "profound",
    mods: { spiritStoneGain: 0.15, eventLuck: 0.05 },
    personality: "wary",
  },
  {
    id: "pet_qinghe",
    name: "雾隐青鹤",
    desc: "栖于晨雾之间,来去自在,气运随身",
    icon: "bird",
    family: "bird",
    quality: "profound",
    mods: { dodgeRate: 0.05, luck: 0.05, qiRegen: 0.12 },
    personality: "cautious",
  },
  // ---- 地品 ----
  {
    id: "pet_zhenyanshou",
    name: "镇岩兽",
    desc: "头覆岩甲,一坐便是半座山",
    icon: "bear",
    family: "bear",
    quality: "earth",
    mods: { defensePct: 0.09, maxHpPct: 0.06, damageReduction: 0.07 },
    personality: "wary",
  },
  {
    id: "pet_zhuifeng",
    name: "追风隼",
    desc: "展翼三丈,追云而不肯落地",
    icon: "bird",
    family: "bird",
    quality: "earth",
    mods: { speed: 0.07, dodgeRate: 0.07, attackPct: 0.1 },
    personality: "rapid",
  },
  {
    id: "pet_shijingchan",
    name: "石睛蟾",
    desc: "石睛一睁,山腹里的铜气自现",
    icon: "gem",
    family: "treasure",
    quality: "earth",
    mods: { spiritStoneGain: 0.18, luck: 0.07 },
    personality: "greedy",
  },
  {
    id: "pet_kutengyao",
    name: "枯藤妖",
    desc: "藤缠青石而生,缠的还有灵气",
    icon: "leaf",
    family: "plant",
    quality: "earth",
    mods: { cultivationSpeed: 0.08, qiRegen: 0.12, expGain: 0.05 },
    personality: "cautious",
  },
  // ---- 天品 ----
  {
    id: "pet_longzi",
    name: "螭龙幼子",
    desc: "龙生九子,此其一也",
    icon: "dragon",
    family: "dragon",
    quality: "heaven",
    mods: { attackPct: 0.1, maxHpPct: 0.1, cultivationSpeed: 0.1 },
    personality: "fierce",
  },
  {
    id: "pet_yanlin",
    name: "炎鳞螭",
    desc: "鳞下流火,过处草木皆成灰",
    icon: "serpent",
    family: "serpent",
    quality: "heaven",
    mods: { attackPct: 0.13, critRate: 0.07, maxHpPct: 0.1 },
    personality: "fierce",
  },
  {
    id: "pet_chenmugui",
    name: "沉木龟",
    desc: "沉在归墟水底,背甲已生珊瑚",
    icon: "turtle",
    family: "turtle",
    quality: "heaven",
    mods: { maxHpPct: 0.14, defensePct: 0.11, regenPerRound: 0.03 },
    personality: "steady",
  },
  {
    id: "pet_zhaoyelu",
    name: "照夜鹿",
    desc: "角上一盏小灯,照的是未走的路",
    icon: "deer",
    family: "deer",
    quality: "heaven",
    mods: { explorationSpeed: 0.15, eventLuck: 0.11 },
    personality: "cautious",
  },
  {
    id: "pet_taotaiyong",
    name: "陶胎俑",
    desc: "陶土捏成的替身,替你受一记劫",
    icon: "puppet",
    family: "puppet",
    quality: "heaven",
    mods: { breakthroughRate: 0.05, cultivationSpeed: 0.1, qiCapPct: 0.11 },
    personality: "wary",
  },
  {
    id: "pet_taiyin",
    name: "太阴玉兔",
    desc: "月魄清辉所化的玉兔,栖于桂影之间,通晓长夜",
    icon: "moon",
    family: "moon",
    quality: "heaven",
    mods: { expGain: 0.12, cultivationSpeed: 0.08, maxHpPct: 0.06 },
    personality: "steady",
  },
  // ---- 仙品 ----
  {
    id: "pet_yinglong",
    name: "应龙",
    desc: "四爪生翼,云雨相随,仙门之上的护道神兽",
    icon: "dragon",
    family: "dragon",
    quality: "immortal",
    mods: { attackPct: 0.15, maxHpPct: 0.15, cultivationSpeed: 0.1 },
    personality: "fierce",
  },
  {
    id: "pet_qilin",
    name: "麒麟",
    desc: "仁兽现世,祥瑞所至,福泽自生",
    icon: "qilin",
    family: "qilin",
    quality: "immortal",
    mods: { luck: 0.15, dropRate: 0.12, defensePct: 0.12 },
    personality: "steady",
  },
  {
    id: "pet_zijinpi",
    name: "紫金貔",
    desc: "只进不出,腹中自有金库",
    icon: "gem",
    family: "treasure",
    quality: "immortal",
    mods: { spiritStoneGain: 0.19, luck: 0.08, dropRate: 0.12 },
    personality: "greedy",
  },
  {
    id: "pet_moyanya",
    name: "墨羽鸦",
    desc: "墨羽落处,判的是生死一笔",
    icon: "bird",
    family: "bird",
    quality: "immortal",
    mods: { attackPct: 0.16, critRate: 0.08, critDamage: 0.15 },
    personality: "rapid",
  },
  {
    id: "pet_mingshuijiao",
    name: "冥水蛟",
    desc: "衔一盏冥灯,渡人渡己渡长夜",
    icon: "serpent",
    family: "serpent",
    quality: "immortal",
    mods: { cultivationSpeed: 0.15, lifespanPct: 0.08, qiRegen: 0.13 },
    personality: "steady",
  },
  {
    id: "pet_yuepoju",
    name: "月魄蛛",
    desc: "在月光里结网,网住的是旧梦",
    icon: "moon",
    family: "moon",
    quality: "immortal",
    mods: { dodgeRate: 0.07, eventLuck: 0.11, explorationSpeed: 0.17 },
    personality: "cautious",
  },
  {
    id: "pet_guyuexi",
    name: "古岳犀",
    desc: "背驮半截古碑,一步一声钟",
    icon: "paw",
    family: "beast",
    quality: "immortal",
    mods: { maxHpPct: 0.18, defensePct: 0.13, damageReduction: 0.08 },
    personality: "steady",
  },
  // ---- 补足:每个界域至少两只(灵兽位只有一个,一界只有一只 = 没有选择) ----
  {
    id: "pet_qingluan",
    name: "青鸾",
    desc: "羽色如洗,鸣声清越,云海之上的传信神禽",
    icon: "bird",
    family: "bird",
    quality: "immortal",
    mods: { cultivationSpeed: 0.12, qiRegen: 0.12, explorationSpeed: 0.15 },
    personality: "cautious",
  },
  // ---- 神品 ----
  {
    id: "pet_kunpeng",
    name: "鲲鹏",
    desc: "北冥有鱼,化而为鹏,扶摇直上九万里",
    icon: "bird",
    family: "bird",
    quality: "divine",
    /*
     * 原先 历练 25 · 闪避 8 · 际遇 12,被同为神品的海蜃鲸(36/9/22)在**每个词条上**
     * 压过,连性格都一样(cautious)—— 灵兽位只有一个,它没有存在理由。
     *
     * 改法不是把海蜃鲸压下去,而是让鲲鹏在自己的方向上更强:
     * 历练速度 25 → 42(超过海蜃鲸的 36,「扶摇直上九万里」本就该是赶路最快的那只),
     * 闪避 8 → 9(与海蜃鲸持平,也守住跨品阶不回落的地品 7%),
     * 际遇 12 → 14 保持低于海蜃鲸的 22 —— 两只各有所长。
     */
    mods: { explorationSpeed: 0.42, eventLuck: 0.14, dodgeRate: 0.09 },
    personality: "cautious",
  },
  {
    id: "pet_taotie",
    name: "混沌饕餮",
    desc: "混沌中孕育的凶兽,吞天噬地,不知餍足",
    icon: "paw",
    family: "beast",
    quality: "divine",
    mods: { cultivationSpeed: 0.24, breakthroughRate: 0.08, lifesteal: 0.1 },
    personality: "fierce",
  },
  {
    id: "pet_baize",
    name: "白泽",
    desc: "知万物之名,能言人语,卧于神迹荒原的断碑之侧",
    icon: "paw",
    family: "beast",
    quality: "divine",
    mods: { expGain: 0.2, breakthroughRate: 0.06, eventLuck: 0.15 },
    personality: "greedy",
  },
  {
    id: "pet_xuanwu",
    name: "玄冥玄武",
    desc: "冥水之精,背负玄龟之甲,万法难伤",
    icon: "turtle",
    family: "turtle",
    quality: "divine",
    /*
     * 原先 防御 18 · 气血 18 · 减伤 8,被同为神品的镇岳尊(28/28/14)逐条压过。
     *
     * 玄冥玄武的意象是「背负玄龟之甲,万法难伤」—— 它该是那只**最耐打**的:
     * 气血 18 → 30(超过镇岳尊的 28),防御与减伤各抬一点但保持低于镇岳尊。
     * 这样两只各有强项(镇岳尊硬在减伤与濒危,玄冥厚在血量),不再是谁的严格下位。
     */
    mods: { maxHpPct: 0.3, defensePct: 0.2, damageReduction: 0.1 },
    personality: "wary",
  },
  {
    id: "pet_zhulong",
    name: "烛龙君",
    desc: "睁眼为昼,闭眼为夜,呼吸即四时",
    icon: "dragon",
    family: "dragon",
    quality: "divine",
    mods: { attackPct: 0.22, maxHpPct: 0.22, cultivationSpeed: 0.28 },
    personality: "fierce",
  },
  {
    id: "pet_jinwu",
    name: "金乌鸟",
    desc: "九日同栖一枝,鸣则天下皆明",
    icon: "bird",
    family: "bird",
    quality: "divine",
    mods: { attackPct: 0.2, critRate: 0.12, critDamage: 0.24 },
    personality: "rapid",
  },
  {
    id: "pet_haiwujing",
    name: "海蜃鲸",
    desc: "浮出水面时,整座城从背上长起",
    icon: "fish",
    family: "fish",
    quality: "divine",
    mods: { explorationSpeed: 0.36, eventLuck: 0.22, dodgeRate: 0.09 },
    personality: "cautious",
  },
  {
    id: "pet_qilinbi",
    name: "踏云麟",
    desc: "蹄不踏虫,踏过之处自生灵芝",
    icon: "qilin",
    family: "qilin",
    quality: "divine",
    mods: { luck: 0.2, dropRate: 0.16, doubleDropRate: 0.08 },
    personality: "greedy",
  },
  {
    id: "pet_wangchuan",
    name: "忘川兽",
    desc: "照过它的人,都忘了自己在修行",
    icon: "ghost",
    family: "ghost",
    quality: "divine",
    mods: { cultivationSpeed: 0.32, expGain: 0.26, breakthroughRate: 0.09 },
    personality: "steady",
  },
  {
    id: "pet_zaohualu",
    name: "造化炉",
    desc: "投进去的是废铁,吐出来是神通",
    icon: "gem",
    family: "treasure",
    quality: "divine",
    mods: { spiritStoneGain: 0.3, alchemyYield: 0.14, craftExpGain: 0.16 },
    personality: "greedy",
  },
  {
    id: "pet_zhenyuezun",
    name: "镇岳尊",
    desc: "山可移,它不可移,一步也不挪",
    icon: "god",
    family: "god",
    quality: "divine",
    mods: { defensePct: 0.28, maxHpPct: 0.28, damageReduction: 0.14, lowHpReduction: 0.06 },
    personality: "steady",
  },
];

const BY_ID = new Map(PETS.map((x) => [x.id, x]));

export function petDef(id: string): PetDef | undefined {
  return BY_ID.get(id);
}
