/* eslint-disable no-console */
/**
 * 消融实验 —— 每日任务的目标值该定在哪,以及"换期"到底换掉了什么。
 *
 * `tasks.spec.ts` 钉的是语义(进度靠当前 − 期初基准、换期幂等、一期只结算一次、增量不为负);
 * 这一份量的是**内容作者最容易拍脑袋的那件事**:目标值定多少。做法是先写两张玩家画像
 * (活跃 / 休闲),再扫一遍目标值,看两边各自的达成率。
 *
 * 三条量出来的结论:
 *   ① **目标要按"休闲画像"定,不是按活跃画像**:活跃一天打 40 场、休闲只打 15 场 ——
 *      目标定 20 时活跃必达、休闲**永远完不成**;要两边都能拿到,目标得压在休闲画像的六成上下;
 *   ② **跨期不累积是设计,不是 bug**:期初打 40 场,今天只打 3 场,今天的进度就是 3 ——
 *      "存量不算数"这条由基准快照保证(也正因为如此,计数器不用清零);
 *   ③ **换期与结算各自幂等**:同一期再调一次 `rollover` 原样返回(心跳每次都问),
 *      已结算的任务再 `settle` 不会重复发 —— 两条路(自动结算 / 手动领取)共用同一份 `claimed`。
 */
import { describe, expect, it } from 'vitest'
import { createTaskBoard } from './tasks.js'

interface Persona {
  name: string
  /** 一天里各计数器的自然增量 */
  daily: Record<string, number>
}

/** 两张画像:一个是"每天泡着"的人,一个是"上线十几分钟"的人 */
const PERSONAS: Persona[] = [
  { name: '活跃(一天 40 场)', daily: { fights: 40, pickups: 60, spent: 50 } },
  { name: '休闲(一天 15 场)', daily: { fights: 15, pickups: 20, spent: 15 } }
]

/** 三条典型的每日任务:都挂在"打了几场"这个计数器上,只有目标不同 */
const boardOf = (fights: number) =>
  createTaskBoard({ tasks: [{ id: 'daily', name: `今日打 ${fights} 场`, counter: 'fights', target: fights }] })

/** 从零开始跑一天:返回这条任务今天是否达成 */
function clearsToday(target: number, persona: Persona): boolean {
  const board = boardOf(target)
  const counters = { ...persona.daily }
  const state = board.rollover({ period: 'D1', base: {}, claimed: [] }, {}, 'D1')
  return board.progressOf(state, counters, 'daily')!.done
}

