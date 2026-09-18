/**
 * 组合验收(第二条链)—— **时间与随机拼起来仍然可复现**。
 *
 * 第一条链(`integration.spec.ts`)验的是"账目自洽";这条验另一类风险:一处随时间推进、
 * 一处掷骰、一处按保底计数 —— 拼在一起时最常见的三种漂移是:
 *
 *   一 **周期悄悄吃掉随机流**:"今天是哪一天"若用调用方那支 rng 抽,后面的掉落会整体位移
 *      (而且只在跨天时出现,平时看不出来);
 *   二 **离线分段与逐步不一致**:一次算完(或按小时摊)与"一步一步走"结果不同,
 *      上限在中途生效时尤其明显;
 *   三 **保底改写了未触发之前的随机**:开了"第 N 次必出"之后,连前面几次的结果都变了。
 *
 * 这份用例把 `planIdle` / `runIdle`(时间账)、`createCycleSystem`(每天一件时运)、
 * `createDropTable`(单次掉落)、`createPityCounter`(跨次保底)、`createIntake`(入库)与
 * `createSettlement`(回执)串成"挂机一晚",只断言这些不变量。
 */
import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import { planIdle, runIdle } from './idle.js'
import { createCycleSystem } from './cycles.js'
import { createDropTable } from './drops.js'
import { createPityCounter } from './pity.js'
import { createResourceSystem } from './resources.js'
import { createSettlement } from './settlement.js'
import { createHoldingSystem } from './holding.js'
import { createIntake } from './intake.js'

// ——— 一晚挂机:每 10 分钟一段,最多算 4 小时 ———
const idlePlan = (elapsedMs: number) =>
  planIdle(elapsedMs, { stepMs: 10 * 60_000, capMs: 4 * 3600_000, efficiency: 1 })

// ——— 时运:一个游戏日一件,由周期序号派生**独立**随机源 ———
const fortune = createCycleSystem({
  periodSec: 24 * 3600,
  pools: {
    sky: [
      { id: 'clear', name: '晴', weight: 3 },
      { id: 'wind', name: '风起', weight: 2, attrs: { bonus: 1 } },
      { id: 'storm', name: '雷雨', weight: 1, attrs: { bonus: 2 } }
    ]
  }
})

/** 时运给的概率倍率(内容口径:风起 ×1.5、雷雨 ×2) */
function fortuneMult(elapsedSec: number): number {
  const entry = fortune.at(elapsedSec, { pool: 'sky' }).entry
  const bonus = entry?.attrs?.bonus ?? 0
  return 1 + bonus * 0.5
}

const drops = createDropTable([
  { key: 'ore', chance: 0.5, count: [1, 3] as const },
  { key: 'gem', chance: 0.02, count: 1 }
])
const pity = createPityCounter({ hardAt: 12 })

interface Gem {
  uid: string
  grade: number
}
const box = createHoldingSystem<Gem>({ capacity: 3 })
const intake = createIntake<Gem, { shards: number }>({
  holding: box,
  accept: () => true,
  evictable: (items, incoming) =>
    [...items].sort((a, b) => a.grade - b.grade).find(candidate => candidate.grade < incoming.grade),
  fallback: item => ({ line: `碎成宝石屑×${item.grade}`, yield: { shards: item.grade } })
})

const resources = createResourceSystem({
  resources: [
    { key: 'ore', name: '矿石', integer: true },
    { key: 'shards', name: '宝石屑', integer: true }
  ]
})
const settlement = createSettlement({ resources })

/** 一晚挂机的全部状态 */
interface Night {
  ledger: ReturnType<typeof resources.create>
  gems: Gem[]
  pity: { counters: Record<string, number> }
  ore: number
  draws: number
  /**
   * 走一步(10 分钟):掷一件矿石 + 掷一次宝石(带保底),收了就入账记回执。
   *
   * `peekFortune` 打开时**只是问一句"今天是什么天"**(结果丢掉)—— 用来验证"问周期"这件事
   * 不消耗任何随机;`mult` 才是时运真正参与判定时的倍率(由调用方按内容算好)。
   */
  step: (elapsedSec: number, rng: Rng, opts?: { mult?: number; peekFortune?: boolean }) => void
}

function newNight(): Night {
  const night: Night = {
    ledger: resources.create({ ore: 0 }),
    gems: [],
    pity: { counters: {} },
    ore: 0,
    draws: 0,
    step(elapsedSec, rng, opts = {}) {
      if (opts.peekFortune) fortune.at(elapsedSec, { pool: 'sky' }) // 只问一句,结果不用
      const mult = opts.mult ?? 1

      const rolled = drops.rollOne(drops.entries[0]!, rng, { chanceMult: mult })
      night.draws += 1
      if (rolled.hits > 0) {
        const settled = settlement.settle(night.ledger, {
          grants: [{ key: 'ore', amount: rolled.count, source: '挂机' }]
        })
        night.ledger = settled.ledger
        night.ore += Number(settled.receipt.totals.ore ?? 0)
      }

      const gem = pity.roll(night.pity, 'gem', rng, 0.02 * mult)
      night.draws += 1
      night.pity = gem.state
      if (gem.hit) {
        const item: Gem = { uid: `g${night.draws}`, grade: gem.pity ? 3 : 2 }
        night.gems = [...intake.admit(box.create(night.gems), item).holding.items]
      }
    }
  }
  return night
}

