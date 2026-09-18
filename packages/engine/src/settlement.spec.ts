import { describe, expect, it } from 'vitest'
import { createResourceSystem } from './resources.js'
import { createSettlement } from './settlement.js'

const resources = createResourceSystem({
  resources: [
    { key: 'stone', name: '灵石' },
    { key: 'herb', name: '灵草', cap: 100, integer: true },
    { key: 'voucher', name: '券', integer: true }
  ]
})

const settlement = createSettlement({ resources })

describe('结算回执 —— 数字与实际入账同源', () => {
  it('回执里的合计 = 账本实际增量(不是计划值)', () => {
    const ledger = resources.create({ stone: 10, herb: 5 })
    const { ledger: after, receipt } = settlement.settle(ledger, {
      grants: [
        { key: 'stone', amount: 30, source: '战斗' },
        { key: 'herb', amount: 7, source: '战斗' }
      ]
    })
    expect(Number(receipt.totals.stone)).toBe(30)
    expect(Number(receipt.totals.herb)).toBe(7)
    // 与账本的实际增量对得上
    expect(resources.numberOf(after, 'stone') - resources.numberOf(ledger, 'stone')).toBe(Number(receipt.totals.stone))
    expect(resources.numberOf(after, 'herb') - resources.numberOf(ledger, 'herb')).toBe(Number(receipt.totals.herb))
  })

  it('被上限截掉的部分单独给一栏 —— 界面才说得清"满了"', () => {
    const ledger = resources.create({ herb: 95 })
    const { ledger: after, receipt } = settlement.settle(ledger, { grants: [{ key: 'herb', amount: 40 }] })
    expect(Number(receipt.totals.herb)).toBe(5) // 实际只进 5(95 → 上限 100)
    expect(Number(receipt.clipped.herb)).toBe(35) // 被截掉 35
    expect(resources.numberOf(after, 'herb')).toBe(100)
  })

  it('扣除同样是"实际发生额":不够扣就一条都没发生', () => {
    const ledger = resources.create({ voucher: 2 })
    const { receipt } = settlement.settle(ledger, { grants: [{ key: 'voucher', amount: -5 }] })
    expect(Number(receipt.totals.voucher)).toBe(-2) // 只扣到下限 0
    expect(Number(receipt.clipped.voucher)).toBe(-3)
  })

  it('多笔同键累加,且整数资源被取整过的差额也算进 clipped', () => {
    const ledger = resources.create()
    const { receipt } = settlement.settle(ledger, {
      grants: [
        { key: 'herb', amount: 2.4 },
        { key: 'herb', amount: 1.1 }
      ]
    })
    expect(Number(receipt.totals.herb)).toBe(3) // 2 + 1(取整在落账时发生)
    expect(Number(receipt.clipped.herb)).toBeCloseTo(0.5, 10) // 2.4+1.1−3
  })

  it('纯函数:入参账本不动', () => {
    const ledger = resources.create({ stone: 3 })
    settlement.settle(ledger, { grants: [{ key: 'stone', amount: 100 }] })
    expect(resources.numberOf(ledger, 'stone')).toBe(3)
  })

  it('没有发放就是空回执(而不是报错)', () => {
    const { receipt } = settlement.settle(resources.create(), {})
    expect(receipt.totals).toEqual({})
    expect(receipt.clipped).toEqual({})
  })
})
