import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createCodex } from './codex.js'

const codex = createCodex({
  stages: [
    { name: '未识', at: 0 },
    { name: '眼熟', at: 1 },
    { name: '知其路数', at: 5 },
    { name: '洞悉', at: 14 }
  ],
  // 见一次首领不容易,故它的门槛另有一张表
  stagesOf: id =>
    id.startsWith('boss')
      ? [
          { name: '未识', at: 0 },
          { name: '眼熟', at: 1 },
          { name: '知其路数', at: 2 },
          { name: '洞悉', at: 3 }
        ]
      : undefined
})

describe('图鉴 / 见闻', () => {
  it('累计照面跨阈值升档:败绩算三次(被打疼的记得最牢)', () => {
    let state = codex.create()
    // 第一场就眼熟
    let step = codex.observe(state, 'wolf', { weight: 1 })
    state = step.state
    expect(step.advanced).toBe(true)
    expect(step.name).toBe('眼熟')
    // 再败一场 = 三次 → 累计 4,还不到 5
    step = codex.observe(state, 'wolf', { weight: 3 })
    state = step.state
    expect(codex.view(state, 'wolf').seen).toBe(4)
    expect(step.advanced).toBe(false)
    expect(codex.view(state, 'wolf').remaining).toBe(1)
    // 再败一场 → 累计 7,进"知其路数"
    step = codex.observe(state, 'wolf', { weight: 3 })
    state = step.state
    expect(step.advanced).toBe(true)
    expect(step.name).toBe('知其路数')
    // 一次只进一层(不会一口气跳到顶)
    expect(codex.view(state, 'wolf').maxed).toBe(false)
  })

  it('同一张表也能按分组换(首领门槛更松)', () => {
    let state = codex.create()
    state = codex.observe(state, 'boss_king', { weight: 1 }).state
    state = codex.observe(state, 'boss_king', { weight: 1 }).state
    expect(codex.view(state, 'boss_king').stage).toBe(2) // 普通敌人要到 5 次
    state = codex.observe(state, 'boss_king', { weight: 1 }).state
    expect(codex.view(state, 'boss_king').maxed).toBe(true)
  })

  it('按概率升档:见得多不等于认得出,掷中才进', () => {
    let state = codex.create()
    // 概率给 1 → 必进;给 0 → 必不进
    state = codex.tryAdvance(state, 'herb', createRng(1), () => 1).state
    expect(codex.view(state, 'herb').stage).toBe(1)
    const miss = codex.tryAdvance(state, 'herb', createRng(2), () => 0)
    expect(miss.advanced).toBe(false)
    expect(codex.view(miss.state, 'herb').stage).toBe(1)
    // 概率由作品算:同一份状态,不同概率给出不同结果
    const sometimes = Array.from({ length: 40 }, (_, i) =>
      codex.tryAdvance(codex.create(), 'herb', createRng(i), () => 0.5).advanced
    )
    expect(sometimes.filter(Boolean).length).toBeGreaterThan(5)
    expect(sometimes.filter(Boolean).length).toBeLessThan(35)
  })

  it('"亲手用过"是另一条更深的路,且推进不可逆(档位只增不减)', () => {
    let state = codex.create()
    state = codex.advanceTo(state, 'ore', 3).state // 直接到顶档
    expect(codex.view(state, 'ore').name).toBe('洞悉')
    // 往回推不会发生
    const back = codex.advanceTo(state, 'ore', 1)
    expect(back.advanced).toBe(false)
    expect(codex.view(back.state, 'ore').stage).toBe(3)
  })

  it('只记见过的最好一件:各维度各取其高(15 阶天品与 20 阶良品谁更好没有定义)', () => {
    let state = codex.create()
    state = codex.rememberBest(state, 'sword', { q: 8, t: 15 }).state
    state = codex.rememberBest(state, 'sword', { q: 3, t: 20 }).state
    expect(state.best.sword).toEqual({ q: 8, t: 20 }) // 品质取高的、层级取高的,各记各的
    // 更差的一件不改动它(也不产生"有新收获"的提示)
    const worse = codex.rememberBest(state, 'sword', { q: 1, t: 2 })
    expect(worse.improved).toBe(false)
    expect(worse.state).toBe(state)
    // "用没用过"只是同一份记录里的一格:用过之后,后面的成色照旧只升不降
    state = codex.rememberBest(state, 'sword', { u: 1 }).state
    state = codex.rememberBest(state, 'sword', { q: 2, t: 18 }).state
    expect(state.best.sword).toEqual({ q: 8, t: 20, u: 1 })
  })

  it('进度读数:已知几条、各档各有多少、还差哪些', () => {
    let state = codex.create()
    state = codex.observe(state, 'a', { weight: 1 }).state // 眼熟
    // 一次照面只进一层(与本作一致:一场战斗最多推进一档)——所以重量再大也要来两次
    state = codex.observe(state, 'b', { weight: 5 }).state // 累计 5 → 眼熟
    state = codex.observe(state, 'b', { weight: 5 }).state // 累计 10 → 知其路数
    state = codex.observe(state, 'c', { weight: 0 }).state // 仍"未识"
    const report = codex.stats(state, ['a', 'b', 'c', 'd'])
    expect(report.total).toBe(4)
    expect(report.known).toBe(2)
    expect(report.locked).toEqual(['c', 'd'])
    // 分档读数的顺序取决于"谁先遇到",这里只比内容(名字 → 条数)
    expect(Object.fromEntries(report.byStage.map(r => [r.name, r.count]))).toEqual({
      未识: 2,
      眼熟: 1,
      知其路数: 1
    })
  })
})
