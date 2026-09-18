/* eslint-disable no-console */
/**
 * 组合验收 —— 把库的模块拼成一个小世界,验**跨模块的自洽**。
 *
 * 单个模块的语义都有自己的用例了,但"拼起来还对不对"是另一回事:一处产出的数字要经过
 * 产线 → 资源上限 → 结算回执 → 计数器 → 任务 / 主线 / 成就 → 再投资回产线,中间任何一环
 * 各算一遍,账目就会分叉。这份用例就搭一条这样的链路,并只断言**不变量**:
 *
 *   一 **产量守恒**:这一轮产出多少 = 实际入账多少 + 被上限截掉多少;
 *   二 **回执同源**:回执合计 = 账本实际增量(界面写的数与行囊里多出来的数是同一份);
 *   三 **进度单调且幂等**:重复结算不会重复发奖,进度与解锁集合只增不减;
 *   四 **判据唯一**:任务 / 主线的"达成"与界面读数出自同一份判断;
 *   五 **可复现**:同一颗种子跑两遍,整条链的账目完全一致。
 *
 * 用的是另一套题材(小工坊),与修仙无关 —— 这也顺带证明这些层确实与题材解耦。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { Ledger } from './resources.js'
import { createResourceSystem } from './resources.js'
import { createSettlement } from './settlement.js'
import { createFacilitySystem } from './facilities.js'
import { accrue } from './facilities.js'
import { createHoldingSystem } from './holding.js'
import { createIntake } from './intake.js'
import { createTaskBoard } from './tasks.js'
import { createChain } from './chain.js'
import { createUnlockRegistry } from './unlocks.js'
import { snapshotOf } from './counters.js'
import { evalGoal, goalProgress } from './goals.js'
import type { GoalEnv } from './goals.js'

// ——— 小世界:一间工坊 ———
const resources = createResourceSystem({
  resources: [
    { key: 'wood', name: '木料', cap: 60, integer: true },
    { key: 'ore', name: '铁料', integer: true }, // 不写 cap = 无上限
    { key: 'coin', name: '钱', integer: true }
  ]
})
const settlement = createSettlement({ resources })

const facilities = createFacilitySystem<{ craft: number }, { tools: number }, number>({
  facilities: [
    {
      id: 'saw',
      name: '锯台',
      maxLevel: 5,
      costs: level => [{ key: 'coin', amount: 10 * (level + 1) }],
      mods: level => ({ craft: level * 0.1 })
    },
    {
      id: 'mine',
      name: '矿点',
      maxLevel: 5,
      costs: level => [{ key: 'coin', amount: 10 * (level + 1) }],
      perHour: level => ({ ore: level * 3 })
    }
  ]
})

interface Plank {
  uid: string
  kind: 'plank'
  grade: number
}
const shelf = createHoldingSystem<Plank>({ capacity: 2 })
const intake = createIntake<Plank, { sawdust: number }>({
  holding: shelf,
  accept: item => item.grade >= 2, // 次品直接裁成木屑
  // 满了先看能不能腾位:拿最差的一件去换更好的新件
  evictable: (items, incoming) =>
    [...items].sort((a, b) => a.grade - b.grade).find(candidate => candidate.grade < incoming.grade),
  fallback: item => ({ line: `裁成木屑×${item.grade}`, yield: { sawdust: item.grade } })
})

const board = createTaskBoard({
  tasks: [
    { id: 't_wood', name: '今日备料', counter: 'woodMade', target: 10 },
    { id: 't_ore', name: '今日挖矿', counter: 'oreMade', target: 6 }
  ]
})
const chain = createChain<{ env: GoalEnv }>({
  nodes: [
    { id: 'c_saw', name: '锯台立起来' },
    { id: 'c_shop', name: '备料 30 份' }
  ],
  done: (node, ctx) =>
    node.id === 'c_saw'
      ? ctx.env.level() >= 1
      : evalGoal({ type: 'counter', key: 'woodMade', value: 30 }, ctx.env)
})
const unlocks = createUnlockRegistry({
  entries: [
    { id: 'u_first', name: '第一份料' },
    { id: 'u_thirty', name: '三十份料' }
  ]
})

interface World {
  ledger: Ledger<number>
  frac: Record<string, number>
  counters: Record<string, number>
  levels: Record<string, number>
  board: ReturnType<typeof board.rollover>
  chainIndex: number
  unlocked: string[]
  shelfItems: Plank[]
  /**
   * 一次结算里几笔账一起走:
   *   产线(带小数累积)→ 入账(带上限)→ 记数 → 任务 / 主线 / 成就 → 再投资
   * 返回值是这一轮**账面上发生过什么**(供不变量断言)。
   */
  tick: (hours: number, ctx: { tools: number }) => {
    produced: Record<string, number>
    receipt: Record<string, number>
    clipped: Record<string, number>
  }
}

