import { describe, expect, it } from 'vitest'
import type { UnlockState } from './unlocks.js'
import { createUnlockRegistry } from './unlocks.js'

const registry = createUnlockRegistry({
  entries: [
    { id: 'a_first', name: '第一步' },
    { id: 'a_ten', name: '第十步' },
    { id: 'a_hundred', name: '第一百步' },
    { id: 'a_state', name: '状态型' }
  ]
})

const state = (unlocked: string[] = []): UnlockState => ({ unlocked })

describe('一次性解锁 —— 只记一次、可多条、显式也要去重', () => {
  it('扫描一次可以解锁多条,顺序即声明顺序', () => {
    const out = registry.scan(state(), entry => entry.id !== 'a_state')
    expect(out.newly.map(e => e.id)).toEqual(['a_first', 'a_ten', 'a_hundred'])
    expect(out.state.unlocked).toEqual(['a_first', 'a_ten', 'a_hundred'])
  })

  it('再扫一遍:已经解开的不再挑出来,奖励不会发第二遍', () => {
    const first = registry.scan(state(), () => true)
    const again = registry.scan(first.state, () => true)
    expect(again.newly).toEqual([])
    expect(again.state).toBe(first.state) // 没有变化就连引用都不换
  })

  it('没达成的不登记:扫描只认判据说的', () => {
    const out = registry.scan(state(), entry => entry.id === 'a_ten')
    expect(out.newly.map(e => e.id)).toEqual(['a_ten'])
    expect(registry.has(out.state, 'a_first')).toBe(false)
  })

  it('显式解锁:一次真解、再点一次就 false(状态型成就会被反复触发)', () => {
    const first = registry.unlock(state(), 'a_state')
    expect(first.unlocked).toBe(true)
    expect(first.entry).toEqual({ id: 'a_state', name: '状态型' })
    const again = registry.unlock(first.state, 'a_state')
    expect(again.unlocked).toBe(false)
    expect(again.state).toBe(first.state)
  })

  it('显式解锁与扫描共用同一份账:一个解了,另一个就不再挑', () => {
    const manual = registry.unlock(state(), 'a_first')
    const out = registry.scan(manual.state, () => true)
    expect(out.newly.map(e => e.id)).toEqual(['a_ten', 'a_hundred', 'a_state'])
  })

  it('认不出的 id 不当成"解锁成功",也不进账', () => {
    const out = registry.unlock(state(), '没有这枚成就')
    expect(out.unlocked).toBe(false)
    expect(out.entry).toBeNull()
    expect(out.state.unlocked).toEqual([])
  })

  it('读数:已解几条、还剩几条、按顺序列出(认不出的旧数据跳过)', () => {
    const mixed = state(['a_ten', '早年删掉的那枚', 'a_first'])
    expect(registry.count(mixed)).toBe(3)
    expect(registry.remaining(mixed)).toBe(1)
    expect(registry.list(mixed).map(e => e.id)).toEqual(['a_ten', 'a_first'])
    expect(registry.has(mixed, 'a_ten')).toBe(true)
    expect(registry.has(mixed, 'a_hundred')).toBe(false)
  })

  it('解锁顺序被记下来(成就墙 / 履历按它排)', () => {
    const out = registry.scan(state(), entry => entry.id === 'a_hundred')
    const second = registry.unlock(out.state, 'a_first')
    expect(second.state.unlocked).toEqual(['a_hundred', 'a_first'])
  })

  it('纯函数:入参状态不动,返回的是新对象', () => {
    const before = state(['a_first'])
    const snapshot = JSON.stringify(before)
    registry.unlock(before, 'a_ten')
    registry.scan(before, () => true)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(registry.unlock(before, 'a_ten').state).not.toBe(before)
  })

  it('判据每个条目只问一次(不因为"顺手看一眼"多问)', () => {
    const asked: string[] = []
    registry.scan(state(), entry => {
      asked.push(entry.id)
      return false
    })
    expect(asked).toEqual(registry.entries.map(e => e.id))
  })
})
