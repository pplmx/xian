import { describe, expect, it } from 'vitest'
import { createChain } from './chain.js'

interface Ctx {
  done: readonly string[]
}

const chain = createChain<Ctx>({
  nodes: [
    { id: 'a', name: '第一节' },
    { id: 'b', name: '第二节' },
    { id: 'c', name: '第三节' },
    { id: 'd', name: '第四节' }
  ],
  done: (node, ctx) => ctx.done.includes(node.id)
})

const many = createChain<Ctx>({
  nodes: Array.from({ length: 20 }, (_, i) => ({ id: `n${i}` })),
  maxSteps: 5,
  done: () => true // 条件恒真:守卫必须拦住它
})

describe('顺序任务链 —— 连推多节、有上限、不可逆', () => {
  it('一次结算连推多节:后面几节同时成立就一起走完', () => {
    const out = chain.advance({ index: 0 }, { done: ['a', 'b', 'c'] })
    expect(out.advanced.map(n => n.id)).toEqual(['a', 'b', 'c'])
    expect(out.state).toEqual({ index: 3 })
    expect(out.current).toEqual({ id: 'd', name: '第四节' })
    expect(out.atEnd).toBe(false)
    expect(out.capped).toBe(false)
  })

  it('没有下一节时既不推进也不报错(通关是正常状态)', () => {
    const out = chain.advance({ index: 4 }, { done: ['a', 'b', 'c', 'd'] })
    expect(out.advanced).toEqual([])
    expect(out.state).toEqual({ index: 4 })
    expect(out.current).toBeNull()
    expect(out.atEnd).toBe(true)
    expect(out.capped).toBe(false)
  })

  it('只推该推的:中途哪一节没达成,就停在哪一节前面', () => {
    const out = chain.advance({ index: 0 }, { done: ['a', 'c'] })
    expect(out.advanced.map(n => n.id)).toEqual(['a'])
    expect(out.state).toEqual({ index: 1 })
    expect(out.capped).toBe(false)
  })

  it('一节都没达成时原样返回(连状态对象都不换)', () => {
    const state = { index: 0 }
    const out = chain.advance(state, { done: [] })
    expect(out.advanced).toEqual([])
    expect(out.state).toBe(state)
  })

  it('上限守卫生效:条件恒真时一轮只推 5 节,并把"被截住了"说出来', () => {
    const first = many.advance({ index: 0 }, { done: [] })
    expect(first.advanced.length).toBe(5)
    expect(first.state).toEqual({ index: 5 })
    expect(first.capped).toBe(true) // 第 6 节也满足,但这一轮不推
    const second = many.advance(first.state, { done: [] })
    expect(second.state).toEqual({ index: 10 })
    expect(second.capped).toBe(true)
  })

  it('上限没撞到时不算 capped:刚好推满且下一节没达成,是"推进到位"而不是"被截住"', () => {
    const exactly = createChain<Ctx>({
      nodes: chain.nodes,
      maxSteps: 3,
      done: (node, ctx) => ctx.done.includes(node.id)
    })
    const out = exactly.advance({ index: 0 }, { done: ['a', 'b', 'c'] })
    expect(out.advanced.length).toBe(3)
    expect(out.capped).toBe(false)
    expect(out.state).toEqual({ index: 3 })
  })

  it('上限是守卫不是配额:可以按内容配(默认 5)', () => {
    expect(chain.maxSteps).toBe(5)
    const one = createChain<Ctx>({ nodes: chain.nodes, maxSteps: 1, done: (n, ctx) => ctx.done.includes(n.id) })
    // 下一节没达成:推满也只是"推进到位"
    expect(one.advance({ index: 0 }, { done: ['a'] }).capped).toBe(false)
    // 下一节也达成:才是被守卫截住
    const capped = one.advance({ index: 0 }, { done: ['a', 'b'] })
    expect(capped.state).toEqual({ index: 1 })
    expect(capped.capped).toBe(true)
  })

  it('坏下标夹回合法范围:负数、NaN、越界都不该让链读出奇怪的一节', () => {
    expect(chain.clampIndex(-3)).toBe(0)
    expect(chain.clampIndex(Number.NaN)).toBe(0)
    expect(chain.clampIndex(99)).toBe(4)
    expect(chain.clampIndex(2.7)).toBe(2)
    expect(chain.advance({ index: -5 }, { done: ['a'] }).state).toEqual({ index: 1 })
    expect(chain.current({ index: 99 })).toBeNull()
  })

  it('读数:当前节点、还剩几节、按 id 找节点', () => {
    expect(chain.current({ index: 1 })).toEqual({ id: 'b', name: '第二节' })
    expect(chain.remaining({ index: 1 })).toBe(3)
    expect(chain.remaining({ index: 99 })).toBe(0)
    expect(chain.indexOf('c')).toBe(2)
    expect(chain.indexOf('没有这一节')).toBe(-1)
    expect(chain.nodeAt(0)?.id).toBe('a')
    expect(chain.nodeAt(9)).toBeNull()
  })

  it('推进不可逆:只进不退,返回值是新对象', () => {
    const before = { index: 1 }
    const out = chain.advance(before, { done: ['b', 'c'] })
    expect(out.state.index).toBe(3)
    expect(before).toEqual({ index: 1 })
    expect(out.state).not.toBe(before)
    expect(chain.advance(out.state, { done: [] }).state.index).toBe(3)
  })

  it('条件判据由内容给,ctx 原样传进去(库不认识境界 / 计数)', () => {
    const seen: string[] = []
    const custom = createChain<{ realm: number }>({
      nodes: chain.nodes,
      done: (node, ctx) => {
        seen.push(`${node.id}@${ctx.realm}`)
        return ctx.realm >= 3
      }
    })
    const out = custom.advance({ index: 0 }, { realm: 3 })
    expect(seen).toEqual(['a@3', 'b@3', 'c@3', 'd@3'])
    expect(out.atEnd).toBe(true)
  })
})
