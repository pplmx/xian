/**
 * 灵兽性格服务(Phase 31.0 S4)
 *
 * 灵兽不只是数值加成:性格决定历练时的行为倾向。
 * 玩家选伙伴 = 选路线风格,而非单纯"哪个数值高"。
 *
 * 「性格 → 一组系数」这件事已搬进公共库(见 packages/engine 的 companions):
 * 库负责"查性格、叠加在中性值上、没带伙伴时给中性";本作只留内容
 * (四个性格叫什么、各改哪几项,见 data/petTraits)。
 */
import { PERSONALITY_NAMES, personalityDesc, type PetPersonalityId } from '@/data/petTraits'
import { COMPANION_SYSTEM } from './engineWorld'

export interface PetPersonalityEffects {
  /** 历练时长倍率(steady 更久) */
  exploreDurMult: number
  /** 危险率修正(fierce 更高) */
  dangerMult: number
  /** 掉落品质修正(greedy 更高) */
  dropLuck: number
  /** 战败率修正(cautious 更低) */
  lossReduction: number
}

export type PetPersonality = PetPersonalityId

// 名字与说明是文案,仍在 data/petTraits;这里原样转出,调用方不必改 import
export { PERSONALITY_NAMES, personalityDesc }

/** 陪行灵兽的性格效果(无灵兽时返回中性)—— 叠加规则由库的伙伴系统算 */
export function personalityEffects(petId: string | null): PetPersonalityEffects {
  return COMPANION_SYSTEM.effectsOf(petId) as unknown as PetPersonalityEffects
}
