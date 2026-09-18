/**
 * 每日任务对账 —— "按计数增量结算"搬进库之后,结算结果、顺序与读数一位不差。
 *
 * 与 engineParity 同一条纪律:`legacy*` 是**迁移前那段实现的原样冻结**
 * (`core/progress.checkDaily` 的逐条判定 + `stores/quests.rolloverDaily` 的换期),
 * 与 `core/engineDailies` 用同一组计数与同一份每日账各跑一遍,比三件事:
 *   ① 结算出哪几条、按什么顺序(发赏顺序与战报顺序);② 结算后的每日账(`done` 列表);
 *   ③ 首页那几行的进度读数(进度 = 今日增量,封在目标值)。
 *
 * 另把两条口径钉住(它们是这次搬迁的**理由**,不是副产品):
 *   · **计数器不清零**:进度靠"当前 − 期初基准",生涯成就照样算(清零会把生涯成就一起抹掉);
 *   · **换期幂等**(这次顺带加固):同一期再叫一次不会把当天已攒的进度清掉 ——
 *     迁移前的换期是无条件重设基准,直接调用就会吞进度(现在的调用方有心跳前的日期判断,
 *     所以线上没露出来,但那是运气)。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { CounterKey } from '@/types'
import { DAILY_TASKS } from '@/data/quests'
import { rolloverDailyIfNeeded, track } from './progress'
import { dailyRowsOf, dailyShapeOf, dailyStateOf, dailyTaskDef, rolloverDailyBoard, settleDailies } from './engineDailies'
import { useQuestsStore } from '@/stores/quests'
import { useResourcesStore } from '@/stores/resources'
import { todayStr } from '@/utils/time'

type Counters = Partial<Record<CounterKey, number>>
type Daily = { date: string; base: Counters; done: string[] }

/** 迁移前的结算(冻结):逐条判定"今日增量够不够",够就记下并跳过已领过的 */
function legacySettle(dailyIn: Daily, counters: Counters): { daily: Daily; settled: string[] } {
  let daily: Daily = { ...dailyIn, done: [...dailyIn.done] }
  const settled: string[] = []
  for (const task of DAILY_TASKS) {
    if (daily.done.includes(task.id)) continue
    const delta = (counters[task.counterKey] ?? 0) - (daily.base[task.counterKey] ?? 0)
    if (delta >= task.target) {
      daily = { ...daily, done: [...daily.done, task.id] }
      settled.push(task.id)
    }
  }
  return { daily, settled }
}

/** 迁移前的换期(冻结,无条件重设基准) */
function legacyRollover(period: string, counters: Counters): Daily {
  return { date: period, base: { ...counters }, done: [] }
}

/** 迁移前首页那几行的读数(冻结) */
function legacyRows(daily: Daily, counters: Counters): { id: string; progress: number; done: boolean }[] {
  return DAILY_TASKS.map(t => ({
    id: t.id,
    progress: Math.min(t.target, (counters[t.counterKey] ?? 0) - (daily.base[t.counterKey] ?? 0)),
    done: daily.done.includes(t.id)
  }))
}

