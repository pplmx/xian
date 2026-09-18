/**
 * 投资点(天赋 / 科技 / 属性点 / 灵脉)—— "这点数往哪儿投,投了还能不能回头"。
 *
 * 加点系统看着就是"点数够就 +1",但真正决定玩法手感的是四条结构规则,而它们都踩过坑:
 *
 *   一 **总容量与分支上限是两把尺子**:总容量让"方向"有意义(投满就没了,别的方向进不去),
 *      分支上限让"主位"比"副位"更深。两把尺子取小,顺序也要说清 —— 先报"容量已尽"还是
 *      先报"这条到顶了",玩家看到的是两句不同的话;
 *   二 **主位是可换的,但换位不作废已投点数**:换向有代价,可代价是钱,不是把玩家投过的
 *      点数扣掉。落在主位的点数超过副位上限时,**只封住"再投"**,已经有的照旧生效 ——
 *      反过来做(读的时候按上限截断)就等于悄悄没收了玩家的投入;
 *   三 **"没投成"不该改变任何东西**:门槛没过、容量满了、钱不够,状态必须原地不动。
 *      尤其是"首次投点自动认主"这条便利规则:它只能在**投成功**的那一次生效,
 *      否则玩家点了却没钱,主位却被悄悄定在了他没投成的那条路上;
 *   四 **每条分支的效果是"点数 → 效果"的函数**:有的每点累加,有的到某点才有第二档
 *      (库不解释,原样带出给作品自己的属性汇总)。
 *
 * 门槛、费用与效果都由内容给;库只给上面四条顺序与边界。
 */

/** 一条花费(键名由内容定:灵石 / 科技点 / 零花钱……) */
export interface PointCost<A = number> {
  key: string
  amount: A
}

export interface PointBranch<M = unknown> {
  id: string
  /** 展示名(可省) */
  name?: string
  /** 立为主位时能投多少点(默认用配置里的 `mainCap`) */
  mainCap?: number
  /** 在副位时能投多少点(默认用配置里的 `sideCap`) */
  sideCap?: number
  /** 投到 `points` 点时的效果(库不解释,原样带出) */
  effect?: (points: number) => M
}

export interface PointState {
  /** 各分支已投点数(没记过 = 0) */
  points: Record<string, number>
  /** 主位是哪一条(null = 还没定,首次**投成功**时自动认) */
  main: string | null
}

export interface PointsConfig<M = unknown, Ctx = unknown, A = number> {
  branches: readonly PointBranch<M>[]
  /** 总容量:所有分支加起来的点数上限(方向即取舍的来源) */
  total: number
  /** 主位能投多少点(单条分支可覆盖) */
  mainCap: number
  /** 副位能投多少点(单条分支可覆盖) */
  sideCap: number
  /** 容量投满时的说法(界面直接用) */
  fullReason?: string
  /** 主位投满时的说法 */
  mainCapReason?: string
  /** 副位投满时的说法 */
  sideCapReason?: string
  /**
   * 其他门槛:不行就返回**一句给人看的原因**;返回 `''` 表示"不说理由"
   * (有些门槛不适合打扰玩家 —— 比如整块玩法还没开放,界面本来就不显示)。
   */
  blocked?: (state: PointState, id: string, ctx: Ctx) => string | undefined
  /** 投一点要花什么 */
  costs?: (state: PointState, id: string, ctx: Ctx) => readonly PointCost<A>[]
  /** 换主位要花什么 */
  switchCosts?: (state: PointState, id: string, ctx: Ctx) => readonly PointCost<A>[]
}

export interface InvestInfo<A = number> {
  can: boolean
  /** 不行时给人看的原因(能投时为 '') */
  reason: string
  /** 这一条现在几点 */
  points: number
  /** 这一条现在的上限(在主位是 `mainCap`,在副位是 `sideCap`) */
  cap: number
  /** 投这一点要花什么(不能投时也给出来 —— 界面常常要显示"差在哪") */
  costs: readonly PointCost<A>[]
}

/** 投一次的结果:`state` 在成功时是新状态,失败时**原样返回** */
export interface InvestOutcome<A = number> extends InvestInfo<A> {
  state: PointState
}

export interface SwitchInfo<A = number> {
  can: boolean
  reason: string
  costs: readonly PointCost<A>[]
}

/** 换主位的结果:已投点数一条都不动,只有 `main` 变 */
export interface SwitchOutcome<A = number> extends SwitchInfo<A> {
  state: PointState
}

