/**
 * 灵草坊(灵石→灵草,ISS-306)—— 服务层回归。
 *
 * 与旧「灵草→灵石」兑换(已删)完全相反的方向:只有灵石烧草,没有草换石。
 * 覆盖面:五品明码标价(×10 阶梯到一千万)、灵石不够/非法量/非法品一律拒绝、
 * 草入对应品阶、无任何 herb→stone 路径(设计闸)。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as market from './herbMarketService'
import { buyHerbs, herbBuyPrice } from './herbMarketService'
import { useResourcesStore } from '@/stores/resources'
import { usePlayerStore } from '@/stores/player'
import { HERB_BUY_PRICE, HERB_GRADE_NAMES } from '@/data/herbGrades'

describe('灵草坊 · 灵石购草(ISS-306)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const resources = useResourcesStore()
    resources.addStone({ m: 1, e: 3 }) // 1000 灵石
  })

  it('五品明码标价:单价 = HERB_BUY_PRICE,且是 ×10 阶梯一路到一千万', () => {
    expect(herbBuyPrice(1)).toBe(1_000)
    expect(herbBuyPrice(2)).toBe(10_000)
    expect(herbBuyPrice(3)).toBe(100_000)
    expect(herbBuyPrice(4)).toBe(1_000_000)
    expect(herbBuyPrice(5)).toBe(10_000_000)
    // 阶梯:每一品都是上一品的十倍 —— 「草比石贵的宣言」是一条刚性的曲线
    expect(HERB_BUY_PRICE[2]).toBe(HERB_BUY_PRICE[1] * 10)
    expect(HERB_BUY_PRICE[3]).toBe(HERB_BUY_PRICE[2] * 10)
    expect(HERB_BUY_PRICE[4]).toBe(HERB_BUY_PRICE[3] * 10)
    expect(HERB_BUY_PRICE[5]).toBe(HERB_BUY_PRICE[4] * 10)
    expect(HERB_GRADE_NAMES[5]).toBe('道品灵草')
  })

  it('买凡品草:灵石扣、草入凡品档', () => {
    const resources = useResourcesStore()
    const r = buyHerbs(1, 1)
    expect(r.ok).toBe(true)
    expect(r.costPerHerb).toBe(1_000)
    expect(resources.herbOf(1)).toBe(1)
    expect(resources.spiritStone.m * 10 ** resources.spiritStone.e).toBe(0)
  })

  it('高价品:单价×株数一次结清,灵石不够拒绝且不拆单', () => {
    const resources = useResourcesStore()
    // 1000 灵石只够买 1 株凡品,买 2 株要 2000 —— 不够
    const over = buyHerbs(1, 2)
    expect(over.ok).toBe(false)
    expect(over.reason).toBe('noStone')
    expect(resources.herbOf(1)).toBe(0)
    expect(resources.spiritStone.m).toBe(1)
    // 仙品草一株 10 万,1000 灵石连门都摸不到
    const high = buyHerbs(3, 1)
    expect(high.ok).toBe(false)
    expect(high.reason).toBe('noStone')
  })

  it('非法量/非法品拒绝', () => {
    expect(buyHerbs(1, 0).reason).toBe('badAmount')
    expect(buyHerbs(1, 1.5).reason).toBe('badAmount')
    expect(buyHerbs(6 as 5, 1).reason).toBe('badGrade')
    expect(buyHerbs(0 as 1, 1).reason).toBe('badGrade')
  })

  it('方向闸:模块只有灵石→草,没有草→石 的出入口', () => {
    // 旧版 exchangeHerbForStone / 任何"草换石"的名字都不许出现在模块表面
    expect(Object.keys(market)).not.toEqual(
      expect.arrayContaining(['exchangeHerbForStone', 'sellHerbs', 'stoneForHerb', 'exchangeHerb'])
    )
    // 服务层唯一的灵草入账:buyHerbs 花石、grantHerbs 不动石 —— 收草不是印石机
    const stoneBefore = useResourcesStore().spiritStone
    usePlayerStore().major = 18 // 混沌海:就地捡的草理应是道品
    useResourcesStore().grantHerbs(3)
    expect(useResourcesStore().herbOf(5)).toBe(3)
    expect(stoneBefore).toBe(useResourcesStore().spiritStone)
  })
})