const days: [string, Daily, Counters][] = [
  ['今天什么都没做', { date: '2026-09-19', base: { kills: 100 }, done: [] }, { kills: 100 }],
  ['差一个就够', { date: '2026-09-19', base: { kills: 100 }, done: [] }, { kills: 114 }],
  ['刚好够一条', { date: '2026-09-19', base: { kills: 100 }, done: [] }, { kills: 115 }],
  ['三条一起够', { date: '2026-09-19', base: { kills: 100 }, done: [] }, { kills: 130, pillsUsed: 3, explores: 2 }],
  ['其中一条已经领过', { date: '2026-09-19', base: { kills: 100 }, done: ['d_kill'] }, { kills: 130, explores: 1 }],
  ['今天已经全领过', { date: '2026-09-19', base: {}, done: DAILY_TASKS.map(t => t.id) }, { kills: 999 }],
  ['计数器倒挂(回档)', { date: '2026-09-19', base: { kills: 500, explores: 3 }, done: [] }, { kills: 20, explores: 1 }]
]

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('每日任务对账 —— 结算出哪几条、按什么顺序', () => {
  for (const [label, daily, counters] of days) {
    it(`${label}:与冻结口径一致`, () => {
      const frozen = legacySettle(daily, counters)
      const mine = settleDailies(dailyStateOf(daily), counters)
      expect(mine.settled.map(row => row.task.id), label).toEqual(frozen.settled)
      expect(dailyShapeOf(mine.state), label).toEqual(frozen.daily)
    })
  }

  it('首页那几行的读数同源:进度 = 今日增量(封在目标),done = 本期已结算', () => {
    // 计数器倒挂那一档单独看:迁移前会算出负进度,现在夹到 0(见下一条)
    for (const [label, daily, counters] of days.filter(([, , c]) => (c.kills ?? 0) >= 100)) {
      const mine = dailyRowsOf(dailyStateOf(daily), counters)
      expect(
        mine.map(row => ({ id: row.id, progress: row.progress, done: row.done })),
        label
      ).toEqual(legacyRows(daily, counters))
    }
  })

  it('增量夹到 ≥ 0(有意修正):回档那天,进度显示成 0 而不是负数', () => {
    const daily = { date: '2026-09-19', base: { kills: 500, explores: 3 }, done: [] }
    const counters: Counters = { kills: 20, explores: 1 }
    expect(legacyRows(daily, counters).map(r => r.progress)).toContain(-480) // 迁移前:负进度
    expect(dailyRowsOf(dailyStateOf(daily), counters).map(r => r.progress)).toEqual([0, 0, 0])
  })

  it('计数器不清零:结算只动每日账,生涯计数原样留着', () => {
    const counters: Counters = { kills: 5000, explores: 1 }
    const daily = { date: '2026-09-19', base: { kills: 4980, explores: 0 }, done: [] }
    const mine = settleDailies(dailyStateOf(daily), counters)
    expect(mine.settled.map(row => row.task.id)).toEqual(['d_kill', 'd_explore'])
    expect(counters).toEqual({ kills: 5000, explores: 1 }) // 入参不动,更没有"清零"这回事
  })

  it('走一遍真路径:track 触发结算 → 日课记账 + 奖励到账', () => {
    const quests = useQuestsStore()
    const resources = useResourcesStore()
    quests.rolloverDaily('2026-09-19')
    const before = resources.herb
    track('pillsUsed', 1) // 每日服药:今日 1 枚
    expect(quests.daily.done).toContain('d_pill')
    expect(resources.herb - before).toBe(8)
    // 再记一次同一个计数:已经领过,不重复发
    track('pillsUsed', 1)
    expect(quests.daily.done.filter(id => id === 'd_pill').length).toBe(1)
    expect(resources.herb - before).toBe(8)
  })

  it('走一遍真路径:全部达标的那一次,结算顺序就是 DAILY_TASKS 的顺序', () => {
    const quests = useQuestsStore()
    quests.rolloverDaily('2026-09-19')
    track('kills', 15)
    track('pillsUsed', 1)
    track('explores', 1)
    const frozen = legacySettle({ date: '2026-09-19', base: {}, done: [] }, { kills: 15, pillsUsed: 1, explores: 1 })
    expect(quests.daily.done).toEqual(frozen.daily.done)
    expect(quests.daily.done).toEqual(DAILY_TASKS.map(t => t.id))
  })
})

describe('换期对账 —— 打基准快照,而不是清零', () => {
  it('换期:把那一刻的计数器记成本期基准(done 清空)', () => {
    const counters: Counters = { kills: 500, explores: 12 }
    const frozen = legacyRollover('2026-09-20', counters)
    const mine = rolloverDailyBoard(dailyStateOf({ date: '2026-09-19', base: { kills: 100 }, done: ['d_kill'] }), counters, '2026-09-20')
    expect(dailyShapeOf(mine)).toEqual(frozen)
    // 计数器自己一位没动
    expect(counters).toEqual({ kills: 500, explores: 12 })
  })

  it('换期幂等(顺带加固):同期再叫一次,当天已攒的进度不会被吞', () => {
    const counters: Counters = { kills: 500, explores: 12 }
    const rolled = rolloverDailyBoard(dailyStateOf({ date: '', base: {}, done: [] }), counters, '2026-09-19')
    // 当天又打了 30 只:再调一次"该换期了吗"不该把基准挪到 530
    const again = rolloverDailyBoard(rolled, { kills: 530, explores: 12 }, '2026-09-19')
    expect(again).toBe(rolled)
    expect(dailyShapeOf(again).base.kills).toBe(500)
    // 迁移前的写法会在这里重设基准 —— 那正是"白天打了一半、晚上再开就归零"的来源
    expect(legacyRollover('2026-09-19', { kills: 530, explores: 12 }).base.kills).toBe(530)
  })

  it('走一遍真路径:rolloverDailyIfNeeded 只在日期变了的时候换期', () => {
    const quests = useQuestsStore()
    quests.rolloverDaily(todayStr()) // 按真实本地日打基准,心跳才不会换期
    track('kills', 5)
    const base = { ...quests.daily.base }
    // 同一天再叫多少次,基准都不许动
    rolloverDailyIfNeeded()
    rolloverDailyIfNeeded()
    expect(quests.daily.base).toEqual(base)
    expect(quests.daily.done).toEqual([])
  })
})

describe('内容表没被搬迁动过', () => {
  it('三条日课仍然认得出来,counter/target 与库里的任务一一对应', () => {
    for (const def of DAILY_TASKS) {
      expect(dailyTaskDef(def.id)).toBe(def)
    }
    expect(DAILY_TASKS.length).toBeGreaterThanOrEqual(3)
  })
})
