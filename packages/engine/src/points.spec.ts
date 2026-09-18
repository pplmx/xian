import { describe, expect, it } from 'vitest'
import type { PointState } from './points.js'
import { createPointPool } from './points.js'

interface Ctx {
  unlocked: boolean
  price: number
}

const pool = createPointPool<{ gain: number }, Ctx, number>({
  branches: [
    { id: 'gather', name: '聚', effect: points => ({ gain: points * 0.4 }) },
    { id: 'craft', name: '炼', effect: points => ({ gain: points * 0.3 }) },
    { id: 'insight', name: '悟', mainCap: 5, effect: points => ({ gain: points * 0.2 }) }
  ],
  total: 10,
  mainCap: 7,
  sideCap: 3,
  fullReason: '容量已尽',
  mainCapReason: '主位圆满',
  sideCapReason: '副位有其上限',
  blocked: (_state, _id, ctx) => (ctx.unlocked ? undefined : ''),
  costs: (_state, _id, ctx) => [{ key: 'stone', amount: ctx.price }],
  switchCosts: (_state, _id, ctx) => [{ key: 'stone', amount: ctx.price * 5 }]
})

const open: Ctx = { unlocked: true, price: 10 }
const state = (patch: Partial<PointState> = {}): PointState => ({ points: {}, main: null, ...patch })