export function createPointPool<M = unknown, Ctx = unknown, A = number>(config: PointsConfig<M, Ctx, A>) {
  const byId = new Map<string, PointBranch<M>>()
  for (const branch of config.branches) byId.set(branch.id, branch)

  const branchOf = (id: string): PointBranch<M> | undefined => byId.get(id)

  /** 这一条投了几点(坏值当 0) */
  const pointsOf = (state: PointState, id: string): number => {
    const raw = state.points[id]
    return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  }

  /**
   * 一共投了几点。**按账上所有键算**(包括不再认识的那些)—— 过期数据也跟着占容量,
   * 不然"容量"会随一次内容改名凭空变大。
   */
  const totalOf = (state: PointState): number => {
    let sum = 0
    for (const value of Object.values(state.points)) if (Number.isFinite(value) && value > 0) sum += Math.floor(value)
    return sum
  }

  /** 这一条现在的上限:在主位按主位上限度量,否则按副位上限 */
  const capOf = (state: PointState, id: string): number => {
    const branch = branchOf(id)
    if (!branch) return 0
    return state.main === id ? (branch.mainCap ?? config.mainCap) : (branch.sideCap ?? config.sideCap)
  }

  /** 还能投几点(总容量口径) */
  const remaining = (state: PointState): number => Math.max(0, config.total - totalOf(state))

  /**
   * 投一点的判定。顺序:内容门槛 → 总容量 → 这一条的上限。
   * (顺序即界面的说法:先报"门槛没过"还是先报"容量已尽",是玩家先看到哪句话。)
   */
  const investInfo = (state: PointState, id: string, ctx: Ctx): InvestInfo<A> => {
    const points = pointsOf(state, id)
    const cap = capOf(state, id)
    const costs = config.costs?.(state, id, ctx) ?? []
    const base = { points, cap, costs }
    if (!branchOf(id)) return { can: false, reason: '', ...base }
    const blocked = config.blocked?.(state, id, ctx)
    if (blocked !== undefined) return { can: false, reason: blocked, ...base }
    if (totalOf(state) >= config.total) return { can: false, reason: config.fullReason ?? '', ...base }
    if (points >= cap) {
      return { can: false, reason: (state.main === id ? config.mainCapReason : config.sideCapReason) ?? '', ...base }
    }
    return { can: true, reason: '', ...base }
  }

  /** 投一点:不成功就**什么都不改**(连"首次投点自动认主"都不认) */
  const invest = (state: PointState, id: string, ctx: Ctx): InvestOutcome<A> => {
    const info = investInfo(state, id, ctx)
    if (!info.can) return { ...info, state }
    return {
      ...info,
      state: { points: { ...state.points, [id]: info.points + 1 }, main: state.main ?? id }
    }
  }

  /** 换主位的判定:已经在主位 = 无事发生(不给说法,界面也别提示) */
  const switchInfo = (state: PointState, id: string, ctx: Ctx): SwitchInfo<A> => {
    const costs = config.switchCosts?.(state, id, ctx) ?? []
    if (!branchOf(id) || state.main === id) return { can: false, reason: '', costs }
    const blocked = config.blocked?.(state, id, ctx)
    if (blocked !== undefined) return { can: false, reason: blocked, costs }
    return { can: true, reason: '', costs }
  }

  /** 换主位:**只有 `main` 变**,已投点数一条都不动(超出副位上限的部分只是不能再投) */
  const switchMain = (state: PointState, id: string, ctx: Ctx): SwitchOutcome<A> => {
    const info = switchInfo(state, id, ctx)
    if (!info.can) return { ...info, state }
    return { ...info, state: { points: { ...state.points }, main: id } }
  }

  /** 各分支当下的效果(只有投过点的分支才出;顺序即声明顺序) */
  const effectsOf = (state: PointState): M[] => {
    const out: M[] = []
    for (const branch of config.branches) {
      const points = pointsOf(state, branch.id)
      if (points > 0 && branch.effect) out.push(branch.effect(points))
    }
    return out
  }

  return {
    branches: config.branches,
    total: config.total,
    branchOf,
    pointsOf,
    totalOf,
    capOf,
    remaining,
    investInfo,
    invest,
    switchInfo,
    switchMain,
    effectsOf
  }
}

export type PointPool<M = unknown, Ctx = unknown, A = number> = ReturnType<typeof createPointPool<M, Ctx, A>>
