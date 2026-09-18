/**
 * 每日任务对库的接入 —— 内容(`data/quests` 的 `DAILY_TASKS`)与文案仍住在本作,
 * 库只给"按计数增量推进的周期任务板"。
 *
 * 换算只在这一处:store 里的 `daily`(`date` / `base` / `done`)与库的 `TaskBoardState`
 * (`period` / `base` / `claimed`)是同一份账,只是键名不同 —— 换名要动老档,不值当。
 *
 * 进度口径:本期增量 = 当前计数 − **换期那一刻的基准**。计数器不清零,因为它同时喂生涯成就
 * (「累计击败 1000 个敌人」);换期幂等也由库保证(心跳每次都问"该换期了吗")。
 */
import type { CounterKey } from '@/types'
import type { SettleResult, TaskBoardState } from 'wanxiang-engine'
import { createTaskBoard } from 'wanxiang-engine'
import type { DailyTaskDef } from '@/data/quests'
import { DAILY_TASKS } from '@/data/quests'

/** 存档里的每日账(键名保持原样) */
export interface StoredDaily {
  date: string
  base: Partial<Record<CounterKey, number>>
  done: string[]
}

const DAILY_BOARD = createTaskBoard({
  tasks: DAILY_TASKS.map(t => ({ id: t.id, name: t.name, counter: t.counterKey, target: t.target }))
})

const DEF_BY_ID = new Map(DAILY_TASKS.map(t => [t.id, t]))

/** 存档形状 → 库的状态 */
export function dailyStateOf(daily: StoredDaily): TaskBoardState {
  return { period: daily.date, base: daily.base as Record<string, number>, claimed: daily.done }
}

/** 库的状态 → 存档形状 */
export function dailyShapeOf(state: TaskBoardState): StoredDaily {
  return { date: state.period, base: state.base as Partial<Record<CounterKey, number>>, done: [...state.claimed] }
}

/** 换期(幂等):把那一刻的计数器记成本期基准,并清空本期领取记录 */
export function rolloverDailyBoard(
  state: TaskBoardState,
  counters: Partial<Record<CounterKey, number>>,
  period: string
): TaskBoardState {
  return DAILY_BOARD.rollover(state, counters as Record<string, number>, period)
}

/** 自动结算:挑出"达成且本期没领过"的(顺序即 DAILY_TASKS 顺序) */
export function settleDailies(
  state: TaskBoardState,
  counters: Partial<Record<CounterKey, number>>
): SettleResult {
  return DAILY_BOARD.settle(state, counters as Record<string, number>)
}

/** 一份任务的定义(发赏要按 id 找回报酬与文案) */
export function dailyTaskDef(id: string): DailyTaskDef | undefined {
  return DEF_BY_ID.get(id)
}

/** 首页那几行日课:内容 + 本期进度(与发赏判定同源) */
export function dailyRowsOf(
  state: TaskBoardState,
  counters: Partial<Record<CounterKey, number>>
): (DailyTaskDef & { progress: number; done: boolean })[] {
  const rows: (DailyTaskDef & { progress: number; done: boolean })[] = []
  for (const row of DAILY_BOARD.board(state, counters as Record<string, number>)) {
    const def = DEF_BY_ID.get(row.task.id)
    if (def) rows.push({ ...def, progress: row.progress, done: row.claimed })
  }
  return rows
}
