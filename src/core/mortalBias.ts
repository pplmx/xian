/**
 * 世界的「资源偏向」—— 每一世那句话不再只是文案。
 *
 * 此前 `bias` 只出现在摘要与新颖度计算里:摘要写着「矿脉深厚之地」,而玄铁掉率
 * 一分不动。`worldSemantics.spec` 把它记成「看似有信息、实际没信息」。
 *
 * 现在每条偏向只接**一个渠道**、幅度 +15%,而且是**概率/份数**上的乘区,
 * 不是新的一层成长:它让「这一世去哪儿采」有了差别,又不把世界的差异变成
 * 又一条可刷的复利。
 */
export type BiasChannel = "herb" | "ore" | "page" | "pill" | "stone";

export interface BiasEffect {
  channel: BiasChannel;
  /** 该渠道的乘区;只放大,不削减(偏向是"这一世更有的东西") */
  mult: number;
  /** 给玩家看的一句话,必须与乘区同源 */
  label: string;
}

export const BIAS_EFFECTS: Readonly<Record<string, BiasEffect>> = {
  草木丰饶: { channel: "herb", mult: 1.15, label: "灵草掉落 +15%" },
  矿脉深厚: { channel: "ore", mult: 1.15, label: "玄铁掉落 +15%" },
  典籍散佚: { channel: "page", mult: 1.15, label: "功法残页掉落 +15%" },
  药气氤氲: { channel: "pill", mult: 1.15, label: "丹药掉落 +15%" },
  灵石充盈: { channel: "stone", mult: 1.15, label: "灵石收益 +15%" },
};

/** 这一世的偏向对某个渠道的乘区;对不上就是 1(绝不削减别的渠道) */
export function biasChanceMult(bias: string | undefined, channel: BiasChannel): number {
  const effect = bias === undefined ? undefined : BIAS_EFFECTS[bias];
  return effect && effect.channel === channel ? effect.mult : 1;
}

/** 偏向的效果描述(给界面用);未知偏向(老存档里的旧词)返回 undefined */
export function biasEffectOf(bias: string | undefined): BiasEffect | undefined {
  return bias === undefined ? undefined : BIAS_EFFECTS[bias];
}
