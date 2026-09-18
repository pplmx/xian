/**
 * 一次性解锁(成就 / 里程碑 / 勋章 / 教程节点)—— "达成过一次就永远算数"。
 *
 * 与周期任务板(`tasks.ts`)、顺序任务链(`chain.ts`)是一家人,区别只在**记多久**:
 * 任务板每隔一期就重来,任务链一路往前不回头,而这一层**一辈子只记一次**。
 * 四条口径:
 *
 *   一 **只登记一次**:重复解锁、重复扫描都不再发生 —— 玩家最恨的两件事是"同一枚成就
 *      跳了两次"和"奖励发了三遍";
 *   二 **一次扫描可以解锁多条,顺序即声明顺序**:一口气满足好几条是常事(一次大提升、
 *      一次离线回来),奖励与战报的顺序必须稳定,不然同一次结算每次看起来都不一样;
 *   三 **未达成的不登记**:扫描只认判据说的,不替内容猜;
 *   四 **显式解锁同样去重**:有些成就没有可判定的条件(寿元低到某个比例、身上恰好带着
 *      某件东西),只能由**当时发生的动作**声明 —— 而这类声明常常来自每拍都跑的检查,
 *      少了去重就会每拍发一次奖。
 *
 * 条件判据由内容给(库不认识境界、计数、物品)。
 */

export interface UnlockEntry {
  id: string
  /** 展示名(可省) */
  name?: string
}

export interface UnlockState {
  /** 已经解锁的条目(顺序即解锁顺序 —— 成就墙 / 履历按它排) */
  unlocked: readonly string[]
}

export interface UnlockOutcome {
  state: UnlockState
  /** 这一次**真的**解锁了吗(已经解开过就是 false) */
  unlocked: boolean
  entry: UnlockEntry | null
}

export interface UnlockScan {
  state: UnlockState
  /** 这一次新解锁的条目(顺序即声明顺序);一条都没有时 state 原样返回 */
  newly: UnlockEntry[]
}

export function createUnlockRegistry(config: { entries: readonly UnlockEntry[] }) {
  const byId = new Map<string, UnlockEntry>()
  for (const entry of config.entries) byId.set(entry.id, entry)

  const entryOf = (id: string): UnlockEntry | undefined => byId.get(id)
  const has = (state: UnlockState, id: string): boolean => state.unlocked.includes(id)
  /** 已解锁的条目(认不出 id 的旧数据跳过,不让它把成就墙炸了) */
  const list = (state: UnlockState): UnlockEntry[] => {
    const out: UnlockEntry[] = []
    for (const id of state.unlocked) {
      const entry = byId.get(id)
      if (entry) out.push(entry)
    }
    return out
  }
  const count = (state: UnlockState): number => state.unlocked.length
  const remaining = (state: UnlockState): number => Math.max(0, config.entries.length - count(state))

  /** 显式解锁(去重):由"当时发生的动作"声明,例如状态型成就 */
  const unlock = (state: UnlockState, id: string): UnlockOutcome => {
    const entry = entryOf(id)
    if (!entry || has(state, id)) return { state, unlocked: false, entry: entry ?? null }
    return { state: { unlocked: [...state.unlocked, id] }, unlocked: true, entry }
  }

  /**
   * 扫一遍:把"达成了且还没登记"的一次性挑出来(顺序即声明顺序)。
   * 判据应当是**纯**的 —— 一次扫描里每个条目只会被问一次(与任务链不同,这里没有守卫与多看一节)。
   */
  const scan = (state: UnlockState, ok: (entry: UnlockEntry) => boolean): UnlockScan => {
    const newly: UnlockEntry[] = []
    for (const entry of config.entries) {
      if (has(state, entry.id)) continue
      if (ok(entry)) newly.push(entry)
    }
    if (newly.length === 0) return { state, newly }
    return { state: { unlocked: [...state.unlocked, ...newly.map(entry => entry.id)] }, newly }
  }

  return { entries: config.entries, entryOf, has, list, count, remaining, unlock, scan }
}

export type UnlockRegistry = ReturnType<typeof createUnlockRegistry>
