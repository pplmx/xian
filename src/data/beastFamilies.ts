/**
 * 敌人与灵宠的「族类 → 形」表
 *
 * 原先敌人的 icon 是「大类够用就行」那一套:131 只敌人只用了 19 枚图标,其中 46 只
 * 共用骷髅 —— 独角妖狼、霞光巨蟒、黑风妖王、玄冰蛟、万妖林主全是一枚骷髅;18 只共用
 * 兽爪(野狼、野猪、石猿、灵狐、妖熊、霜狼 与「麒麟」同形)。灵宠那边,应龙与螭龙
 * 幼子是星芒、麒麟是兽爪、雪背小龟是盾。名字写着狼,画的是骷髅。
 *
 * 这里的规矩只有两条:
 *   一 一族共用一枚形 —— 同类可以共用,「各方神兽」不必各画一枚;
 *   二 异族不共用同一枚形 —— 这条由 inkIcons.spec.ts 的判据盯着(一枚图标被一个
 *      以上族类共用即红),不是靠自觉。
 *
 * 族类表是**唯一事实源**:数据里只写 `family`,形从这里取。新加敌人时先问「它是什么
 * 族类」,而不是「哪个图标差不多」——后者正是「长刀配斧形」那一类错法的来路。
 */
import type { BeastFamily } from '@/types'

export interface BeastFamilyDef {
  /** 族类在人话里的名字(写进文档与注释,不直接上界面) */
  name: string
  /**
   * 这一族共用的那枚形(注册在 src/ui/inkIcons.ts)。
   * 同一枚形只能出现在一个族类上 —— inkIcons.spec.ts 会红。
   */
  icon: string
  /** 归入这一族的都长什么样 —— 数据侧照着它归类 */
  covers: string
}

export const BEAST_FAMILIES: Record<BeastFamily, BeastFamilyDef> = {
  // ---- 有名有姓的走兽:各成一族,各有一形 ----
  wolf: { name: '狼', icon: 'wolf', covers: '狼;妖狼、火狼、霜狼一类' },
  fox: { name: '狐', icon: 'fox', covers: '狐;灵狐一类,尾大成形' },
  boar: { name: '豕', icon: 'boar', covers: '野猪一类,獠牙厚背' },
  bear: { name: '熊', icon: 'bear', covers: '熊;妖熊一类' },
  ape: { name: '猿', icon: 'ape', covers: '猿猴;石猿、冰猿、雷猴一类' },
  deer: { name: '鹿', icon: 'deer', covers: '鹿;摇光鹿一类,角为形' },
  serpent: { name: '蛇蛟', icon: 'serpent', covers: '蛇、蟒、蛟、九头蛇 —— 无角无爪的鳞虫' },
  dragon: { name: '龙', icon: 'dragon', covers: '龙;螭龙、应龙一类,有角有爪' },
  qilin: { name: '麒麟', icon: 'qilin', covers: '麒麟、石麟一类,一角而仁' },
  turtle: { name: '龟', icon: 'turtle', covers: '龟;雪背小龟一类,背甲为形' },
  bat: { name: '蝠', icon: 'bat', covers: '蝙蝠;幽窟蝙蝠一类' },
  bird: { name: '羽禽', icon: 'bird', covers: '雀、鹰、鹤、鸾、鹏 —— 有羽有喙' },
  fish: { name: '鱼', icon: 'fish', covers: '鱼、鲛;幽冥鬼鲛、虚空游鱼' },
  beast: { name: '走兽', icon: 'paw', covers: '没写名目的兽:陨铁兽、星空古兽、各方的神兽与异兽' },
  plant: { name: '草木', icon: 'leaf', covers: '藤木花草;噬人藤一类' },
  water: { name: '水属', icon: 'waves', covers: '水里的物事:沼泥、渡厄仙槎(槎是舟,不是兽)' },

  // ---- 非血肉之躯 ----
  ghost: { name: '亡灵', icon: 'ghost', covers: '魂、鬼、尸、影、残念 —— 没了躯壳的那一类' },
  puppet: { name: '傀儡', icon: 'puppet', covers: '傀儡、俑、石像、神像 —— 土木机关做出的人形' },
  sword: { name: '剑器', icon: 'sword', covers: '剑之属:剑灵、断剑、剑冢之主' },
  spear: { name: '枪器', icon: 'spear', covers: '枪之属:枪灵' },

  // ---- 人形一类:按名目里的「魔/仙/神」分,不按强弱 ----
  guard: { name: '甲士', icon: 'shield', covers: '卫、兵、将、守卫、骑士、斥候 —— 披甲执兵之士' },
  demon: { name: '妖魔', icon: 'demon', covers: '妖、魔:妖王、魔尊、妖圣、域主、古魔、罗刹' },
  immortal: { name: '仙', icon: 'immortal', covers: '仙道:仙翁、仙后、仙娥、道童、道尊、仙子' },
  god: { name: '神', icon: 'god', covers: '神:神王、神帝、天主、星君、神官、守者' },

  // ---- 有专门名目的灵物 ----
  spirit: { name: '灵', icon: 'sparkles', covers: '仙灵、真灵、游灵、本源 —— 不是亡魂,是一缕灵气' },
  star: { name: '星辰', icon: 'star', covers: '星光之属:星君、仙光、神使、星海之灵' },
  moon: { name: '月华', icon: 'moon', covers: '月华之属;月影狸一类' },
  outsider: { name: '天外', icon: 'cloud', covers: '自天外来的客;天外来客一类' },
  treasure: { name: '金玉', icon: 'gem', covers: '金玉之精:三足金蟾、帝印神兽' }
}

/** 族类取形 —— 数据侧只用这一个入口,免得两处各写一份 icon */
export function beastIcon(family: BeastFamily): string {
  return BEAST_FAMILIES[family].icon
}
