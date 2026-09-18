/* eslint-disable no-console */
/**
 * 消融实验 —— 上限截断、来源审计与"整笔付出"的边界。
 *
 * `resources.spec.ts` 钉的是语义(收支夹上下限、取整、pay 整笔成败、audit 明细恒等于合计);
 * 这一份量的是**内容作者会问的那几个数**:一次发多了会被截掉多少、截掉的部分在账上长什么样、
 * 按来源看谁给的最多,以及"买不起"与"刚好买得起"的分界线在哪。
 *
 * 三条量出来的结论:
 *   ① **截断是"记在回执里"的,不是悄悄丢**:一次发 150 灵草、上限 100,入账 100、
 *      `clipped` 记 50 —— 界面上能说清"满了",而不是玩家自己发现数字对不上;
 *   ② **来源审计让"谁给的"一眼可查**:同样一批收支,按来源分摊后,
 *      "洞府产出" 与 "战斗掉落" 各贡献多少是分开的,且**明细之和恒等于合计**;
 *   ③ **pay 的分界线是"够不够"而不是"够多少"**:缺 1 点也整笔不扣(默认),
 *      要允许分次付得显式开 `partial` —— 这两种口径在账上留下的是两种完全不同的记录。
 */
import { describe, expect, it } from 'vitest'
import { createResourceSystem } from './resources.js'

const res = createResourceSystem({
  resources: [
    { key: 'stone', name: '灵石' },
    { key: 'herb', name: '灵草', cap: 100, integer: true },
    { key: 'dust', name: '灵尘', integer: true }
  ]
})

describe('消融实验 —— 上限、审计与整笔付出', () => {
  it('发多了会被截:入账按上限,截掉多少记在回执里', () => {
    const wallet = res.create({ herb: 90 })
    const granted = res.apply(wallet, [{ key: 'herb', amount: 150, source: '洞府产出' }])
    const entry = granted.entries[0]!
    console.log(`  已有 90、发 150(上限 100):余额 ${res.numberOf(granted.ledger, 'herb')} · 实际入账 ${entry.applied} · 被截 ${150 - entry.applied}`)

    // ① 截断发生在落账时,且回执如实记录"实际入账"与"截断"
    expect(res.numberOf(granted.ledger, 'herb')).toBe(100)
    expect(entry.applied).toBe(10)
    expect(entry.clamped).toBe(true)
    // 与 settlement 的口径一致:计划 − 实际 = 被夹掉的量
    const clipped = 150 - Number(entry.applied)
    expect(clipped).toBe(140)
    // 防空转:没到上限时不会夹(否则上面那条"clamped=true"说明不了什么)
    const small = res.apply(res.create({ herb: 0 }), [{ key: 'herb', amount: 30 }])
    expect(small.entries[0]!.clamped).toBe(false)
  })

  it('来源审计:同样一批收支,按来源分摊后明细之和恒等于合计', () => {
    let wallet = res.create()
    wallet = res.grant(wallet, [
      { key: 'stone', amount: 60, source: '洞府产出' },
      { key: 'herb', amount: 20, source: '洞府产出' },
      { key: 'stone', amount: 40, source: '战斗掉落' },
      { key: 'dust', amount: 15, source: '分解' }
    ]).ledger
    wallet = res.pay(wallet, [{ key: 'stone', amount: 30, source: '炼丹' }]).ledger
    const audit = res.audit([
      { key: 'stone', amount: 60, source: '洞府产出' },
      { key: 'herb', amount: 20, source: '洞府产出' },
      { key: 'stone', amount: 40, source: '战斗掉落' },
      { key: 'dust', amount: 15, source: '分解' }
    ].map(e => ({ ...e, applied: e.amount, clamped: false })))
    console.log(`  按来源:${Object.entries(audit.bySource).map(([src, row]) => `${src} ${row.income}`).join(' · ')}`)
    console.log(`  按资源:${Object.entries(audit.byKey).map(([key, row]) => `${key} 进${row.income}/出${row.expense}`).join(' · ')}`)

    // ② 按来源、按资源两份汇总都是"从同一批明细摊出来的"
    const bySourceTotal = Object.values(audit.bySource).reduce((sum, row) => sum + Number(row.income), 0)
    const byKeyTotal = Object.values(audit.byKey).reduce((sum, row) => sum + Number(row.income), 0)
    expect(bySourceTotal).toBe(byKeyTotal)
    expect(bySourceTotal).toBe(135) // 60 + 20 + 40 + 15
    expect(audit.bySource['洞府产出']!.income).toBe(80)
    expect(audit.bySource['战斗掉落']!.income).toBe(40)
    // 余额与"进 − 出"对得上(灵石:60 + 40 − 30)
    expect(res.numberOf(wallet, 'stone')).toBe(70)
    // 防空转:三个来源的数额确实不同(否则"按来源分摊"看不出东西)
    expect(new Set(Object.values(audit.bySource).map(r => r.income)).size).toBeGreaterThan(1)
  })

  it('pay 的分界线:缺一点也整笔不扣,要分次付得显式开 partial', () => {
    const wallet = res.create({ stone: 29 })
    const strict = res.pay(wallet, [{ key: 'stone', amount: 30, source: '炼丹' }])
    const partial = res.pay(wallet, [{ key: 'stone', amount: 30, source: '炼丹' }], { partial: true })
    console.log(
      `  余额 29、要付 30:默认 → ${strict.ok ? '扣了' : '整笔不扣'}(缺口 ${strict.shortfall.map(s => s.short).join('/')}) · 开 partial → 余额 ${res.numberOf(partial.ledger, 'stone')}`
    )

    // ③ 默认整笔成败;partial 才允许"有多少扣多少"
    expect(strict.ok).toBe(false)
    expect(res.numberOf(strict.ledger, 'stone')).toBe(29) // 原账本没动
    expect(strict.shortfall).toEqual([{ key: 'stone', short: 1 }])
    expect(partial.ok).toBe(false) // 仍然"没付清",但钱扣了
    expect(res.numberOf(partial.ledger, 'stone')).toBe(0)
    // 刚好够就能成:分界线是"够不够",不是"多多少"
    const exact = res.pay(res.create({ stone: 30 }), [{ key: 'stone', amount: 30 }])
    expect(exact.ok).toBe(true)
    expect(res.numberOf(exact.ledger, 'stone')).toBe(0)
    // 防空转:partial 确实扣了(与 strict 的 29 不同)
    expect(res.numberOf(partial.ledger, 'stone')).not.toBe(res.numberOf(strict.ledger, 'stone'))
  })

  it('整数资源按落账取整:小数产出不会留下"半棵草"', () => {
    const wallet = res.create()
    const granted = res.apply(wallet, [
      { key: 'herb', amount: 2.9, source: '收成' },
      { key: 'dust', amount: 0.4, source: '收成' }
    ])
    console.log(
      `  发 2.9 棵草 / 0.4 份尘(都标了 integer):实际入账 ${granted.entries.map(e => e.applied).join(' / ')}`
    )

    // 整数资源落账向下取整:2.9 → 2,0.4 → 0
    expect(res.numberOf(granted.ledger, 'herb')).toBe(2)
    expect(res.numberOf(granted.ledger, 'dust')).toBe(0)
    // 非整数资源(灵石)则保留小数
    const stone = res.apply(res.create(), [{ key: 'stone', amount: 2.9 }])
    expect(res.numberOf(stone.ledger, 'stone')).toBeCloseTo(2.9, 9)
    // 防空转:两种口径确实不同(否则"取整"这句话看不出来)
    expect(res.numberOf(granted.ledger, 'herb')).not.toBe(2.9)
  })
})
