/**
 * 器铭的内容表 —— 铭名与铭文。
 *
 * 与 `core/inscription` 的分工:这里只有字,没有规则。谁能有铭、取哪一句、
 * 成色怎么算,全在 core 那一侧;内容一改,铭库即刻跟着换,不必碰逻辑。
 *
 * ## 为什么铭要按品阶分层
 *
 * 「高级感」靠稀缺,不靠人人有份:灵品起才刻铭(凡/良/精是寻常货),而每一档
 * 能取到的铭文比上一档**只多不少** —— 高品不是换一句更长的诗,而是在更大的
 * 铭库里挑。低品能取的那几句,高品照样取得到;「神品为什么配得上」由数量与
 * 沉厚程度一起回答。
 *
 * 每句都不带数字:铭文是叙事,数字该来自这一件自己的成色(见 core/inscription
 * 的 temper),两样混在一起,改常数那一天铭就开始撒谎。
 */
export interface InscriptionVerseDef {
  id: string;
  /** 从这一档品质起可入铭(rank:灵 3 / 玄 4 / 地 5 / 天 6 / 仙 7 / 神 8) */
  minRank: number;
  text: string;
}

export const INSCRIPTION_VERSES: InscriptionVerseDef[] = [
  // ---- 灵品起(四句)----
  { id: "v_ling_1", minRank: 3, text: "铁线锁重山,形销而意存" },
  { id: "v_ling_2", minRank: 3, text: "霜气初凝,刃上犹带夜露" },
  { id: "v_ling_3", minRank: 3, text: "环中藏光,符走龙蛇" },
  { id: "v_ling_4", minRank: 3, text: "朴铁堪用,一器自成天地" },
  // ---- 玄品起(两句)----
  { id: "v_xuan_1", minRank: 4, text: "铸于玄水之滨,取星辰为火" },
  { id: "v_xuan_2", minRank: 4, text: "千锤未改其性,百炼方见其心" },
  // ---- 地品起(两句)----
  { id: "v_di_1", minRank: 5, text: "山河所钟,负之如山而不觉其重" },
  { id: "v_di_2", minRank: 5, text: "厚土载物,器亦载一方水土" },
  // ---- 天品起(一句)----
  { id: "v_tian_1", minRank: 6, text: "天成其纹,非人力可摹" },
  // ---- 仙品起(一句)----
  { id: "v_xian_1", minRank: 7, text: "仙风过刃,万法皆为之低昂" },
  // ---- 神品起(两句)----
  { id: "v_shen_1", minRank: 8, text: "开天之器,一痕划破鸿蒙" },
  { id: "v_shen_2", minRank: 8, text: "神意寓形,持之者与道同寿" },
];

/**
 * 铭名 —— 两字一签,落在铭文之上作题。
 *
 * 与铭文分开:铭文讲这一类的来历,铭名只给这一件一个叫得出口的名字。
 * 十枚轮转,同一件永远取到同一枚(见 core/inscription 的 uid 定序)。
 */
export const INSCRIPTION_TITLES: string[] = [
  "霜华",
  "星霜",
  "苍梧",
  "照夜",
  "沉渊",
  "含光",
  "承露",
  "照海",
  "镇岳",
  "鸣霄",
];