/** 跑一晚,返回一份可比对的快照 */
function sleep(
  seed: number,
  opts: { hours?: number; peekFortune?: boolean; useFortune?: boolean } = {}
): string {
  const plan = idlePlan((opts.hours ?? 8) * 3600_000)
  const rng = createRng(seed)
  const night = newNight()
  runIdle(plan, 0, (_state, index) => {
    const elapsedSec = index * (plan.stepMs / 1000)
    night.step(elapsedSec, rng, {
      peekFortune: opts.peekFortune ?? false,
      mult: opts.useFortune ? fortuneMult(elapsedSec) : 1
    })
    return index + 1
  })
  return JSON.stringify({
    steps: plan.steps,
    cappedMs: plan.cappedMs,
    ore: resources.numberOf(night.ledger, 'ore'),
    oreReceipt: night.ore,
    draws: night.draws,
    gems: night.gems.map(g => `${g.uid}:${g.grade}`),
    pity: night.pity.counters.gem ?? 0
  })
}

describe('组合验收(时间 × 随机)—— 挂机一晚仍然可复现', () => {
  it('时间账与随机消耗对得上:离线 8 小时被上限截到 4 小时,掷骰次数按有效步数走', () => {
    const plan = idlePlan(8 * 3600_000)
    expect(plan.cappedMs).toBe(4 * 3600_000)
    expect(plan.steps).toBe(24) // 每步 10 分钟
    const night = newNight()
    const rng = createRng(1)
    runIdle(plan, 0, (_s, index) => {
      night.step(index * 600, rng)
      return index + 1
    })
    expect(night.draws).toBe(plan.steps * 2) // 每步两颗骰子:掉落 + 保底
  })

  it('同种子两遍完全一致(时间是输入,不是环境)', () => {
    expect(sleep(20260919)).toBe(sleep(20260919))
    expect(sleep(7)).not.toBe(sleep(8))
  })

  it('问"今天是哪一天"不消耗随机:问与不问,整晚结果逐次相同', () => {
    expect(sleep(20260919, { peekFortune: true })).toBe(sleep(20260919))
    expect(sleep(31, { peekFortune: true })).toBe(sleep(31))
  })

  it('时运真的参与判定时,结果会不同(说明上一条不是因为"时运没用")', () => {
    expect(sleep(20260919, { useFortune: true })).not.toBe(sleep(20260919))
  })

  it('保底不改未触发之前的随机:开了 12 次必出,前 11 次与不开时逐次相同', () => {
    const run = (hardAt: number | undefined, steps: number, seed: number): string[] => {
      const rng = createRng(seed)
      const counter = createPityCounter(hardAt === undefined ? {} : { hardAt })
      let state = { counters: {} as Record<string, number> }
      const rows: string[] = []
      for (let i = 0; i < steps; i += 1) {
        const out = counter.roll(state, 'gem', rng, 0.02)
        state = out.state
        rows.push(`${out.hit ? 'hit' : 'miss'}@${out.chance}`)
      }
      return rows
    }
    // 先找一颗"前 11 次都没出货"的种子(否则保底还没到点就被自然出货清了账)
    let seed = 0
    for (let s = 1; s < 20_000 && seed === 0; s += 1) {
      if (run(undefined, 11, s).every(row => row.startsWith('miss'))) seed = s
    }
    expect(seed).toBeGreaterThan(0)
    expect(run(12, 11, seed)).toEqual(run(undefined, 11, seed)) // 未触发之前逐次相同
    expect(run(12, 12, seed)[11]).toContain('hit@1') // 第 12 次是保底顶出来的
  })

  it('逐步走与一次算完一致:同样的步数与种子给同一份结果', () => {
    const plan = idlePlan(3 * 3600_000)
    const once = (): string => {
      const rng = createRng(5)
      const night = newNight()
      for (let i = 0; i < plan.steps; i += 1) night.step(i * 600, rng, { peekFortune: true })
      return JSON.stringify({ ore: night.ore, gems: night.gems.map(g => g.uid), pity: night.pity })
    }
    const viaIdle = (): string => {
      const rng = createRng(5)
      const night = newNight()
      runIdle(plan, 0, (_s, index) => {
        night.step(index * 600, rng, { peekFortune: true })
        return index + 1
      })
      return JSON.stringify({ ore: night.ore, gems: night.gems.map(g => g.uid), pity: night.pity })
    }
    expect(viaIdle()).toBe(once())
  })

  it('箱子满了不丢账:挤掉的走折算,矿石那一份只记实际进账', () => {
    const night = newNight()
    const rng = createRng(99)
    for (let i = 0; i < 12; i += 1) night.step(i * 600, rng)
    expect(night.gems.length).toBeLessThanOrEqual(box.capacityOf(box.create(night.gems)))
    expect(night.gems.length).toBeLessThanOrEqual(3)
    // 回执那一份 = 账本里多出来的那一份(挤掉的件折算成宝石屑,不进矿石)
    expect(resources.numberOf(night.ledger, 'ore')).toBe(night.ore)
  })
})
