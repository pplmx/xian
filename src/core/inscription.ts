/**
 * 器铭 —— 「这一件」的出身。
 *
 * ## 解决的问题:同品同名的件没有分别
 *
 * 掉落是「模板 + 品质 + 词条」的笛卡尔积,于是神品·玄铁重剑可以一口气掉出几十件:
 * 名字一样、品阶一样、词条池一样。玩家只按战力留一件,其余分解 —— 那几十件在世界里
 * 毫无分别,「得到一件好东西」的喜悦被摊薄成「又一件同样的东西」。
 *
 * 器铭给它一件只属于这一件的来历:一枚两字铭名、一句铭文,再加一道**读真值**的
 * 成色刻度(词条掷点的均值)。
 *
 * ## 三条规矩
 *
 *   一 **只由 uid 决定**。铭是出身,不是每次打开重掷的装饰:存盘、刷新、导出导入
 *      之后它必须说同一句话。故这里只做一次字符串散列 + 定序取模,不碰 store、不读时钟。
 *   二 **灵品以下没有**。高级感的来源是稀缺;凡/良/精是寻常货,人人有铭就等于人人无铭。
 *   三 **口径不另写**。名目与颜色取 `qualityDef`;器类与界域不进铭 ——
 *      它们已经在器首眉题里报过一次,铭再复述一遍就是同一屏说两遍。
 *
 * ## 成色为什么不叫「评分」
 *
 * 它不做排序、不进任何结算,只把这一件**已有的**词条掷点摊成一道看得出深浅的刻度
 * (见 `resolveEquipStats` 里那条排序注释:roll 就是成色)。若它参与选哪一件,
 * 就成了第二套战力;器铭的正事是让玩家记得住某一件,不是替玩家做决定。
 */
import type { EquipmentInstance } from "@/types";
import { qualityDef } from "@/data/qualities";
import {
  INSCRIPTION_TITLES,
  INSCRIPTION_VERSES,
  type InscriptionVerseDef,
} from "@/data/inscriptions";

/**
 * 起刻的品阶 —— **灵品**(rank 3)。
 *
 * 取在灵品而不是玄品:灵品是玩家第一次「这一件值得留」的档,再往上才谈得上
 * 一辈子记得的那件;从玄品起的话,前中期会一整段没有可看的东西。
 */
export const INSCRIPTION_MIN_RANK = 3;

/** 一件装备的器铭(只读快照,不进存档) */
export interface Inscription {
  /** 两字铭名 */
  title: string;
  /** 铭文一句 */
  verse: { id: string; text: string };
  /** 成色 0~100,读词条掷点均值 */
  temper: number;
}

/**
 * 字符串散列 —— FNV-1a 的 32 位变体。
 *
 * 只要两个性质:**确定**(同一串恒等)与**散得开**(相邻 uid 不落在同一个桶)。
 * uid 是「时间串 + 计数 + 随机」,末几位本身就好散;这一层再把整串搅一遍,
 * 免得同一批里掉出的多件被同一个尾数绑到同一句铭上。
 */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  // 归到无符号 32 位,调用方拿它做取模
  return h >>> 0;
}

/** 由 uid 与用途派生一个稳定的非负整数 —— 同一件、同一用途恒得同一个数 */
function pick(seed: number, salt: string, length: number): number {
  if (length <= 0) return 0;
  return hashString(`${seed}:${salt}`) % length;
}

/**
 * 成色刻度:掷点均值(0~1)→ 0~100 的整数。
 *
 * 直接线性取整。写成函数而不是内联,是为了让「刻度是单调的」这件事可以被单独测
 * (见 inscription.spec):将来想改成凸曲线(满掷更值钱),改这里一处即可。
 */
export function inscriptionTemper(rollRatio: number): number {
  if (!Number.isFinite(rollRatio)) return 0;
  const r = Math.max(0, Math.min(1, rollRatio));
  return Math.round(r * 100);
}

/**
 * 词条掷点的均值。
 *
 * 坏值(NaN / 越界的 roll)先夹回 0~1 再平均:一条坏词条不该把整枚铭打成 NaN,
 * 而越界的 5 在语义上就是「满」。空词条(尚未重铸的胚子)按 0 给最低档。
 */
function rollRatioOf(instance: EquipmentInstance): number {
  const affixes = instance.affixes ?? [];
  if (affixes.length === 0) return 0;
  let sum = 0;
  for (const a of affixes) {
    const roll = Number.isFinite(a.roll) ? Math.max(0, Math.min(1, a.roll)) : 0;
    sum += roll;
  }
  return sum / affixes.length;
}

/**
 * 某一档品质可入铭的铭文 —— **累积**取,高品能取到低品的每一句。
 *
 * 于是「神品」不是换一句更长的诗,而是在整座铭库里挑(见 data/inscriptions 的注释)。
 * 取铭与判「这一档能取到几句」共用这一处 —— 将来若要写「可入铭 N 句」,数的是同一份。
 */
export function inscriptionVerseDefs(qualityRank: number): InscriptionVerseDef[] {
  return INSCRIPTION_VERSES.filter((v) => v.minRank <= qualityRank);
}

/**
 * 取一件装备的器铭;品阶不够(灵品以下)时返回 null。
 *
 * 纯函数:同一件(同一 uid、模板、品质、词条)反复问,答案恒等。
 */
export function inscriptionFor(instance: EquipmentInstance): Inscription | null {
  const quality = qualityDef(instance.quality);
  if (quality.rank < INSCRIPTION_MIN_RANK) return null;

  /**
   * 铭名与铭文各用一处盐 —— 两者互不联动。
   * 若共用一个数取模,这枚铭就退化成「铭名定了,铭文也跟着定」的一条序列,
   * 实际可选组合数会掉到铭名数那么多。
   */
  const seed = hashString(instance.uid);

  const title =
    INSCRIPTION_TITLES.length > 0
      ? INSCRIPTION_TITLES[pick(seed, "title", INSCRIPTION_TITLES.length)]!
      : "";

  const verses = inscriptionVerseDefs(quality.rank);
  const verse =
    verses.length > 0
      ? verses[pick(seed, "verse", verses.length)]!
      : { id: "v_none", minRank: quality.rank, text: "此器无铭" };

  return {
    title,
    verse: { id: verse.id, text: verse.text },
    temper: inscriptionTemper(rollRatioOf(instance)),
  };
}
