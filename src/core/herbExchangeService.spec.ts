/**
 * 灵草→灵石 兑换(快赢1 · ISS-303)—— 服务层回归。
 *
 * 防印钞两道闸:低换率(HERB_TO_STONE_COST)+ 每境额度(HERB_EXCHANGE_ERA_QUOTA)。
 * 覆盖面:比例恒定、额度按大境界计数并跨境重置、超额度/草不足/非法量一律拒绝。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { exchangeHerbForStone, herbExchangeQuotaLeft } from './herbExchangeService'
import { useResourcesStore } from '@/stores/resources'
import { usePlayerStore } from '@/stores/player'
import { HERB_EXCHANGE_ERA_QUOTA, HERB_TO_STONE_COST } from '@/data/constants'

describe('灵草→灵石 兑换(快赢1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useResourcesStore().addSmall('herb', 10_000)
  })

  it('按固定换率兑换:stones 枚灵石 = stones×换率 株灵草,灵石入账、草扣除', () => {
    const resources = useResourcesStore()
    const r = exchangeHerbForStone(3)
    expect(r.ok).toBe(true)
    expect(r.herbsSpent).toBe(3 * HERB_TO_STONE_COST)
    expect(r.stones).toBe(3)
    expect(resources.herb).toBe(10_000 - 3 * HERB_TO_STONE_COST)
    // 灵石是大数,换算回数值核对
    expect(resources.spiritStone.m * 10 ** resources.spiritStone.e).toBe(3)
  })

  it('额度按大境界计数,跨境自动重置', () => {
    const player = usePlayerStore()
    // 第一境兑满额度
    const remain = herbExchangeQuotaLeft()
    const stones = Math.floor(remain / HERB_TO_STONE_COST)
    const r1 = exchangeHerbForStone(stones)
    expect(r1.ok).toBe(true)
    expect(herbExchangeQuotaLeft()).toBe(remain - stones * HERB_TO_STONE_COST)
    // 同一境再兑被额度拦下
    const over = exchangeHerbForStone(1)
    expect(over.ok).toBe(false)
    expect(over.reason).toBe('quota')
    // 跨境后额度刷新
    player.major = 1
    expect(herbExchangeQuotaLeft()).toBe(HERB_EXCHANGE_ERA_QUOTA)
  })

  it('草不足或非法量拒绝', () => {
    expect(exchangeHerbForStone(0).reason).toBe('badAmount')
    expect(exchangeHerbForStone(1.5).reason).toBe('badAmount')
    // 全兑掉到比所需少
    useResourcesStore().herb = 1
    const r = exchangeHerbForStone(1)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('noHerb')
  })

  it('防印钞:每境总兑换株数不超过额度,补的灵石有总量硬金', () => {
    let totalStones = 0
    let used = 0
    while (used + HERB_TO_STONE_COST <= HERB_EXCHANGE_ERA_QUOTA) {
      used += HERB_TO_STONE_COST
      totalStones += 1
      exchangeHerbForStone(1)
    }
    // 额度按株计、兑换按整块计,故最多用到「额度内最大的整块倍数」
    const maxWhole = Math.floor(HERB_EXCHANGE_ERA_QUOTA / HERB_TO_STONE_COST)
    expect(totalStones).toBe(maxWhole)
    expect(used).toBe(maxWhole * HERB_TO_STONE_COST)
    // 羊毛出在额度内,剩余零头凑不成一整块,绝不超过
    expect(herbExchangeQuotaLeft()).toBe(HERB_EXCHANGE_ERA_QUOTA - used)
  })
})