describe('投资点 —— 方向、上限与"能不能回头"', () => {
  it('首次投成功才认主:投一点就是投了一点,主位跟着定下来', () => {
    const first = pool.invest(state(), 'gather', open)
    expect(first.can).toBe(true)
    expect(first.state).toEqual({ points: { gather: 1 }, main: 'gather' })
    // 投第二条不会改主位
    const second = pool.invest(first.state, 'craft', open)
    expect(second.state).toEqual({ points: { gather: 1, craft: 1 }, main: 'gather' })
  })

  it('上限分主副两档:同一条在主位更深,在副位更浅', () => {
    const main = state({ points: { gather: 4, craft: 3 }, main: 'gather' })
    expect(pool.capOf(main, 'gather')).toBe(7)
    expect(pool.capOf(main, 'craft')).toBe(3)
    expect(pool.investInfo(main, 'craft', open)).toMatchObject({ can: false, reason: '副位有其上限' })
    expect(pool.investInfo(main, 'gather', open).can).toBe(true) // 主位还有余量
    // 主位到顶另有说法(顺序:容量先于这一条的上限)
    expect(pool.investInfo(state({ points: { gather: 7 }, main: 'gather' }), 'gather', open).reason).toBe('主位圆满')
    // 单条分支可以自己另给上限:悟道脉在主位只到 5(比池子的主位上限浅)
    expect(pool.capOf(main, 'insight')).toBe(3)
    expect(pool.capOf({ points: {}, main: 'insight' }, 'insight')).toBe(5)
  })

  it('总容量是另一把尺子:投满了就别处进不来(哪怕这条还没到自己的上限)', () => {
    const full = state({ points: { gather: 7, craft: 3 }, main: 'gather' })
    expect(pool.totalOf(full)).toBe(10)
    expect(pool.remaining(full)).toBe(0)
    expect(pool.investInfo(full, 'insight', open)).toMatchObject({ can: false, reason: '容量已尽' })
  })

  it('顺序即界面的说法:门槛先说,其次容量,最后才是这一条的上限', () => {
    const full = state({ points: { gather: 10 }, main: 'gather' })
    // 没开放:门槛先拦(这一版内容选择"不说理由")
    expect(pool.investInfo(full, 'gather', { unlocked: false, price: 10 }).reason).toBe('')
    // 开了:容量先于"主位圆满"
    expect(pool.investInfo(full, 'gather', open).reason).toBe('容量已尽')
  })

  it('投不成时**什么都不改**:状态原样返回,主位也不会被顺手认下', () => {
    const rejected = pool.invest(state(), 'gather', { unlocked: false, price: 10 })
    expect(rejected.can).toBe(false)
    expect(rejected.state.main).toBeNull()
    expect(rejected.state.points).toEqual({})
    // 钱不够是调用方的事(库只管判定),但"判定不过"这一档必须一动不动
    const capped = state({ points: { gather: 7 }, main: 'gather' })
    expect(pool.invest(capped, 'gather', open).state).toBe(capped)
  })

  it('换主位:只有主位变,已投点数一条都不动', () => {
    const before = state({ points: { gather: 5, craft: 1 }, main: 'gather' })
    const switched = pool.switchMain(before, 'craft', open)
    expect(switched.can).toBe(true)
    expect(switched.state).toEqual({ points: { gather: 5, craft: 1 }, main: 'craft' })
    // 原主位降到副位:还是 5 点(没被截断),只是不能再投
    expect(pool.pointsOf(switched.state, 'gather')).toBe(5)
    expect(pool.capOf(switched.state, 'gather')).toBe(3)
    expect(pool.investInfo(switched.state, 'gather', open).can).toBe(false)
  })

  it('换到已经在主位的那条 = 无事发生(不给说法);没开放也换不了', () => {
    const main = state({ points: { gather: 5 }, main: 'gather' })
    expect(pool.switchInfo(main, 'gather', open)).toMatchObject({ can: false, reason: '' })
    expect(pool.switchMain(main, 'gather', open).state).toBe(main)
    expect(pool.switchInfo(main, 'craft', { unlocked: false, price: 10 }).reason).toBe('')
    expect(pool.switchMain(main, 'craft', { unlocked: false, price: 10 }).state).toBe(main)
  })

  it('费用由内容给:投一点与换主位各算各的(数额是泛型)', () => {
    expect(pool.investInfo(state(), 'gather', open).costs).toEqual([{ key: 'stone', amount: 10 }])
    expect(pool.investInfo(state(), 'gather', { unlocked: true, price: 33 }).costs).toEqual([{ key: 'stone', amount: 33 }])
    expect(pool.switchInfo(state({ main: 'gather' }), 'craft', open).costs).toEqual([{ key: 'stone', amount: 50 }])
  })

  it('效果按点数算,只有投过点的分支才出(顺序即声明顺序)', () => {
    expect(pool.effectsOf(state({ points: { craft: 3, gather: 2 }, main: 'gather' }))).toEqual([
      { gain: 0.8 },
      { gain: 0.8999999999999999 }
    ])
    expect(pool.effectsOf(state())).toEqual([])
  })

  it('账上不认识的键也占容量(内容改名不该让容量凭空变大)', () => {
    const stale = state({ points: { gather: 5, 已经删掉的那条: 3 }, main: 'gather' })
    expect(pool.totalOf(stale)).toBe(8)
    expect(pool.remaining(stale)).toBe(2)
    expect(pool.effectsOf(stale)).toEqual([{ gain: 2 }]) // 认不出的那条不出效果
  })

  it('坏值当 0:NaN / 负数 / 小数都不该渗进容量与上限判定', () => {
    const bad = state({ points: { gather: Number.NaN, craft: -4, insight: 2.7 }, main: null })
    expect(pool.totalOf(bad)).toBe(2)
    expect(pool.pointsOf(bad, 'insight')).toBe(2)
    expect(pool.investInfo(bad, '没有这条', open)).toMatchObject({ can: false, reason: '' })
    expect(pool.capOf(bad, '没有这条')).toBe(0)
  })

  it('纯函数:入参状态不动,返回的是新对象', () => {
    const before = state({ points: { gather: 2 }, main: 'gather' })
    const snapshot = JSON.stringify(before)
    const after = pool.invest(before, 'gather', open)
    pool.switchMain(before, 'craft', open)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(after.state).not.toBe(before)
    expect(after.state.points).not.toBe(before.points)
  })
})