function newWorld(): World {
  const world: World = {
    ledger: resources.create({ coin: 100 }),
    frac: { ore: 0 },
    counters: { woodMade: 0, oreMade: 0 },
    levels: { saw: 0, mine: 0 },
    board: board.rollover({ period: '', base: {}, claimed: [] }, {}, 'D1'),
    chainIndex: 0,
    unlocked: [],
    shelfItems: [],
    tick(hours, ctx) {
      // ① 产线:每小时速率 → 按秒推进,零头留在累加器里
      const rates = facilities.ratesOf(world.levels, ctx)
      const grown = accrue(world.frac, rates, hours * 3600)
      world.frac = grown.frac
      const produced = grown.whole

      // ② 入账:走结算回执(带上限截断),回执是"实际入账"的唯一来源
      const grants = Object.entries(produced).map(([key, amount]) => ({ key, amount, source: '工坊' }))
      const settled = settlement.settle(world.ledger, { grants })
      world.ledger = settled.ledger

      // ③ 记数:只用"实际入账"那一份(与回执同源)
      const receipt: Record<string, number> = {}
      const clipped: Record<string, number> = {}
      for (const key of Object.keys(produced)) {
        receipt[key] = Number(settled.receipt.totals[key] ?? 0)
        clipped[key] = Number(settled.receipt.clipped[key] ?? 0)
      }
      world.counters = { ...world.counters, oreMade: (world.counters.oreMade ?? 0) + (receipt.ore ?? 0) }

      // ④ 任务 / 主线 / 成就:共用同一份计数器与判据
      const tasks = board.settle(world.board, world.counters)
      world.board = tasks.state
      world.chainIndex = chain.advance({ index: world.chainIndex }, { env: envOf(world) }).state.index
      const scan = unlocks.scan({ unlocked: world.unlocked }, entry =>
        entry.id === 'u_first' ? (world.counters.woodMade ?? 0) >= 1 : evalGoal({ type: 'counter', key: 'woodMade', value: 30 }, envOf(world))
      )
      world.unlocked = [...scan.state.unlocked]

      return { produced, receipt, clipped }
    }
  }
  return world
}

const envOf = (world: World): GoalEnv => ({
  counter: key => world.counters[key] ?? 0,
  level: () => world.levels.saw ?? 0
})

/** 把一份木料交给工坊:走入库漏斗(见证 → 裁决 → 腾位 → 折算) */
function deliver(world: World, item: Plank): { line: string; bagged: boolean } {
  const out = intake.admit(shelf.create(world.shelfItems), item)
  world.shelfItems = [...out.holding.items]
  return { line: out.lines.join('/'), bagged: out.admitted }
}

