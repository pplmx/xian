/* eslint-disable no-console */
/**
 * 规模实验 —— "服务端跑批量模拟也能直接用"这句话,到底能跑多快。
 *
 * README 里一直写着"纯函数 + 数据驱动,服务端跑批量模拟也能直接用",但库里**没有任何关于规模的判据**:
 * 既没有吞吐数字,也没有"数量级退化会被挡住"的闸门。这一份补上后半句。
 *
 * 三条口径:
 *   ① **测的是数量级,不是跑分**:每条都有"每毫秒多少次"的读数,闸门设在实测的**二十分之一**左右
 *      —— 这样偶尔的 CI 抖动不会红,但"某次改动把某条路径拖慢几十倍"一定会被挡住;
 *   ② **用固定种子**:同一份工作量每次跑的是同一批数,读数才有可比性;
 *   ③ **给出"一晚上能跑多少"**:内容作者真正关心的是"我跑一遍全服模拟要多久",所以每条都换算了
 *      一个可感的规模(十万次掉落 / 一万场战斗 / 一百万步离线)。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createDropTable } from './drops.js'
import { createCombatEngine } from './combat.js'
import { planIdle, runIdle } from './idle.js'
import { asFiniteNumber } from './saveShape.js'
import { defineSaveFormat, encodeSave, decodeSave } from './save.js'
import { attributeDefs, createAttributeSystem } from './attributes.js'

/** 跑一段,返回耗时毫秒(用 Date.now:库的源码里不引 Node 类型,`performance` 不在类型面上) */
function timeMs(work: () => void): number {
  const start = Date.now()
  work()
  return Math.max(1, Date.now() - start)
}

/** 读数 + 闸门:返回每毫秒多少次 */
function throughput(label: string, count: number, minPerMs: number, work: () => void): number {
  const ms = timeMs(work)
  const perMs = count / ms
  console.log(`  ${label.padEnd(28, ' ')} ${count.toLocaleString()} 次 / ${ms} ms = ${perMs.toFixed(1)} 次/ms`)
  expect(perMs).toBeGreaterThan(minPerMs)
  return perMs
}

describe('规模实验 —— 批量模拟的吞吐', () => {
  it('掉落:十万次掷表', () => {
    const table = createDropTable([
      { key: 'page', chance: 0.12, count: [1, 2] as const },
      { key: 'mat', chance: 0.5, count: [1, 3] as const },
      { key: 'gear', chance: 0.3, chanceCap: 0.9, count: 1 }
    ])
    const RUNS = 100_000
    const rng = createRng('吞吐-掉落')
    let items = 0
    const perMs = throughput('掉落表', RUNS, 50, () => {
      for (let i = 0; i < RUNS; i += 1) items += table.roll(rng).reduce((sum, hit) => sum + hit.count, 0)
    })
    // 十万次里确实掉出了东西(否则测的是"空转有多快")
    expect(items).toBeGreaterThan(0)
    console.log(`    → 一次全服模拟(100 万次掉落)约 ${((1_000_000 / perMs) / 1000).toFixed(1)} 秒`)
  })

  it('战斗:一万场同配置对打', () => {
    const engine = createCombatEngine({ variance: 0.08 })
    const unit = (id: string) => ({
      id,
      name: id,
      stats: { hp: 600, maxHp: 600, attack: 60, defense: 30, speed: 1 },
      mods: { critRate: 0.15 },
      skills: [{ name: '连击', mult: 1.3, rate: 0.3 }]
    })
    const BATTLES = 10_000
    let rounds = 0
    const perMs = throughput('战斗解算', BATTLES, 2, () => {
      for (let i = 0; i < BATTLES; i += 1) rounds += engine.resolve(unit('我'), unit('对手'), createRng(i)).rounds
    })
    // 每场都在打(回合数之和远大于场数)
    expect(rounds).toBeGreaterThan(BATTLES)
    console.log(`    → 一万场共 ${rounds.toLocaleString()} 回合,约 ${((10_000 / perMs) / 1000).toFixed(1)} 秒`)
  })

  it('离线:一百万步的时长账', () => {
    const STEPS = 1_000_000
    const plan = planIdle(STEPS * 1000, { stepMs: 1000, capMs: STEPS * 1000, efficiency: 1 })
    expect(plan.steps).toBe(STEPS)
    // 每一步做一点真活(产线零头那套算术),免得测成"空循环有多快"
    let frac = 0
    const perMs = throughput('离线折叠', STEPS, 20, () => {
      frac = runIdle(plan, 0, (sum: number) => (sum + 1.6 * (1000 / 3_600_000)) % 1)
    })
    // 一百万步 × 每秒 1.6 件:发不出的零头就是进度(与 facilities 那份消融同一套算术)
    expect(frac).toBeGreaterThan(0)
    expect(frac).toBeLessThan(1)
    console.log(`    → 一百万个 1 秒步约 ${(STEPS / perMs / 1000).toFixed(1)} 秒`)
  })

  it('存档:一万次编解码往返', () => {
    interface State {
      gold: number
      bag: string[]
    }
    const format = defineSaveFormat<State>({
      currentVersion: 2,
      migrations: { 1: d => ({ ...(d as object), bag: [] }) },
      revive: d => ({
        gold: asFiniteNumber((d as { gold?: unknown }).gold, 0, 0),
        bag: Array.isArray((d as { bag?: unknown }).bag) ? ((d as { bag: unknown[] }).bag.filter(x => typeof x === 'string') as string[]) : []
      })
    })
    const state: State = { gold: 1234, bag: Array.from({ length: 20 }, (_, i) => `item-${i}`) }
    const ROUNDS = 10_000
    let ok = 0
    const perMs = throughput('存档编解码', ROUNDS, 20, () => {
      for (let i = 0; i < ROUNDS; i += 1) {
        const text = encodeSave(state, format, i)
        const back = decodeSave(text, format)
        if (back.ok && back.state.gold === state.gold && back.state.bag.length === state.bag.length) ok += 1
      }
    })
    expect(ok).toBe(ROUNDS) // 每一圈都真的往返成功了
    console.log(`    → 十万个档约 ${((100_000 / perMs) / 1000).toFixed(1)} 秒`)
  })

  it('属性:十万次带装备的结算', () => {
    const attrs = createAttributeSystem({ defs: attributeDefs({ rename: { attack: '术法' } }) })
    const base = { attack: 120, defense: 60, maxHp: 900 }
    const sources = [
      { attackPct: 0.12, critRate: 0.05 },
      { attackPct: 0.08, maxHpPct: 0.15 },
      { defensePct: 0.1, critDamage: 0.2 }
    ]
    const RUNS = 100_000
    let hp = 0
    const perMs = throughput('属性结算', RUNS, 20, () => {
      for (let i = 0; i < RUNS; i += 1) hp += Number(attrs.compute({ base, flat: { attack: 20, maxHp: 100 }, modSources: sources }).final.maxHp)
    })
    expect(hp).toBeGreaterThan(0)
    console.log(`    → 一次全服面板刷新(10 万个单位)约 ${((100_000 / perMs) / 1000).toFixed(2)} 秒`)
  })
})
