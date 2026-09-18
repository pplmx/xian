/**
 * 离线 / 挂机推进 —— 放置类游戏的那道"回来之后要补多少"的口径。
 *
 * 这一层只管**时长账**:过去多久、其中多少算数(上限)、按什么效率算、
 * 拆成多少步。至于每一步产出什么(修为?材料?战斗?),那是调用方的事 ——
 * 引擎不该知道。
 *
 * 三条口径分开写,是因为现实里它们被混在一起过,混在一起就说不清:
 *   · `cappedMs`    计入上限后的时长 —— **上限**是"洞府只有这么大"这类设定;
 *   · `effectiveMs` 再乘效率系数    —— **效率**是"离线不如在线"这类平衡;
 *   · `steps`       拆成多少步      —— **粒度**是"每一步结算一次"这类实现细节。
 * 面板要说清"超出的那部分没算"时,需要的正是 capped 与 overflow 两个数。
 */

export interface IdleConfig {
  /** 单步时长(与 elapsedMs 同单位,通常用毫秒) */
  stepMs: number
  /** 计入上限;省略 = 不封顶 */
  capMs?: number
  /** 效率系数(0~1),乘在计入时长上;默认 1 */
  efficiency?: number
  /** 步数上限(防御性,防止 stepMs 设得过小跑爆) */
  maxSteps?: number
}

export interface IdlePlan {
  /** 单步时长(配置原值) */
  stepMs: number
  /** 实际过去多久 */
  elapsedMs: number
  /** 计入上限后的时长 */
  cappedMs: number
  /** 再乘效率系数后的"有效时长"(步数由它推) */
  effectiveMs: number
  /** 整数步数 */
  steps: number
  /** 不足一步的余量(不回退、也不吞掉:下一次结算会带上) */
  remainderMs: number
  /** 被上限吃掉的部分(0 = 没被截) */
  overflowMs: number
  /** 是否被上限截过(overflowMs > 0) */
  capped: boolean
}

/**
 * 算一份离线账 —— 纯函数,不碰任何状态。
 *
 * ```ts
 * const plan = planIdle(8 * 3600_000, { stepMs: 60_000, capMs: 6 * 3600_000, efficiency: 0.9 })
 * // cappedMs 6h · effectiveMs 5.4h · steps 324 · overflowMs 2h
 * ```
 */
export function planIdle(elapsedMs: number, config: IdleConfig): IdlePlan {
  if (!(config.stepMs > 0)) throw new Error('idle:stepMs 必须为正数')
  const elapsed = Math.max(0, elapsedMs)
  const capped = config.capMs === undefined ? elapsed : Math.min(elapsed, Math.max(0, config.capMs))
  const efficiency = config.efficiency ?? 1
  const effective = capped * Math.max(0, efficiency)
  const rawSteps = Math.floor(effective / config.stepMs)
  const steps = config.maxSteps === undefined ? rawSteps : Math.min(rawSteps, Math.max(0, config.maxSteps))
  const remainderMs = effective - steps * config.stepMs
  return {
    stepMs: config.stepMs,
    elapsedMs: elapsed,
    cappedMs: capped,
    effectiveMs: effective,
    steps,
    remainderMs,
    overflowMs: elapsed - capped,
    capped: elapsed > capped
  }
}

/**
 * 按 plan 逐步推进 —— 把"每步怎么算"交给调用方,引擎只保证步数与顺序。
 *
 * `step(state, index, stepMs)` 返回新状态;每一步拿到的 stepMs 都是配置里的那个值
 * (余量不单独成步,由调用方按 `remainderMs` 自行处理,或留给下一次)。
 */
export function runIdle<T>(plan: IdlePlan, initial: T, step: (state: T, index: number, stepMs: number) => T): T {
  let state = initial
  for (let i = 0; i < plan.steps; i += 1) state = step(state, i, plan.stepMs)
  return state
}