describe('组合验收 —— 产线、账本、任务与成就在一条链上自洽', () => {
  it('产量守恒:产出 = 实际入账 + 被上限截掉', () => {
    const world = newWorld()
    world.levels = { saw: 0, mine: 3 } // 每小时 9 铁料
    const out = world.tick(10, { tools: 0 }) // 90 铁料,上限 0(无上限)
    expect(out.produced.ore).toBe(90)
    expect(out.receipt.ore).toBe(90)
    expect(out.clipped.ore).toBe(0)
    expect(resources.numberOf(world.ledger, 'ore')).toBe(90)
  })

  it('回执同源:账本增量恰好是回执里那一份(不是另算的期望值)', () => {
    const world = newWorld()
    world.levels = { saw: 0, mine: 2 }
    const before = resources.numberOf(world.ledger, 'ore')
    const out = world.tick(2, { tools: 0 }) // 12 铁料
    const after = resources.numberOf(world.ledger, 'ore')
    expect(after - before).toBe(out.receipt.ore ?? 0)
    expect((out.receipt.ore ?? 0) + (out.clipped.ore ?? 0)).toBe(out.produced.ore ?? 0)
  })

  it('上限不会被绕过:满了之后回执只记实际入账,差额进 clipped', () => {
    const world = newWorld()
    world.levels = { saw: 0, mine: 0 }
    // 木料上限 60:直接给 80(经结算回执)
    const settled = settlement.settle(world.ledger, { grants: [{ key: 'wood', amount: 80, source: '工坊' }] })
    world.ledger = settled.ledger
    expect(resources.numberOf(world.ledger, 'wood')).toBe(60)
    expect(Number(settled.receipt.totals.wood)).toBe(60)
    expect(Number(settled.receipt.clipped.wood)).toBe(20)
  })

  it('幂等:同一份计数器再结算一次,不重复发奖、不重复推进', () => {
    const world = newWorld()
    world.levels = { saw: 1, mine: 0 } // 主线第一节的判据就是"锯台立起来"
    world.counters = { woodMade: 40, oreMade: 9 }
    const first = board.settle(world.board, world.counters)
    world.board = first.state
    const again = board.settle(world.board, world.counters)
    expect(first.settled.length).toBe(2)
    expect(again.settled).toEqual([])
    // 主线与成就同样:再扫一遍什么都不发生
    const chainAgain = chain.advance({ index: world.chainIndex }, { env: envOf(world) })
    expect(chainAgain.advanced.length).toBeGreaterThan(0)
    world.chainIndex = chainAgain.state.index
    const scan = unlocks.scan({ unlocked: world.unlocked }, () => true)
    expect(scan.newly.length).toBe(2)
    world.unlocked = [...scan.state.unlocked]
    // 三条线再各走一遍:全是空手而归(这就是"一次性"的含义)
    expect(chain.advance({ index: world.chainIndex }, { env: envOf(world) }).advanced).toEqual([])
    expect(unlocks.scan({ unlocked: world.unlocked }, () => true).newly).toEqual([])
  })

  it('进度单调:连着跑五轮,任务进度、主线下标与已解锁条目都只增不减', () => {
    const world = newWorld()
    world.levels = { saw: 0, mine: 2 }
    let prev = { progress: 0, index: 0, unlocked: 0 }
    for (let i = 0; i < 5; i += 1) {
      world.counters = { ...world.counters, woodMade: (world.counters.woodMade ?? 0) + 12 }
      world.tick(1, { tools: 0 })
      const now = {
        progress: board.board(world.board, world.counters).reduce((sum, row) => sum + row.progress, 0),
        index: world.chainIndex,
        unlocked: world.unlocked.length
      }
      expect(now.progress).toBeGreaterThanOrEqual(prev.progress)
      expect(now.index).toBeGreaterThanOrEqual(prev.index)
      expect(now.unlocked).toBeGreaterThanOrEqual(prev.unlocked)
      prev = now
    }
    expect(prev.progress).toBeGreaterThan(0)
    console.log(`  五轮之后:任务进度合计 ${prev.progress} · 主线到第 ${prev.index} 节 · 解锁 ${prev.unlocked} 项`)
  })

  it('判据唯一:任务与主线的"达成"和界面读数出自同一份判断', () => {
    const world = newWorld()
    world.levels = { saw: 1, mine: 0 }
    world.counters = { woodMade: 30, oreMade: 6 }
    for (const row of board.board(world.board, world.counters)) {
      const canSettle = board.settle(world.board, world.counters).settled.some(x => x.task.id === row.task.id)
      expect(canSettle).toBe(row.done && !row.claimed)
    }
    const goal = goalProgress({ type: 'counter', key: 'woodMade', value: 30 }, envOf(world))
    expect(goal?.done).toBe(true)
    const next = chain.advance({ index: world.chainIndex }, { env: envOf(world) })
    expect(next.advanced.length).toBeGreaterThan(0) // 读数说"够了",推进也认
  })

  it('入库漏斗与账本各管一段:次品裁成木屑,合格品占架子', () => {
    const world = newWorld()
    expect(deliver(world, { uid: 'p1', kind: 'plank', grade: 1 })).toMatchObject({ bagged: false })
    expect(world.shelfItems).toEqual([])
    expect(deliver(world, { uid: 'p2', kind: 'plank', grade: 3 })).toMatchObject({ bagged: true })
    expect(world.shelfItems.map(i => i.uid)).toEqual(['p2'])
    // 架子只有 2 件:再来一件更好的会把最差的那件挤掉
    deliver(world, { uid: 'p3', kind: 'plank', grade: 3 })
    const crowded = deliver(world, { uid: 'p4', kind: 'plank', grade: 5 })
    expect(crowded.bagged).toBe(true)
    expect(world.shelfItems.length).toBe(2)
  })

  it('可复现:同一颗种子跑两遍,整条链的账目完全一致', () => {
    const run = (): string => {
      const world = newWorld()
      const rng = createRng(20260919)
      world.levels = { saw: 1, mine: 2 }
      const rows: string[] = []
      for (let i = 0; i < 6; i += 1) {
        const out = world.tick(2, { tools: 0 })
        // 每轮掷一次"料好不好"(种子的作用就在这里)
        const grade = rng.chance(0.5) ? 3 : 1
        deliver(world, { uid: `p${i}`, kind: 'plank', grade })
        rows.push(
          `${JSON.stringify(out.produced)}|${JSON.stringify(out.receipt)}|${resources.numberOf(world.ledger, 'ore')}|` +
            `${world.shelfItems.map(i => i.uid).join(',')}|${world.unlocked.join(',')}|${world.chainIndex}`
        )
      }
      return rows.join('\n')
    }
    expect(run()).toBe(run())
  })

  it('升级设施:钱够就升(白拿的是下一轮的产量),不够就整笔不扣', () => {
    const world = newWorld()
    const info = facilities.upgradeInfo(world.levels, 'mine', { tools: 0 })
    expect(info.can).toBe(true)
    const paid = resources.pay(world.ledger, [{ key: 'coin', amount: info.costs[0]!.amount as number }])
    expect(paid.ok).toBe(true)
    world.ledger = paid.ledger
    world.levels = { ...world.levels, mine: info.nextLevel }
    const poor = resources.pay(world.ledger, [{ key: 'coin', amount: 9999 }])
    expect(poor.ok).toBe(false)
    expect(poor.ledger).toBe(world.ledger) // 付不起就整笔不扣,账本原样
    // 白拿"的其实是产量:升一级之后每小时多 3 铁料
    expect(facilities.ratesOf(world.levels, { tools: 0 }).ore).toBe(3)
  })

  it('基准快照:同一份计数器同时回答"生涯"与"这一轮"', () => {
    const world = newWorld()
    const base = snapshotOf(world.counters)
    world.counters = { ...world.counters, woodMade: (world.counters.woodMade ?? 0) + 12 }
    expect(world.counters.woodMade).toBe(12) // 生涯
    expect((world.counters.woodMade ?? 0) - (base.woodMade ?? 0)).toBe(12) // 这一轮
  })
})
