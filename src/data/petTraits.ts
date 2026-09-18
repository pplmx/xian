/**
 * 灵兽性格的内容表 —— 四种性格各改哪几项、叫什么、怎么说。
 *
 * 为什么单独成文件:装配公共库(core/engineWorld)与查询性格效果(core/petPersonality)
 * 都要读它,而查询那侧还要用库算"叠加在中性值上是什么结果"。
 * 内容放 data/、规则走库,两边就不会互相 import 成环。
 *
 * 四项系数的含义(键名由本作定,库只当它是"一组有中性值的系数"):
 *   历练时长倍率 / 危险度修正 / 掉落品质修正 / 战败率修正
 */
import type { TraitDef } from 'wanxiang-engine'

export type PetPersonalityId = 'greedy' | 'steady' | 'fierce' | 'cautious'

export const PET_TRAITS: TraitDef[] = [
  { id: 'greedy', name: '贪宝', desc: '更容易发现稀有之物,但也会招来危险。', mods: { exploreDurMult: 1.0, dangerMult: 1.05, dropLuck: 0.06, lossReduction: 0 } },
  { id: 'steady', name: '慢稳', desc: '历练更久更稳,失败率有所下降。', mods: { exploreDurMult: 1.1, dangerMult: 0.98, dropLuck: 0, lossReduction: 0.02 } },
  { id: 'fierce', name: '好战', desc: '战斗收益更高,但更容易走上险路。', mods: { exploreDurMult: 1.0, dangerMult: 1.15, dropLuck: 0.02, lossReduction: 0 } },
  { id: 'cautious', name: '谨慎', desc: '谨慎避祸,掉落则稍稍寻常。', mods: { exploreDurMult: 0.95, dangerMult: 0.95, dropLuck: -0.02, lossReduction: 0.04 } }
]

export const PERSONALITY_NAMES: Record<PetPersonalityId, string> = {
  greedy: '贪宝',
  steady: '慢稳',
  fierce: '好战',
  cautious: '谨慎'
}

/** 性格一句话说明(选灵兽 UI) */
export function personalityDesc(p: PetPersonalityId): string {
  return PET_TRAITS.find(t => t.id === p)?.desc ?? ''
}
