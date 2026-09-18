/**
 * 目标 / 条件 —— 任务与成就共用的那一条判据。
 *
 * ## 为什么"达成与否"必须只有一处
 *
 * 界面要显示"还差 3 个敌人",发赏时要判"够不够"。若两处各写一遍比较,
 * 迟早出现"界面说成了、领赏时不算"(或反过来)—— 而这类不一致,玩家只会当成吞奖励。
 * 故这里把判定收成一个纯函数 `evalGoal`,进度视图 `goalProgress` 与它共用同一份判断。
 *
 * ## 环境由作品给
 *
 * 引擎不认识玩家的存档:计数怎么存、等级怎么算、什么叫"品质够高",全由使用方通过
 * `GoalEnv` 回答。于是同一条条件既能用在修仙的境界上,也能用在别的作品的等级上。
 */

export type GoalCond =
  /** 计数型:某个计数器达到 value */
  | { type: 'counter'; key: string; value: number }
  /** 等级型:等级达到 min */
  | { type: 'level'; min: number }
  /** 位阶型:大阶 major、小阶 sub(省略 sub 即只看大阶) */
  | { type: 'position'; major: number; sub?: number }
  /** 品阶型:品阶达到 min */
  | { type: 'rank'; min: number }
  /** 自定义:交给作品判(如"是否已渡过某劫") */
  | { type: 'custom'; key: string }
  /**
   * 组合:**全部**子条件都成立才算成立(可嵌套)。
   * 空数组视为成立(没有要求)—— 这与"空条件不该拦住人"的直觉一致。
   */
  | { type: 'all'; of: readonly GoalCond[] }
  /**
   * 组合:**任一**子条件成立即成立(可嵌套)。
   * 空数组视为不成立 —— "没有任何一条路"就是走不通。
   */
  | { type: 'any'; of: readonly GoalCond[] }

/** 作品侧的环境:引擎向它提问,而不是自己去翻存档 */
export interface GoalEnv {
  /** 计数器的当前值(未知键按 0) */
  counter(key: string): number
  /** 当前等级(大阶) */
  level(): number
  /** 当前小阶;省略时按 0 参与比较 */
  subLevel?(): number
  /** 当前品阶;未提供则品阶型条件永远不成立 */
  rank?(): number
  /** 自定义条件;未提供则自定义条件永远不成立 */
  custom?(key: string): boolean
}

/** 条件是否达成 —— 任务与成就的**唯一判据** */
export function evalGoal(cond: GoalCond, env: GoalEnv): boolean {
  switch (cond.type) {
    case 'counter':
      return env.counter(cond.key) >= cond.value
    case 'level':
      return env.level() >= cond.min
    case 'position': {
      const major = env.level()
      const sub = env.subLevel?.() ?? 0
      // 大阶优先:高一大阶即成立,不必比小阶
      return major > cond.major || (major === cond.major && sub >= (cond.sub ?? 0))
    }
    case 'rank':
      return env.rank !== undefined && env.rank() >= cond.min
    case 'custom':
      return env.custom?.(cond.key) ?? false
    case 'all':
      return cond.of.every(sub => evalGoal(sub, env))
    case 'any':
      return cond.of.some(sub => evalGoal(sub, env))
  }
}

export interface GoalProgress {
  done: boolean
  /** 可量化的那类给 0~1(界面画条用);未量为 null */
  ratio: number | null
  /** 当前值(可量化那类才有,且是**原始值**,不替调用方截断) */
  current: number | null
  /** 目标值(可量化那类才有) */
  target: number | null
  /** 组合条件才有:逐个子的进度(递归),方便界面把"还差哪一条"摊开 */
  parts?: (GoalProgress | null)[]
}

/**
 * 条件 → 进度。认不出的条件返回 null —— 界面就不显示,而不是硬编一个读数。

 * 注意 `ratio` 的分母:目标为 0 时按已达成(1)处理,免得除零。
 */
export function goalProgress(cond: GoalCond, env: GoalEnv): GoalProgress | null {
  const done = evalGoal(cond, env)
  switch (cond.type) {
    case 'counter': {
      const current = env.counter(cond.key)
      return { done, ratio: cond.value > 0 ? Math.min(1, current / cond.value) : 1, current, target: cond.value }
    }
    case 'level':
      return { done, ratio: null, current: env.level(), target: cond.min }
    case 'position':
      return { done, ratio: null, current: null, target: null }
    case 'rank':
      return { done, ratio: null, current: env.rank?.() ?? null, target: cond.min }
    case 'custom':
      // 自定义条件是不是"能显示进度",只有作品知道:它没提供 custom 就当作没有进度可言
      return env.custom === undefined ? null : { done, ratio: null, current: null, target: null }
    case 'all':
    case 'any':
      return { done, ratio: null, current: null, target: null, parts: cond.of.map(sub => goalProgress(sub, env)) }
  }
}
