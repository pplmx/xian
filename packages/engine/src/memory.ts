/**
 * 世界记忆的档位 —— "因为你做过什么,这个地方/这段关系变成了什么样"。
 *
 * 阵营好感、地区繁荣、宿怨深浅、门派声望……同一套骨架,而它的规则比看上去绕:
 *
 *   一 **多路门槛,取先到**:本作的区域繁荣既看"打赢过多少场"(≥30 稳定 / ≥80 繁盛),
 *      也看"守了多久"(≥6 小时稳定 / ≥24 小时繁盛)—— 只认计数的话,镇压之后不再产胜场,
 *      "守得住"这件事就永远算不出回报;
 *   二 **有资格才谈得上**:没镇压过的地界谈不上"安定",再能打也只是混乱。
 *      资格由作品给(本作是"镇压过"),不满足就停在最低档;
 *   三 **会回落**:多久不打交道(默认口径由作品给,本作 48 小时)就退回低档 ——
 *      世界的记忆不是只增不减的计数器,不然"守土"会变成一劳永逸的税;
 *   四 **钟的起点是"最后一次打交道"**:战斗、镇压、通关,取最晚的那一次。
 *      起点找错,倒计时就会在"其实一直在打"的地界上白走。
 *
 * 档位叫什么、门槛多少、系数给多少,都是内容;库给的是上面这四条的顺序与边界。
 */

export interface StageSpec {
  /** 档位标识(本作是 chaos / stable / flourish) */
  id: string
  /** 展示名 */
  name?: string
  /**
   * 进入本档的门槛:**计数**到多少,或**守着**多少小时 —— 两路**取先到**。
   * 最低档不写门槛。
   */
  at?: { count?: number; hours?: number }
  /** 这一档带来的系数(如产出 ×1.05);省略即 1 */
  mult?: number
}

export interface StageMemoryConfig {
  /** 由低到高的档位表;第一档是"什么都没发生"的默认档 */
  stages: readonly StageSpec[]
  /** 多久不打交道就回落(小时);不配 = 只增不减 */
  decayAfterHours?: number
}

export interface StageMemoryInput {
  /** 累计计数(胜场 / 好感度事件数……) */
  count?: number
  /** "守着多久"(小时,从某个起算点到现在) */
  hours?: number
  /** 多久没打交道(小时) */
  idleHours?: number
  /** 有没有资格谈高档位(本作:镇压过);省略 = 一直有资格 */
  eligible?: boolean
}

export interface StageMemoryState {
  id: string
  name: string
  mult: number
  /** 是否因为"太久没打交道"而回落 */
  decayed: boolean
}

export function createStageMemory(config: StageMemoryConfig) {
  const stages = config.stages
  if (stages.length === 0) throw new Error('档位表不能为空:至少要有一个默认档')

  /** 由输入推当前档位(纯函数) */
  const stateOf = (input: StageMemoryInput = {}): StageMemoryState => {
    const eligible = input.eligible ?? true
    const decayed =
      config.decayAfterHours !== undefined && (input.idleHours ?? 0) >= config.decayAfterHours
    // 没资格、或已经回落 → 停在最低档
    if (!eligible || decayed) return toState(stages[0]!, decayed)
    // 从高档往低档找:第一个够门槛的就是当前档(两路门槛取先到)
    for (let i = stages.length - 1; i >= 1; i -= 1) {
      const stage = stages[i]!
      const byCount = stage.at?.count !== undefined && (input.count ?? 0) >= stage.at.count
      const byHours = stage.at?.hours !== undefined && (input.hours ?? 0) >= stage.at.hours
      if (byCount || byHours) return toState(stage, false)
    }
    return toState(stages[0]!, false)
  }

  const toState = (stage: StageSpec, decayed: boolean): StageMemoryState => ({
    id: stage.id,
    name: stage.name ?? stage.id,
    mult: stage.mult ?? 1,
    decayed
  })

  /**
   * 钟的起点:最后一次与它打交道(几路时间取最晚)。
   * 没打过交道(全是 0 / undefined)时返回 0 —— "从没碰过"与"刚碰过"要分得清。
   */
  const touchedAt = (...times: readonly (number | undefined)[]): number =>
    times.reduce<number>((latest, at) => Math.max(latest, at ?? 0), 0)

  /** 两个时刻之间过了多少小时(负值按 0 算) */
  const hoursBetween = (from: number, to: number): number => Math.max(0, (to - from) / 3600_000)

  /** 距离某个期限还有多少小时(已过期给 0)—— 界面倒计时与判定共用这一处 */
  const hoursUntil = (from: number, now: number, limitHours: number): number =>
    Math.max(0, limitHours - hoursBetween(from, now))

  /** 够钟了吗(本作:妖气复聚 72 小时)。从未打过交道的不算 */
  const idleBeyond = (from: number, now: number, limitHours: number): boolean =>
    from > 0 && hoursBetween(from, now) > limitHours

  return { stages, stateOf, touchedAt, hoursBetween, hoursUntil, idleBeyond }
}

export type StageMemory = ReturnType<typeof createStageMemory>
