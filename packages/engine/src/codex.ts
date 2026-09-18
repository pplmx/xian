/**
 * 图鉴 / 见闻 —— "见过什么、懂到什么程度"。
 *
 * 图鉴不只是"收没收录"两态。真实作品里的深度至少有三条路,而它们的**边界**很容易写歪:
 *
 *   一 **累计照面升档**(确定性):见过 N 次(或按权重累计)就跨入下一档。
 *      本作是敌人的"眼熟 → 知其路数 → 洞悉",败绩算三次(被打疼的记得最牢),
 *      而首领见一次不容易,故门槛另有一张表 —— 所以档位表要能**按条目分组**给;
 *   二 **按概率升档**:见得多不等于认得出。灵材就是每次照面掷一次(认得出来与否
 *      取决于品阶、技艺与照面次数),掷中才进一层 —— 概率由作品算,库只负责"掷一次、进了就进";
 *   三 **用过才算真懂**:另有一条更深的路,由玩家的行为(而非运气)推开。
 *
 * 推进是**不可逆**的:档位只增不减(玩家不会"忘了"见过什么),这条由库保证。
 * 另附"**只记见过的最好一件**":各维度**各取其高**(本作是品质与层级各记各的 ——
 * 15 阶天品与 20 阶良品谁更"好"要看用途),且与当前是否还持有无关(化了尘也是见过)。
 */
import type { Rng } from './rng.js'

export interface CodexStage {
  /** 档名(界面用) */
  name: string
  /** 累计到多少(含)跨入本档;第一档恒为 0 */
  at: number
}

export interface CodexState {
  /** 照面累计(权重和) */
  seen: Record<string, number>
  /** 当前档序号(0 = 第一档) */
  stage: Record<string, number>
  /** 见过的最好一件:各维度各记各的 */
  best: Record<string, Record<string, number>>
}

export interface CodexConfig {
  /** 默认档位表(按 `at` 升序;第一项 `at` 必须是 0) */
  stages: readonly CodexStage[]
  /** 分组换表(**可选**):本作给首领另配一张门槛更松的表 */
  stagesOf?: (id: string) => readonly CodexStage[] | undefined
}

export interface CodexView {
  seen: number
  stage: number
  name: string
  maxed: boolean
  /** 下一档的累计门槛(满了就没有) */
  nextAt?: number
  /** 还差多少(满了是 0) */
  remaining: number
  /** 距离下一档的进度(0~1;满了是 1) */
  ratio: number
}

