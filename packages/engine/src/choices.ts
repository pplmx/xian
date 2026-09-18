/**
 * 抉择 —— "选一个,然后看看会怎样"。
 *
 * 事件 / 奇遇、任务分支、商店讨价、宝箱开启:凡是有"选项"的地方,骨架都是同一套:
 *
 *   一 每个选项可能**不一定能选**(境界不够、钱不够、没有那种灵根);
 *   二 选下去之后**后果可能不止一种**(同一句"伸手去拿",可能拿到、也可能被烫一下)——
 *      按权重掷,而不是写死;
 *   三 后果由**若干条效果**组成,而"效果"是什么只有作品知道:
 *      库不认识"灵石 +50""悟道 +1""获得一只灵兽" —— 它只负责**逐条问作品怎么解释**,
 *      并把每一行说明收集成回执(界面直接拿去显示);
 *   四 玩家没选(超时 / 离线 / 手滑点掉)时,要有一条**确定的兜底**:
 *      优先"标了默认且当前可选"的,其次"第一条可选的",最后"第一条"。
 *
 * 库给的是这四件事的顺序与边界;每个选项叫什么、有什么后果、效果怎么解释,都是内容。
 */
import type { Rng } from './rng.js'

export interface ChoiceOutcome<TEffect> {
  /** 权重(默认 1);一个选项下多条后果按它掷 */
  weight?: number
  /** 后果说明(界面用) */
  text?: string
  /** 这一后果触发的效果(标签 + 载荷,库不解释) */
  effects?: readonly TEffect[]
}

export interface ChoiceDef<TEffect> {
  id?: string
  /** 选项文字(玩家看的) */
  label: string
  /** 一句话提示 */
  hint?: string
  /**
   * 能不能选:返回 `true` / `false`,或一句**为什么不能**(界面直接显示)。
   * 省略 = 永远可选。
   */
  available?: (ctx: unknown) => boolean | string
  /** 后果(至少一条;空数组按"什么都不发生"处理) */
  outcomes: readonly ChoiceOutcome<TEffect>[]
  /** 玩家没选时的兜底项(见文件头第四条) */
  isDefault?: boolean
}

export interface ChoiceReceipt<TEffect> {
  /** 掷中的那条后果 */
  outcome: ChoiceOutcome<TEffect>
  /** 它在 `outcomes` 里的下标 */
  index: number
  /** 后果自带的说明 */
  text: string
  /** 逐条效果的解释(没生效的条目不进来) */
  lines: string[]
  /** 没生效的条数(解释器返回空 = 这一条没发生,例如"钱不够,不扣了") */
  skipped: number
}

export interface ChoiceConfig<TEffect, TCtx> {
  /**
   * 解释一条效果 —— **库不认识的标签全在这里落地**。
   * 返回一行说明(界面直接显示);返回 `null` / 空表示"这一条没发生"(例如付不起代价)。
   */
  interpret: (effect: TEffect, ctx: TCtx) => string | null | undefined
}

export function createChoiceSystem<TEffect, TCtx = unknown>(config: ChoiceConfig<TEffect, TCtx>) {
  /** 能不能选:把 `available` 的三种返回(undefined / true / false / 理由)收成一个形状 */
  const available = (choice: ChoiceDef<TEffect>, ctx: TCtx): { ok: boolean; reason?: string } => {
    if (!choice.available) return { ok: true }
    const verdict = choice.available(ctx as unknown)
    if (verdict === true || verdict === undefined) return { ok: true }
    if (verdict === false) return { ok: false, reason: '当前不可选' }
    return { ok: false, reason: verdict }
  }

  /** 掷一条后果:按权重;权重全为 0(或都没给)时取第一条 —— 边界要确定,不能返回空 */
  const roll = (choice: ChoiceDef<TEffect>, rng: Rng): { outcome: ChoiceOutcome<TEffect>; index: number } => {
    const outcomes = choice.outcomes
    if (outcomes.length === 0) return { outcome: { effects: [] }, index: -1 }
    const total = outcomes.reduce((sum, o) => sum + Math.max(0, o.weight ?? 1), 0)
    if (total <= 0) return { outcome: outcomes[0]!, index: 0 }
    const picked = rng.weighted(outcomes, o => Math.max(0, o.weight ?? 1))
    return { outcome: picked, index: outcomes.indexOf(picked) }
  }

  /** 结算:掷后果 → 逐条解释效果 → 回执 */
  const resolve = (choice: ChoiceDef<TEffect>, ctx: TCtx, rng: Rng): ChoiceReceipt<TEffect> => {
    const { outcome, index } = roll(choice, rng)
    const lines: string[] = []
    let skipped = 0
    for (const effect of outcome.effects ?? []) {
      const line = config.interpret(effect, ctx)
      if (line) lines.push(line)
      else skipped += 1
    }
    return { outcome, index, text: outcome.text ?? '', lines, skipped }
  }

  /**
   * 玩家没选时的兜底下标:优先"标了默认且当前可选"的,其次"第一条可选的",最后"第一条"。
   * 没有任何可选项时返回 0(调用方仍有一条可结算,不至于卡住界面)。
   */
  const defaultIndex = (choices: readonly ChoiceDef<TEffect>[], ctx: TCtx): number => {
    const byDefault = choices.findIndex(c => c.isDefault && available(c, ctx).ok)
    if (byDefault >= 0) return byDefault
    const byAvailable = choices.findIndex(c => available(c, ctx).ok)
    if (byAvailable >= 0) return byAvailable
    return 0
  }

  return { available, roll, resolve, defaultIndex }
}

export type ChoiceSystem<TEffect, TCtx = unknown> = ReturnType<typeof createChoiceSystem<TEffect, TCtx>>
