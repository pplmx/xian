/**
 * 灵草→灵石 兑换(快赢1 · ISS-303)
 *
 * 给前期(0~3 境)过剩的灵草一个出口,同时小额缓解灵石;防印钞两道闸:
 * 低换率(HERB_TO_STONE_COST)+ 每境兑换额度(HERB_EXCHANGE_ERA_QUOTA)。
 * 只救急不致富 —— 换出的灵石只是小补,不是灵石主来源。
 *
 * 额度按「大境界」计数:跨境(major 变化)自动重置。兑换以「灵石枚数」为单位
 * (换 n 枚灵石 = 花 n×HERB_TO_STONE_COST 株灵草),比例恒定,不做零头折算。
 */
import { gn } from '@/utils/gnum'
import { HERB_EXCHANGE_ERA_QUOTA, HERB_TO_STONE_COST } from '@/data/constants'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'

export interface HerbExchangeResult {
  ok: boolean
  stones: number
  herbsSpent: number
  quotaLeft: number
  reason?: 'noHerb' | 'quota' | 'badAmount'
}

/** 当前境的剩余兑换额度(株)—— 跨境自动重置 */
export function herbExchangeQuotaLeft(): number {
  const player = usePlayerStore()
  const resources = useResourcesStore()
  if (resources.herbExchangeRealm !== player.major) {
    resources.herbExchangeRealm = player.major
    resources.herbExchangeUsed = 0
  }
  return HERB_EXCHANGE_ERA_QUOTA - resources.herbExchangeUsed
}

/** 兑换 `stones` 枚灵石(耗 stones×HERB_TO_STONE_COST 株灵草) */
export function exchangeHerbForStone(stones: number): HerbExchangeResult {
  const resources = useResourcesStore()
  if (!Number.isInteger(stones) || stones < 1) return { ok: false, stones: 0, herbsSpent: 0, quotaLeft: herbExchangeQuotaLeft(), reason: 'badAmount' }
  const herbsNeeded = stones * HERB_TO_STONE_COST
  const quotaLeft = herbExchangeQuotaLeft()
  if (herbsNeeded > quotaLeft) return { ok: false, stones: 0, herbsSpent: 0, quotaLeft, reason: 'quota' }
  if (resources.herb < herbsNeeded) return { ok: false, stones: 0, herbsSpent: 0, quotaLeft, reason: 'noHerb' }

  resources.spendSmall('herb', herbsNeeded)
  resources.addStone(gn(stones))
  resources.herbExchangeUsed += herbsNeeded
  return { ok: true, stones, herbsSpent: herbsNeeded, quotaLeft: quotaLeft - herbsNeeded }
}
