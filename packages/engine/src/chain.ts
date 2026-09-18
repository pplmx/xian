/**
 * 顺序任务链(主线 / 章节 / 教程指引)—— "走到第几节了、能不能往前挪"。
 *
 * 与"周期任务板"(`tasks.ts`)是一对:那个问"这一期干了多少",这个问"走到哪一节了"。
 * 四条口径看着简单,但每条都踩过:
 *
 *   一 **一次结算可以连推多节**:玩家一口气满足后面好几节的条件是常事(一次大提升、
 *      一次离线回来都可能同时成立)。若每次只推一节,玩家会看到"明明达成了却卡着不动",
 *      要等下一次事件才开始下一节 —— 所以推进是个循环,而不是 `if`;
 *   二 **推进必须有上限**:内容写错(条件恒真)或坏档时,没有守卫的循环会一帧跳完整条链,
 *      甚至把渲染帧卡死。上限本身也要能**说出来**(`capped`):只把事故藏起来,下次还会再犯;
 *   三 **推进不可逆**:走到第 N 节就是第 N 节(回退、跳级都是另一件事,库不提供);
 *   四 **到链尾就停**:没有下一节时既不推进也不报错 —— 通关是正常状态,不是异常。
 *
 * 条件由内容给(`done(node, ctx)` —— 库不认识境界、计数、物品),所以同一套骨架既能做
 * 主线,也能做教程步骤、章节解锁、成就阶梯。
 */

export interface ChainNode {
  id: string
  /** 展示名(可省) */
  name?: string
}

export interface ChainState {
  /** 当前走到第几节(0 = 第一节还没完成) */
  index: number
}

export interface ChainConfig<Ctx = unknown> {
  /** 按顺序排好的节点 */
  nodes: readonly ChainNode[]
  /** 一次结算最多推进几节(默认 5)—— 守卫,不是配额 */
  maxSteps?: number
  /**
   * 这一节达成了吗。
   *
   * 请让它保持**纯**:撞上限的判定会多看一节(`capped` 那一问),判据若带副作用
   * (掷骰、写状态),那一问就会多发生一次。
   */
  done: (node: ChainNode, ctx: Ctx) => boolean
}

export interface ChainAdvance {
  /** 推进后的状态(没推进则原样返回) */
  state: ChainState
  /** 这一次走过的节点(顺序即链上顺序) */
  advanced: ChainNode[]
  /** 停在哪一节(null = 已经走到链尾) */
  current: ChainNode | null
  atEnd: boolean
  /** 撞上限了吗:还有节点满足条件,但这一轮按 `maxSteps` 停下了 */
  capped: boolean
}

export function createChain<Ctx = unknown>(config: ChainConfig<Ctx>) {
  const nodes = config.nodes
  const maxSteps = Math.max(1, Math.floor(config.maxSteps ?? 5))

  /** 把外来的下标夹进合法范围(坏档不该让链读出越界的一节) */
  const clampIndex = (index: number): number => {
    if (!Number.isFinite(index)) return 0
    return Math.min(nodes.length, Math.max(0, Math.floor(index)))
  }

  const nodeAt = (index: number): ChainNode | null => nodes[index] ?? null
  const indexOf = (id: string): number => nodes.findIndex(node => node.id === id)
  const current = (state: ChainState): ChainNode | null => nodeAt(clampIndex(state.index))
  /** 还剩几节没走 */
  const remaining = (state: ChainState): number => Math.max(0, nodes.length - clampIndex(state.index))

  /** 结算一次:能推多远推多远(最多 `maxSteps` 节) */
  const advance = (state: ChainState, ctx: Ctx): ChainAdvance => {
    let index = clampIndex(state.index)
    const advanced: ChainNode[] = []
    for (let step = 0; step < maxSteps; step += 1) {
      const node = nodes[index]
      if (!node || !config.done(node, ctx)) break
      advanced.push(node)
      index += 1
    }
    const next = nodes[index] ?? null
    // 撞上限:这一轮刚好推满,而**下一节也已经满足** —— 说明不是"到头了",是被守卫截住了
    const capped = advanced.length === maxSteps && next !== null && config.done(next, ctx)
    return {
      state: advanced.length === 0 ? state : { index },
      advanced,
      current: next,
      atEnd: next === null,
      capped
    }
  }

  return { nodes, maxSteps, clampIndex, nodeAt, indexOf, current, remaining, advance }
}

export type Chain<Ctx = unknown> = ReturnType<typeof createChain<Ctx>>
