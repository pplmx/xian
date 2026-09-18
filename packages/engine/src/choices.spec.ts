import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createChoiceSystem, type ChoiceDef } from './choices.js'

/** 效果就用"字符串标签 + 数字"这种最朴素的载荷来演示:库不认识它们 */
type Effect = { tag: string; amount?: number }

interface Ctx {
  money: number
  log: string[]
}

const choices = createChoiceSystem<Effect, Ctx>({
  interpret: (effect, ctx) => {
    if (effect.tag === 'cost') {
      const amount = effect.amount ?? 0
      if (ctx.money < amount) return null // 付不起:这一条不发生
      ctx.money -= amount
      return `零花钱 -${amount}`
    }
    if (effect.tag === 'gain') {
      ctx.money += effect.amount ?? 0
      return `零花钱 +${effect.amount ?? 0}`
    }
    return `${effect.tag} 发生了`
  }
})

const choice = (over: Partial<ChoiceDef<Effect>> = {}): ChoiceDef<Effect> => ({
  label: '伸手去拿',
  outcomes: [
    { weight: 3, text: '摸到一块糖', effects: [{ tag: 'gain', amount: 5 }] },
    { weight: 1, text: '被烫了一下', effects: [{ tag: 'burn' }] }
  ],
  ...over
})

describe('抉择 —— 选项、后果与回执', () => {
  it('后果按权重掷;权重全为 0 时取第一条(边界要确定)', () => {
    const onlyZero = choice({ outcomes: [{ weight: 0, text: '甲' }, { weight: 0, text: '乙' }] })
    expect(choices.roll(onlyZero, createRng(1)).outcome.text).toBe('甲')
    // 权重 3:1 —— 一百次里"糖"明显更多
    const picks = Array.from({ length: 100 }, (_, i) => choices.roll(choice(), createRng(i)).outcome.text)
    expect(picks.filter(t => t === '摸到一块糖').length).toBeGreaterThan(60)
    expect(picks).toContain('被烫了一下')
  })

  it('结算逐条解释效果,并给出回执(说明行 + 没生效的条数)', () => {
    const ctx: Ctx = { money: 20, log: [] }
    const receipt = choices.resolve(
      choice({ outcomes: [{ weight: 1, text: '买下它', effects: [{ tag: 'cost', amount: 12 }, { tag: 'gain', amount: 3 }] }] }),
      ctx,
      createRng(1)
    )
    expect(receipt.text).toBe('买下它')
    expect(receipt.lines).toEqual(['零花钱 -12', '零花钱 +3'])
    expect(receipt.skipped).toBe(0)
    expect(ctx.money).toBe(11)
  })

  it('效果"没发生"时只算跳过,不影响其余条目(付不起就不该扣)', () => {
    const ctx: Ctx = { money: 5, log: [] }
    const receipt = choices.resolve(
      choice({ outcomes: [{ weight: 1, text: '硬着头皮', effects: [{ tag: 'cost', amount: 99 }, { tag: 'gain', amount: 2 }] }] }),
      ctx,
      createRng(1)
    )
    expect(receipt.skipped).toBe(1)
    expect(receipt.lines).toEqual(['零花钱 +2'])
    expect(ctx.money).toBe(7)
  })

  it('能不能选:`available` 可以直接给一句"为什么不能"', () => {
    const locked = choice({ available: () => '境界不够,看不懂那行字' })
    expect(choices.available(locked, { money: 0, log: [] })).toEqual({ ok: false, reason: '境界不够,看不懂那行字' })
    expect(choices.available(choice(), { money: 0, log: [] })).toEqual({ ok: true })
  })

  it('兜底项三级:默认且可选 → 第一条可选 → 第一条', () => {
    const ctx: Ctx = { money: 0, log: [] }
    const a = choice({ label: 'A', isDefault: true, available: () => false })
    const b = choice({ label: 'B' })
    const c = choice({ label: 'C', isDefault: true })
    expect(choices.defaultIndex([a, b, c], ctx)).toBe(2) // 默认且可选的是 C
    expect(choices.defaultIndex([a, b], ctx)).toBe(1) // 默认的 A 不可选 → 第一条可选的 B
    expect(choices.defaultIndex([a], ctx)).toBe(0) // 全不可选 → 第一条(界面不至于卡住)
  })

  it('没有后果的选项也能结算(什么都不发生,而不是崩)', () => {
    const empty = choice({ outcomes: [] })
    const receipt = choices.resolve(empty, { money: 0, log: [] }, createRng(2))
    expect(receipt.lines).toEqual([])
    expect(receipt.index).toBe(-1)
  })
})