export function createCodex(config: CodexConfig) {
  const stagesOf = (id: string): readonly CodexStage[] => config.stagesOf?.(id) ?? config.stages

  const create = (): CodexState => ({ seen: {}, stage: {}, best: {} })

  /** 照面累计:加权重(默认 1)。**不升档** —— 升档另有两条路,见下 */
  const markSeen = (state: CodexState, id: string, weight = 1): CodexState => ({
    ...state,
    seen: { ...state.seen, [id]: (state.seen[id] ?? 0) + weight }
  })

  /** 按累计阈值升档:够门槛就进一层(每次只进一层,要连跳得连续给够次数) */
  const observe = (
    state: CodexState,
    id: string,
    opts: { weight?: number } = {}
  ): { state: CodexState; advanced: boolean; stage: number; name: string } => {
    const stages = stagesOf(id)
    const marked = markSeen(state, id, opts.weight ?? 1)
    const cur = marked.stage[id] ?? 0
    const nextAt = stages[cur + 1]?.at
    if (nextAt === undefined || (marked.seen[id] ?? 0) < nextAt) {
      return { state: marked, advanced: false, stage: cur, name: stages[cur]?.name ?? '' }
    }
    const to = cur + 1
    return {
      state: { ...marked, stage: { ...marked.stage, [id]: to } },
      advanced: true,
      stage: to,
      name: stages[to]?.name ?? ''
    }
  }

  /**
   * 只看"当前累计够不够下一档",够就推进一层 —— **不记账、不掷概率**。
   *
   * 给"计数记在别处"的作品用(本作的照面次数存在 store 里,升档判定走这里),
   * 于是"计数"与"判定"两件事各归各处,不必为了用这一层把计数也搬进来。
   */
  const check = (state: CodexState, id: string): { state: CodexState; advanced: boolean; stage: number; name: string } => {
    const stages = stagesOf(id)
    const cur = state.stage[id] ?? 0
    const nextAt = stages[cur + 1]?.at
    if (nextAt === undefined || (state.seen[id] ?? 0) < nextAt) {
      return { state, advanced: false, stage: cur, name: stages[cur]?.name ?? '' }
    }
    const to = cur + 1
    return {
      state: { ...state, stage: { ...state.stage, [id]: to } },
      advanced: true,
      stage: to,
      name: stages[to]?.name ?? ''
    }
  }

  /**
   * 按概率升档:每次照面掷一次,`chanceOf` 由作品给(可以读累计次数 / 品阶 / 技艺)。
   * 掷中才进一层 —— 与累计阈值那条路互不干扰,作品选一条或两条都用。
   */
  const tryAdvance = (
    state: CodexState,
    id: string,
    rng: Rng,
    chanceOf: (seen: number, stage: number) => number
  ): { state: CodexState; advanced: boolean; stage: number; name: string } => {
    const stages = stagesOf(id)
    const cur = state.stage[id] ?? 0
    const seen = state.seen[id] ?? 0
    const maxed = cur >= stages.length - 1
    const hit = !maxed && rng.chance(Math.max(0, Math.min(1, chanceOf(seen, cur))))
    if (!hit) return { state, advanced: false, stage: cur, name: stages[cur]?.name ?? '' }
    const to = cur + 1
    return {
      state: { ...state, stage: { ...state.stage, [id]: to } },
      advanced: true,
      stage: to,
      name: stages[to]?.name ?? ''
    }
  }

  /**
   * 直接推到某档(或推到顶) —— "亲手用过"这类**由行为推开**的路走这里。
   * 不可逆:只增不减。
   */
  const advanceTo = (state: CodexState, id: string, to?: number): { state: CodexState; advanced: boolean; stage: number } => {
    const stages = stagesOf(id)
    const top = stages.length - 1
    const target = Math.max(0, Math.min(top, Math.floor(to ?? top)))
    const cur = state.stage[id] ?? 0
    if (target <= cur) return { state, advanced: false, stage: cur }
    return { state: { ...state, stage: { ...state.stage, [id]: target } }, advanced: true, stage: target }
  }

  /**
   * 见过的最好一件:各字段**取高**(本作是品质与层级各记各的,还有"用没用过"这一格)。
   * 只在真的有变化时才换新对象(界面据此判断要不要提示)。
   */
  const rememberBest = (
    state: CodexState,
    id: string,
    candidate: Record<string, number>
  ): { state: CodexState; improved: boolean } => {
    const prev = state.best[id]
    let improved = !prev
    const merged: Record<string, number> = { ...(prev ?? {}) }
    for (const [key, value] of Object.entries(candidate)) {
      const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
      if (next > (merged[key] ?? -1)) {
        merged[key] = next
        improved = true
      }
    }
    if (!improved) return { state, improved: false }
    return { state: { ...state, best: { ...state.best, [id]: merged } }, improved: true }
  }

  /** 单条目视图:还差多少到下一档(界面直接用) */
  const view = (state: CodexState, id: string): CodexView => {
    const stages = stagesOf(id)
    const stage = state.stage[id] ?? 0
    const seen = state.seen[id] ?? 0
    const next = stages[stage + 1]
    if (!next) {
      return { seen, stage, name: stages[stage]?.name ?? '', maxed: true, remaining: 0, ratio: 1 }
    }
    const from = stages[stage]?.at ?? 0
    const span = Math.max(1, next.at - from)
    return {
      seen,
      stage,
      name: stages[stage]?.name ?? '',
      maxed: false,
      nextAt: next.at,
      remaining: Math.max(0, next.at - seen),
      ratio: Math.max(0, Math.min(1, (seen - from) / span))
    }
  }

  /** 进度读数:已知几条 / 共几条、各档各有多少 */
  const stats = (
    state: CodexState,
    ids: readonly string[]
  ): { total: number; known: number; byStage: { name: string; count: number }[]; locked: string[] } => {
    const byStage = new Map<string, number>()
    const locked: string[] = []
    let known = 0
    for (const id of ids) {
      const stage = state.stage[id] ?? 0
      const name = stagesOf(id)[stage]?.name ?? ''
      if (stage >= 1) known += 1
      else locked.push(id)
      byStage.set(name, (byStage.get(name) ?? 0) + 1)
    }
    return {
      total: ids.length,
      known,
      byStage: [...byStage.entries()].map(([name, count]) => ({ name, count })),
      locked
    }
  }

  return { create, markSeen, check, observe, tryAdvance, advanceTo, rememberBest, view, stats, stagesOf }
}

export type CodexSystem = ReturnType<typeof createCodex>