describe('消融实验 —— 每日任务的目标值定在哪', () => {
  it('目标按"休闲画像"定:压在它六成上下,两边才都拿得到', () => {
    const targets = [5, 10, 15, 20, 30, 40]
    console.log('  目标 → 活跃玩家达成 / 休闲玩家达成')
    for (const target of targets) {
      const active = clearsToday(target, PERSONAS[0]!)
      const casual = clearsToday(target, PERSONAS[1]!)
      console.log(`  打 ${String(target).padStart(2, ' ')} 场 → ${active ? '达成' : '完不成'} / ${casual ? '达成' : '完不成'}`)
    }

    // ① 目标 20:活跃必达,休闲永远完不成(它一天只打 15 场)
    expect(clearsToday(20, PERSONAS[0]!)).toBe(true)
    expect(clearsToday(20, PERSONAS[1]!)).toBe(false)
    // 压在休闲画像的六成上下(15 × 0.6 = 9)→ 两边都能完成,且休闲还有余量
    expect(clearsToday(9, PERSONAS[0]!)).toBe(true)
    expect(clearsToday(9, PERSONAS[1]!)).toBe(true)
    // 休闲画像的"余量"就是安全垫:目标 9 时它一天能多做六成
    const casualDelta = PERSONAS[1]!.daily['fights']! / 9
    console.log(`  目标 9 场时,休闲玩家一天的余量是 ${casualDelta.toFixed(1)} 倍(留出了"今天没空"的余地)`)
    expect(casualDelta).toBeGreaterThan(1.5)
    // 防空转:目标定到活跃画像的量上,休闲画像就是 0 达成率 —— 这不是"差一点",是必失
    expect(clearsToday(40, PERSONAS[1]!)).toBe(false)
    expect(clearsToday(40, PERSONAS[0]!)).toBe(true)
  })

  it('跨期不累积:期初打 40 场,今天只打 3 场,今天的进度就是 3', () => {
    const board = boardOf(10)
    const baseCounters = { fights: 40, pickups: 60, spent: 50 }
    // 换期那一刻的计数被记成本期基准:存量 40 场不算今天的
    const state = board.rollover({ period: 'D1', base: {}, claimed: [] }, baseCounters, 'D2')
    const today = { fights: 43, pickups: 60, spent: 50 }
    const row = board.progressOf(state, today, 'daily')!
    console.log(`  期初 40 场 → 今天 43 场:进度 ${row.progress}/10(${row.done ? '已达' : '未达'})`)

    // ② 进度只认"本期增量":3 场,不是 43 场
    expect(row.delta).toBe(3)
    expect(row.progress).toBe(3)
    expect(row.done).toBe(false)
    // 而"存量"确实还在计数器里(所以生涯成就照样算得出来)
    expect(today.fights).toBe(43)
    // 防空转:再多打 7 场就达了(说明差的确实是那 10,而不是"永远差 40")
    expect(board.progressOf(state, { ...today, fights: 50 }, 'daily')!.done).toBe(true)
  })

  it('换期与结算各自幂等:同一期再问一次原样返回,结算过的不重复发', () => {
    const board = boardOf(3)
    const before = { fights: 0, pickups: 0, spent: 0 }
    const counters = { fights: 5, pickups: 0, spent: 0 }
    // 换期时记的是**那一刻**的计数(此刻还是 0),之后玩家又打了 5 场
    const first = board.rollover({ period: 'D1', base: {}, claimed: [] }, before, 'D2')
    const again = board.rollover(first, counters, 'D2')
    console.log(`  同期再调一次 rollover:${again === first ? '原样返回(同一个对象)' : '又换了一次期(错)'}`)

    // ③ 换期幂等:心跳每次都会问一句"该换期了吗",不能每次都换
    expect(again).toBe(first)
    // 新一期再换:基准与领取记录都重置,但期号变了
    const nextPeriod = board.rollover(first, counters, 'D3')
    expect(nextPeriod.period).toBe('D3')
    expect(nextPeriod.claimed).toEqual([])
    // 结算幂等:一次只结算一次
    const settled = board.settle(first, counters)
    expect(settled.settled.length).toBe(1)
    const twice = board.settle(settled.state, counters)
    expect(twice.settled.length).toBe(0)
    // 手动领取与自动结算共用同一份 claimed:settle 过再 claim 会被挡住
    const claim = board.claim(settled.state, counters, 'daily')
    expect(claim.ok).toBe(false)
    expect(claim.reason).toBe('claimed')
    console.log(`  自动结算之后再手动领取:${claim.ok ? '又发了一次(错)' : `被挡住(${claim.reason})`}`)
  })

  it('进度不会倒退成负数:计数器被别的逻辑改小也不给负进度', () => {
    const board = boardOf(10)
    const state = board.rollover({ period: 'D1', base: {}, claimed: [] }, { fights: 20 }, 'D2')
    // 内容侧若把计数器清零(旧写法),基准还在 20 → 裸减法会得到 −20
    const row = board.progressOf(state, { fights: 0 }, 'daily')!
    console.log(`  期初 20 场、计数器被清零:进度 ${row.progress}/10(不是负数)`)

    expect(row.delta).toBe(0)
    expect(row.progress).toBe(0)
    // 防空转:基准确实记着 20(否则"夹到 0"可能只是碰巧)
    expect(state.base['fights']).toBe(20)
    // 再涨回 25 时,进度只算超过基准的那 5
    expect(board.progressOf(state, { fights: 25 }, 'daily')!.delta).toBe(5)
  })
})
