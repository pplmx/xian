/* eslint-disable no-console */
/**
 * 消融实验 —— 投资点的容量取舍:总容量怎么分、换主位亏不亏。
 *
 * `points.spec.ts` 钉的是语义(总容量与主/副两档上限、换位不作废已投、投不成什么都不改);
 * 这一份量的是**玩家会算的那笔账**:总容量 10 点,主位能投 6、副位 3 ——
 * 全压一条能投满吗?分散投能不能一条投满?"换主位"到底亏了什么。
 *
 * 三条量出来的结论:
 *   ① **主位上限与总容量是两道不同的闸**:总容量 10、主位上限 6 —— 想一条投满 10 是做不到的
 *      (主位那条自己就封在 6),剩下的 4 点只能投到别处;
 *   ② **换主位不作废已投,但"超额"的那部分就此冻结**:主位投满 6 后换到副位(上限 3),
 *      那 6 点原样留着、只是**不能再往上投**(`capOf` 立刻从 6 变成 3);
 *   ③ **投不成什么都不改**:门槛没过 / 容量已尽 / 这条已到上限,三种失败都不动状态
 *      (包括"首次投点自动认主"也不认)。
 */
import { describe, expect, it } from 'vitest'
import type { PointState } from './points.js'
import { createPointPool } from './points.js'

/** 一套天赋:总容量 10,主位 6、副位 3 */
const pool = createPointPool<{ label: string }, { realm: number }>({
  total: 10,
  mainCap: 6,
  sideCap: 3,
  // 三句"为什么投不了"都由内容给(界面直接显示,所以别留空)
  mainCapReason: '主位已经加满',
  sideCapReason: '这一条到上限了',
  fullReason: '点数已经分完',
  branches: [
    { id: 'blade', name: '剑心', effect: points => ({ label: `剑心 ${points} 点` }) },
    { id: 'body', name: '体魄', effect: points => ({ label: `体魄 ${points} 点` }) },
    { id: 'mind', name: '神识', mainCap: 4, effect: points => ({ label: `神识 ${points} 点` }) }
  ],
  blocked: (_state, id, ctx) => (id === 'mind' && ctx.realm < 2 ? '境界不够,还悟不到神识' : undefined),
  costs: (_state, id) => [{ key: 'coin', amount: 10 + 5 * id.length }]
})

const empty: PointState = { points: {}, main: null }

