import { describe, expect, it } from 'vitest'
import { createResourceSystem } from './resources.js'

const CONFIG = {
  resources: [
    { key: 'stone', name: '灵石' },
    { key: 'herb', name: '灵草', cap: 100 },
    { key: 'wudao', name: '悟道点', cap: 5000, floor: 0 }
  ]
}

describe('资源账本 —— 货币 / 材料 / 点数这一层', () => {
  it('按定义铺零,名字与机制键分开', () => {
    const res = createResourceSystem(CONFIG)
    const wallet = res.create()
    expect(Object.keys(wallet)).toEqual(['stone', 'herb', 'wudao'])
    expect(Number(wallet.stone)).toBe(0)
    expect(res.name('stone')).toBe('灵石')
    expect(res.name('unknown')).toBe('unknown')
  })

  it('买不起就整笔不扣,并给出缺口(默认;分次付要显式开 partial)', () => {
    const res = createResourceSystem(CONFIG)
    const wallet = res.create({ stone: 30, herb: 5 })
    const cost = [
      { key: 'stone', amount: 50, source: '炼丹' },
      { key: 'herb', amount: 5, source: '炼丹' }
    ]
    const failed = res.pay(wallet, cost)
    expect(failed.ok).toBe(false)
    expect(failed.shortfall).toEqual([{ key: 'stone', short: 20 }])
    expect(failed.ledger).toBe(wallet) // 原样不动
    expect(Number(failed.ledger.stone)).toBe(30)

    const enough = res.pay(res.create({ stone: 50, herb: 5 }), cost)
    expect(enough.ok).toBe(true)
    expect(Number(enough.ledger.stone)).toBe(0)
    expect(Number(enough.ledger.herb)).toBe(0)

    // 分次付:先付得起的部分,缺口照报
    const partial = res.pay(wallet, cost, { partial: true })
    expect(partial.ok).toBe(false)
    expect(Number(partial.ledger.stone)).toBe(0)
    expect(Number(partial.ledger.herb)).toBe(0)
    expect(partial.shortfall).toEqual([{ key: 'stone', short: 20 }])
  })

  it('上下限在落账时夹取:上限收不进去,下限扣不成负数', () => {
    const res = createResourceSystem(CONFIG)
    const wallet = res.create({ herb: 90, wudao: 10 })
    const gained = res.grant(wallet, [
      { key: 'herb', amount: 50, source: '掉落' },
      { key: 'wudao', amount: -50, source: '炼丹' }
    ])
    expect(Number(gained.ledger.herb)).toBe(100) // 90 + 50 → 夹到上限 100
    expect(Number(gained.ledger.wudao)).toBe(0) // 10 - 50 → 夹到下限 0
    expect(gained.entries.map(e => e.applied)).toEqual([10, -10])
    expect(gained.entries.every(e => e.clamped)).toBe(true)
  })

  it('上限可以随账本变化(洞府升级 / buff),capFn 说了算', () => {
    const res = createResourceSystem({
      resources: [{ key: 'qi', name: '灵气', cap: 100 }],
      capFn: (key, ledger) => (key === 'qi' ? 100 + Number((ledger as Record<string, unknown>).qiCapBonus ?? 0) : undefined)
    })
    const wallet = { qi: 100, qiCapBonus: 50 }
    const after = res.grant(wallet, [{ key: 'qi', amount: 30 }])
    expect(Number(after.ledger.qi)).toBe(130)
  })

  it('按步产出逐步夹上限 —— 挂机收益不是"一次乘完再加"', () => {
    const res = createResourceSystem({ resources: [{ key: 'qi', cap: 10 }] })
    const { ledger, entries } = res.produce(res.create(), 5, [{ key: 'qi', amount: 4, source: '洞府' }])
    expect(Number(ledger.qi)).toBe(10) // 4×5=20 → 每步夹到 10
    expect(entries.length).toBe(5)
    expect(entries.map(e => e.applied)).toEqual([4, 4, 2, 0, 0])

    // 与 idle 的步数账对得上:步数来自 planIdle
    expect(res.produce(res.create(), 0, [{ key: 'qi', amount: 4 }]).entries.length).toBe(0)
  })

  it('审计:按资源与按来源各一份,且明细恒等于合计', () => {
    const res = createResourceSystem(CONFIG)
    const wallet = res.create({ stone: 100 })
    const a = res.grant(wallet, [{ key: 'stone', amount: 30, source: '历练' }])
    const b = res.grant(a.ledger, [{ key: 'stone', amount: 20, source: '历练' }, { key: 'stone', amount: 10, source: '任务' }])
    const c = res.pay(b.ledger, [{ key: 'stone', amount: 40, source: '炼器' }])
    const all = [...a.entries, ...b.entries, ...c.entries]

    const report = res.audit(all)
    expect(report.byKey.stone!.income).toBe(60)
    expect(report.byKey.stone!.expense).toBe(40)
    expect(report.byKey.stone!.net).toBe(20)
    expect(report.bySource['历练']!.net).toBe(50)
    expect(report.bySource['任务']!.net).toBe(10)
    expect(report.bySource['炼器']!.net).toBe(-40)
    // 明细恒等于合计:各来源净额之和 === 按资源算出的净额
    const sourceNet = Object.values(report.bySource).reduce((sum, row) => sum + row.net, 0)
    expect(sourceNet).toBe(report.byKey.stone!.net)
    expect(Number(c.ledger.stone)).toBe(120)
  })

  it('形状修复:坏格子按定义兜回来,未知键原样留着', () => {
    const res = createResourceSystem(CONFIG)
    const fixed = res.normalize({ stone: 'abc', herb: -20, wudao: 99999, legacy: 7 })
    expect(Number(fixed.stone)).toBe(0) // 不是数 → 0
    expect(Number(fixed.herb)).toBe(0) // 越下限 → 0
    expect(Number(fixed.wudao)).toBe(5000) // 越上限 → 上限
    expect(Number(fixed.legacy)).toBe(7) // 更老的档留下的键,不删
    // 完全不是对象也不炸
    expect(Number(res.normalize(null).stone)).toBe(0)
  })

  it('落账是纯函数:不改入参;坏条目被跳过而不是炸掉整场结算', () => {
    const res = createResourceSystem(CONFIG)
    const wallet = res.create({ stone: 10 })
    const out = res.apply(wallet, [
      { key: 'stone', amount: 5, source: '历练' },
      { key: 'stone', amount: Number.NaN },
      null as unknown as { key: string; amount: number }
    ])
    expect(Number(wallet.stone)).toBe(10) // 入参没被改
    expect(Number(out.ledger.stone)).toBe(15)
    expect(out.entries.length).toBe(1)
    expect(out.rejected.length).toBe(1) // NaN 那条被拒,但没让整场结算崩
  })
})
