/** 灵兽 —— 事件与灵兽园获得,佩戴一只
 * Phase 31.0 S4:增加性格(personality)—— 历练时的行为倾向,
 * 让玩家选伙伴而非只看数值
 *
 * 图标与敌人同一套规矩:这里写**族类**(`family`),形由 data/beastFamilies.ts 给出。
 * 原先直接写 icon,于是应龙与螭龙幼子是一枚星芒、麒麟是一枚兽爪、雪背小龟是一面盾 ——
 * 灵兽位只有一个,玩家要看的就是「这是只什么」,形对不上名物最刺眼。 */
import type { PetDef } from '@/types'

/**
 * 品阶纪律:品质更高,总词条预算(各词条绝对值之和)与同一词条键的数值,都不许
 * 比低品阶回落 —— 由 core/petQuality.spec 钉死(同法宝品阶阶梯的规矩)。加新灵兽
 * 或调数值都会被那道测试卡住,别绕过它:高品却出低数,正是玩家一眼看穿的失配。
 */
export const PETS: PetDef[] = [
  {
    id: 'pet_qingyu',
    name: '青羽灵狐',
    desc: '尾生青羽,善寻机缘',
    icon: 'fox',
    family: 'fox',
    quality: 'excellent',
    mods: { explorationSpeed: 0.1, eventLuck: 0.05 },
    personality: 'greedy'
  },
  {
    id: 'pet_xuegui',
    name: '雪背小龟',
    desc: '背驮微型山岳,稳如泰山',
    icon: 'turtle',
    family: 'turtle',
    quality: 'excellent',
    mods: { defensePct: 0.08, maxHpPct: 0.05 },
    personality: 'steady'
  },
  {
    id: 'pet_huoque',
    name: '赤火雀',
    desc: '羽翼含火,性子急躁',
    icon: 'bird',
    family: 'bird',
    quality: 'excellent',
    mods: { attackPct: 0.08, speed: 0.05 },
    personality: 'fierce'
  },
  {
    id: 'pet_yueying',
    name: '月影狸',
    desc: '昼伏夜出,来去无声',
    icon: 'moon',
    family: 'moon',
    quality: 'spirit',
    mods: { dodgeRate: 0.05, dropRate: 0.12 },
    personality: 'cautious'
  },
  {
    id: 'pet_jinchan',
    name: '三足金蟾',
    desc: '口衔铜钱,天生聚财',
    icon: 'gem',
    family: 'treasure',
    quality: 'spirit',
    mods: { spiritStoneGain: 0.15, luck: 0.05 },
    personality: 'greedy'
  },
  {
    id: 'pet_yaoguang',
    name: '摇光鹿',
    desc: '角悬星光,踏梦而行',
    icon: 'deer',
    family: 'deer',
    quality: 'profound',
    mods: { cultivationSpeed: 0.08, qiRegen: 0.12 },
    personality: 'steady'
  },
  {
    id: 'pet_leihou',
    name: '御雷猴',
    desc: '生于雷泽,不惧天威',
    icon: 'ape',
    family: 'ape',
    quality: 'profound',
    mods: { tribulationResist: 0.1, attackPct: 0.1 },
    personality: 'fierce'
  },
  {
    id: 'pet_longzi',
    name: '螭龙幼子',
    desc: '龙生九子,此其一也',
    icon: 'dragon',
    family: 'dragon',
    quality: 'heaven',
    mods: { attackPct: 0.1, maxHpPct: 0.1, cultivationSpeed: 0.1 },
    personality: 'fierce'
  },
  // ---- 仙界及以上神兽(仅由高界区域事件发放,见 data/events.ts) ----
  {
    id: 'pet_yinglong',
    name: '应龙',
    desc: '四爪生翼,云雨相随,仙门之上的护道神兽',
    icon: 'dragon',
    family: 'dragon',
    quality: 'immortal',
    mods: { attackPct: 0.15, maxHpPct: 0.15, cultivationSpeed: 0.1 },
    personality: 'fierce'
  },
  {
    id: 'pet_qilin',
    name: '麒麟',
    desc: '仁兽现世,祥瑞所至,福泽自生',
    icon: 'qilin',
    family: 'qilin',
    quality: 'immortal',
    mods: { luck: 0.15, dropRate: 0.12, defensePct: 0.12 },
    personality: 'steady'
  },
  {
    id: 'pet_kunpeng',
    name: '鲲鹏',
    desc: '北冥有鱼,化而为鹏,扶摇直上九万里',
    icon: 'bird',
    family: 'bird',
    quality: 'divine',
    mods: { explorationSpeed: 0.25, dodgeRate: 0.08, eventLuck: 0.12 },
    personality: 'cautious'
  },
  {
    id: 'pet_taotie',
    name: '混沌饕餮',
    desc: '混沌中孕育的凶兽,吞天噬地,不知餍足',
    icon: 'paw',
    family: 'beast',
    quality: 'divine',
    mods: { cultivationSpeed: 0.24, breakthroughRate: 0.08, lifesteal: 0.1 },
    personality: 'fierce'
  },
  // ---- 补足:每个界域至少两只(灵兽位只有一个,一界只有一只 = 没有选择) ----
  {
    id: 'pet_qingluan',
    name: '青鸾',
    desc: '羽色如洗,鸣声清越,云海之上的传信神禽',
    icon: 'bird',
    family: 'bird',
    quality: 'immortal',
    mods: { cultivationSpeed: 0.12, qiRegen: 0.12, explorationSpeed: 0.15 },
    personality: 'cautious'
  },
  {
    id: 'pet_baize',
    name: '白泽',
    desc: '知万物之名,能言人语,卧于神迹荒原的断碑之侧',
    icon: 'paw',
    family: 'beast',
    quality: 'divine',
    mods: { expGain: 0.2, breakthroughRate: 0.06, eventLuck: 0.15 },
    personality: 'greedy'
  }
]

const BY_ID = new Map(PETS.map(x => [x.id, x]))

export function petDef(id: string): PetDef | undefined {
  return BY_ID.get(id)
}
