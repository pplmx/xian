/**
 * 结算回执 —— "这一笔到底给了多少"。
 *
 * 掉落、任务奖励、活动补发……凡是"给东西"的地方,都要同时回答两个问题:
 * **给了什么**(界面要显示),与**实际到账多少**(账本要对得上)。
 * 这两件事一旦各算一份,就会出现那个最招人骂的现象:
 * 界面写"本次所得 120",而行囊只多了 100(被上限截了、扣了手续费、或在另一处又算了一遍)。
 *
 * 这一层把"实际入账"做成回执的**唯一来源**:回执里的每个数字都来自账本落账时的
 * 实际发生额(见 `resources` 的 `AppliedEntry.applied`),而不是计划值。
 * 于是"同源"不再靠自觉 —— 想显示别的数,得先绕过回执,那是显式的越界。
 *
 * 被上下限夹掉的差额单独给一栏(`clipped`),界面上就能说清"满了 / 截了"。
 */
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'
import type { Ledger, ResourceEntry, ResourceSystem } from './resources.js'

export interface SettlementPlan<T = number> {
  /** 这一笔要发的资源(正数 = 发放,负数 = 扣除) */
  grants?: readonly ResourceEntry<T>[]
}

export interface SettlementReceipt<T = number> {
  /** 每个键**实际入账**的合计(不是计划值) */
  totals: Record<string, T>
  /** 被上下限夹掉的差额(计划 − 实际);没有上限 / 下限时恒为 0 */
  clipped: Record<string, T>
}

export function createSettlement<T = number>(
  config: { resources: ResourceSystem<T> },
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
) {
  const settle = (
    ledger: Ledger<T>,
    plan: SettlementPlan<T>
  ): { ledger: Ledger<T>; receipt: SettlementReceipt<T> } => {
    const applied = config.resources.apply(ledger, plan.grants ?? [])
    const totals: Record<string, T> = {}
    const clipped: Record<string, T> = {}
    for (const entry of applied.entries) {
      // 合计与实际发生额同源(不是把计划值加起来)
      totals[entry.key] = entry.key in totals ? numeric.add(totals[entry.key]!, entry.applied) : entry.applied
      // 被夹掉多少:计划 − 实际(整数取整、上限截断、下限抬升都会体现在这里)
      const wanted = typeof entry.amount === 'number' ? numeric.from(entry.amount) : entry.amount
      const difference = numeric.sub(wanted, entry.applied)
      if (numeric.cmp(difference, numeric.zero) !== 0) {
        clipped[entry.key] = entry.key in clipped ? numeric.add(clipped[entry.key]!, difference) : difference
      }
    }
    return { ledger: applied.ledger, receipt: { totals, clipped } }
  }

  return { settle }
}

export type Settlement<T = number> = ReturnType<typeof createSettlement<T>>
