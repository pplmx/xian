/**
 * 周期任务板(每日 / 每周 / 赛季 / 打卡)—— "本期干到多少算完成,这一期还能不能再领"。
 *
 * 它靠**计数器增量**推进(kills / explores / 学习时长……),而这里有三处是真踩过坑的:
 *
 *   一 **进度是"当前 − 期初基准",不是"把计数器清零"**:计数器往往还要喂生涯成就
 *      (「累计击败 1000 个敌人」)—— 换期时清零,生涯成就也跟着被抹掉;
 *      正确做法是换期那一刻给计数器打个**基准快照**,本期进度 = 当前 − 基准;
 *   二 **换期必须幂等**:引擎每一次心跳都可能调用"该换期了吗"。若无条件重设基准,
 *      玩家在同一天里第二次触发就**把当天已经攒下的进度清掉了**(看起来像素的 bug:
 *      白天打了一半,晚上再开游戏,进度归零)。故同一期重复调用必须原样返回;
 *   三 **增量夹到 ≥ 0**:回档、坏档、跨期倒挂都可能让"当前 < 基准",负进度不该出现
 *      (它会让进度条显示成负数,也让"够不够"的判定变成永远为真)。
 *
 * 另两条口径:`claimed` 保证**一期一次**(自动发放与手动领取共用同一份记录,不会重复给);
 * 结算顺序即声明顺序(一连完成三条任务时,战报与奖励的顺序稳定)。
 */

export interface TaskSpec {
  id: string
  /** 展示名(可省) */
  name?: string
  /** 看哪个计数器(库不认识键的含义) */
  counter: string
  /** 干到多少算完成 */
  target: number
}

export interface TaskBoardState {
  /** 当前是哪一期(日期 / 周号 / 赛季号,由调用方给 —— 库不解释它怎么来的) */
  period: string
  /** 本期起点:各计数器在换期那一刻的值 */
  base: Record<string, number>
  /** 本期已经结算 / 领取过的任务 */
  claimed: readonly string[]
}

export interface TaskProgress {
  task: TaskSpec
  /** 本期增量(已夹到 ≥ 0) */
  delta: number
  /** 给界面看的进度(不超过目标) */
  progress: number
  /** 够不够 */
  done: boolean
  /** 本期是不是已经结算过 */
  claimed: boolean
}

export interface SettleResult {
  /** 结算后的状态(没有要结算的则原样返回) */
  state: TaskBoardState
  /** 这一次结算掉的任务(顺序即声明顺序) */
  settled: TaskProgress[]
}

export interface ClaimOutcome {
  ok: boolean
  /** 没领成的原因(结构化:由作品决定怎么说给人听) */
  reason: 'unknown' | 'claimed' | 'unfinished' | null
  task: TaskSpec | null
  state: TaskBoardState
}

export function createTaskBoard(config: { tasks: readonly TaskSpec[] }) {
  const byId = new Map<string, TaskSpec>()
  for (const task of config.tasks) byId.set(task.id, task)

  const taskOf = (id: string): TaskSpec | undefined => byId.get(id)

  /**
   * 换期:把**换期那一刻的计数器**记成本期基准,并清空本期的领取记录。
   * 已经是这一期就原样返回(幂等 —— 心跳每次都会问一句"该换期了吗")。
   */
  const rollover = (
    state: TaskBoardState,
    counters: Readonly<Record<string, number>>,
    period: string
  ): TaskBoardState => {
    if (state.period === period) return state
    return { period, base: { ...counters }, claimed: [] }
  }

  /** 本期增量:当前 − 期初基准,夹到 ≥ 0(缺基准按 0 起算) */
  const deltaOf = (state: TaskBoardState, counters: Readonly<Record<string, number>>, counter: string): number => {
    const now = counters[counter] ?? 0
    const base = state.base[counter] ?? 0
    return Number.isFinite(now - base) ? Math.max(0, now - base) : 0
  }

  /** 一条任务本期的进度读数(界面直接用) */
  const progressOf = (state: TaskBoardState, counters: Readonly<Record<string, number>>, id: string): TaskProgress | null => {
    const task = taskOf(id)
    if (!task) return null
    const delta = deltaOf(state, counters, task.counter)
    return {
      task,
      delta,
      progress: Math.min(task.target, delta),
      done: delta >= task.target,
      claimed: state.claimed.includes(task.id)
    }
  }

  /** 整块任务板(顺序即声明顺序) */
  const board = (state: TaskBoardState, counters: Readonly<Record<string, number>>): TaskProgress[] => {
    const out: TaskProgress[] = []
    for (const task of config.tasks) {
      const row = progressOf(state, counters, task.id)
      if (row) out.push(row)
    }
    return out
  }

  /**
   * 自动结算:把"已达成且本期还没结算过"的一次性挑出来(顺序即声明顺序),
   * 并把它们记进 `claimed`。发奖是调用方的事 —— 库只管"发过没有"。
   */
  const settle = (state: TaskBoardState, counters: Readonly<Record<string, number>>): SettleResult => {
    const settled = board(state, counters).filter(row => row.done && !row.claimed)
    if (settled.length === 0) return { state, settled: [] }
    return { state: { ...state, claimed: [...state.claimed, ...settled.map(row => row.task.id)] }, settled }
  }

  /**
   * 手动领取(有些作品是玩家自己点):与自动结算共用同一份 `claimed`,
   * 两条路一起用也不会重复给。
   */
  const claim = (state: TaskBoardState, counters: Readonly<Record<string, number>>, id: string): ClaimOutcome => {
    const row = progressOf(state, counters, id)
    if (!row) return { ok: false, reason: 'unknown', task: null, state }
    if (row.claimed) return { ok: false, reason: 'claimed', task: row.task, state }
    if (!row.done) return { ok: false, reason: 'unfinished', task: row.task, state }
    return { ok: true, reason: null, task: row.task, state: { ...state, claimed: [...state.claimed, id] } }
  }

  return { tasks: config.tasks, taskOf, rollover, deltaOf, progressOf, board, settle, claim }
}

export type TaskBoard = ReturnType<typeof createTaskBoard>
