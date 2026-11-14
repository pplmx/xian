/**
 * 灵兽性格的内容表 —— 六种性格各改哪几项、叫什么、怎么说。
 *
 * 类型声明里有六个 id(`greedy|steady|fierce|cautious|rapid|wary`),而本表的行数
 * 由 `core/petTraitBreadth.spec` 三条钉住:正好六条、与类型对得上、**每种都真有灵兽在用**。
 * 先前这里写「四种」—— 那是加 `rapid` / `wary` 之前的数字,没跟着改。
 *
 * 为什么单独成文件:装配公共库(core/engineWorld)与查询性格效果(core/petPersonality)
 * 都要读它,而查询那侧还要用库算"叠加在中性值上是什么结果"。
 * 内容放 data/、规则走库,两边就不会互相 import 成环。
 *
 * 四项系数的含义(键名由本作定,库只当它是"一组有中性值的系数"):
 *   历练时长倍率 / 危险度修正 / 掉落品质修正 / 护主免败(危急时护住败绩)
 */
import type { TraitDef } from "wanxiang-engine";

export type PetPersonalityId = "greedy" | "steady" | "fierce" | "cautious" | "rapid" | "wary";

export const PET_TRAITS: TraitDef[] = [
  {
    id: "greedy",
    name: "贪宝",
    desc: "更容易发现稀有之物,但也会招来危险。",
    mods: { exploreDurMult: 1.0, dangerMult: 1.05, dropLuck: 0.06, lossReduction: 0 },
  },
  {
    id: "steady",
    name: "慢稳",
    desc: "历练更久更稳,失败率有所下降。",
    mods: { exploreDurMult: 1.1, dangerMult: 0.98, dropLuck: 0, lossReduction: 0.02 },
  },
  {
    id: "fierce",
    name: "好战",
    desc: "战斗收益更高,但更容易走上险路。",
    mods: { exploreDurMult: 1.0, dangerMult: 1.15, dropLuck: 0.02, lossReduction: 0 },
  },
  {
    id: "cautious",
    name: "谨慎",
    desc: "谨慎避祸,掉落则稍稍寻常。",
    mods: { exploreDurMult: 0.95, dangerMult: 0.95, dropLuck: -0.02, lossReduction: 0.04 },
  },
  /*
   * 后补的两种 —— 四种摊在四十只灵兽上,平均每种十只,「选伙伴 = 选走法」就
   * 退化成"先看数值、再看凑不凑得上性格"。只加性格、**不加维度**:新两种复用
   * 那四个键,取一组与现有四档错开的系数(见 core/petTraitBreadth.spec)。
   */
  {
    id: "rapid",
    name: "疾行",
    desc: "来去如风,一程走得更快,险处也去得更急。",
    mods: { exploreDurMult: 0.88, dangerMult: 1.08, dropLuck: 0.01, lossReduction: 0 },
  },
  {
    id: "wary",
    name: "守拙",
    desc: "不争先,只在最稳的那条路上走;好东西也少有。",
    mods: { exploreDurMult: 1.15, dangerMult: 0.92, dropLuck: -0.03, lossReduction: 0.06 },
  },
];

export const PERSONALITY_NAMES: Record<PetPersonalityId, string> = {
  greedy: "贪宝",
  steady: "慢稳",
  fierce: "好战",
  cautious: "谨慎",
  rapid: "疾行",
  wary: "守拙",
};

/** 性格一句话说明(选灵兽 UI) */
export function personalityDesc(p: PetPersonalityId): string {
  return PET_TRAITS.find((t) => t.id === p)?.desc ?? "";
}