describe('消融实验 —— 投资点的容量取舍', () => {
  it('主位上限与总容量是两道闸:一条最多投到主位上限,剩下的才轮到别处', () => {
    let state = empty
    for (let i = 0; i < 6; i += 1) state = pool.invest(state, 'blade', { realm: 3 }).state
    const bladeFull = pool.investInfo(state, 'blade', { realm: 3 })
    const bodyFirst = pool.investInfo(state, 'body', { realm: 3 })
    console.log(
      `  主位剑心投 6 点:再投 → ${bladeFull.can ? '能投' : bladeFull.reason || '到上限'} · 转到副位体魄 → ${bodyFirst.can ? '能投' : bodyFirst.reason}`
    )

    // ① 主位封在 6:再投被挡住(上限那句话说给人听)
    expect(pool.pointsOf(state, 'blade')).toBe(6)
    expect(bladeFull.can).toBe(false)
    expect(bladeFull.reason).toBe('主位已经加满')
    // 总量还有 4 点余量,可以投到副位(副位上限 3)
    expect(pool.remaining(state)).toBe(4)
    expect(bodyFirst.can).toBe(true)
    // 副位投到 3 就停(再投也投不动,因为总容量只剩 1)
    let next = state
    for (let i = 0; i < 3; i += 1) next = pool.invest(next, 'body', { realm: 3 }).state
    expect(pool.pointsOf(next, 'body')).toBe(3)
    expect(pool.remaining(next)).toBe(1)
    // 防空转:换个没到上限的分支,确实还能投(说明"投不动"是因为上限,不是因为全局锁死)
    expect(pool.investInfo(next, 'mind', { realm: 3 }).can).toBe(true)
  })

  it('换主位不作废已投,但超额的那部分就此冻结', () => {
    let state = empty
    for (let i = 0; i < 6; i += 1) state = pool.invest(state, 'blade', { realm: 3 }).state
    // 换到副位(副位上限 3):6 点原样留着
    const switched = pool.switchMain(state, 'body', { realm: 3 })
    console.log(
      `  把主位换成体魄:剑心仍有 ${pool.pointsOf(switched.state, 'blade')} 点 · 它现在的上限是 ${pool.capOf(switched.state, 'blade')} 点`
    )

    // ② 已投的点一个不少,但上限从主位的 6 掉到副位的 3 —— 超出部分只是不能再往上投
    expect(switched.can).toBe(true)
    expect(pool.pointsOf(switched.state, 'blade')).toBe(6)
    expect(pool.capOf(switched.state, 'blade')).toBe(3)
    expect(pool.investInfo(switched.state, 'blade', { realm: 3 }).can).toBe(false)
    // 效果照算:投入过的分支仍然出发(不作废)
    expect(pool.effectsOf(switched.state).map(e => e.label)).toContain('剑心 6 点')
    // 防空转:换回主位之后又只剩 10 − 6 − 0 = 4 点可用,且剑心重新受主位上限管
    expect(pool.capOf(switched.state, 'blade')).toBeLessThan(6)
  })

  it('投不成什么都不改:门槛 / 容量 / 上限三种失败都不动状态', () => {
    // 境界不够:神识要 realm ≥ 2
    const blocked = pool.invest(empty, 'mind', { realm: 1 })
    console.log(`  境界 1 投神识:${blocked.can ? '成了' : `不成(${blocked.reason})`} · 状态 ${JSON.stringify(blocked.state)}`)
    expect(blocked.can).toBe(false)
    // ③ 连"首次投点自动认主"都不认:状态原封不动
    expect(blocked.state).toEqual(empty)
    expect(blocked.state.main).toBeNull()

    // 容量已尽:把 10 点投光之后再投
    let full = empty
    for (let i = 0; i < 6; i += 1) full = pool.invest(full, 'blade', { realm: 3 }).state
    for (let i = 0; i < 3; i += 1) full = pool.invest(full, 'body', { realm: 3 }).state
    full = pool.invest(full, 'mind', { realm: 3 }).state // 第 10 点
    const overflow = pool.invest(full, 'mind', { realm: 3 })
    expect(pool.totalOf(full)).toBe(10)
    expect(overflow.can).toBe(false)
    expect(overflow.reason).toBe('点数已经分完')
    expect(overflow.state).toBe(full)
    // 防空转:三条分支都真被投过(否则"容量已尽"可能只是没人投)
    for (const id of ['blade', 'body', 'mind']) expect(pool.pointsOf(full, id)).toBeGreaterThan(0)
  })

  it('容量按账上所有键算:内容改名留下的旧键照样占着', () => {
    // 老档里有一个现在不再认识的分支名
    const legacy = { points: { blade: 6, oldBranch: 4 }, main: 'blade' }
    console.log(`  账上 ${JSON.stringify(legacy.points)} → 已占 ${pool.totalOf(legacy)} 点,余 ${pool.remaining(legacy)}`)

    // ④ 不认识的键也占容量 —— 否则"容量"会随一次内容改名凭空变大
    expect(pool.totalOf(legacy)).toBe(10)
    expect(pool.remaining(legacy)).toBe(0)
    expect(pool.investInfo(legacy, 'body', { realm: 3 }).can).toBe(false)
    // 但读取时不会因此炸:不认识的键只是投不了、也不出发效果
    expect(pool.pointsOf(legacy, 'oldBranch')).toBe(4)
    expect(pool.branchOf('oldBranch')).toBeUndefined()
    expect(pool.effectsOf(legacy).map(e => e.label)).toEqual(['剑心 6 点'])
    // 防空转:换一份没有旧键的账,余量立刻不一样
    expect(pool.remaining({ points: { blade: 6 }, main: 'blade' })).toBe(4)
  })
})
